// Tell the bot about his tools
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const fs = require('fs');

// Use the secret code
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, {
    polling: true,
    request: {
        agentOptions: {
            family: 4 // Forces the use of IPv4
        }
    }
});

console.log('🤖 RemindBuddy is waking up...');

// 🛡️ ADD THIS ERROR HANDLING 🛡️
bot.on('polling_error', (error) => {
    console.log('🔧 Polling error, but bot keeps running:', error.code);
});

bot.on('webhook_error', (error) => {
    console.log('🔧 Webhook error:', error.message);
});

process.on('uncaughtException', (error) => {
    console.log('🛡️  Protected from crash:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('🛡️  Protected from async crash:', reason);
});
// 🛡️ END OF ERROR HANDLING 🛡️

// Make buttons for the bot
const mainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            ['📝 Add Task', '✅ I Did It!'],
            ['📊 My Progress', '🗑 Clear Tasks'],
            ['🔕 Stop Annoying Me', '🎯 What I Forgot']
        ],
        resize_keyboard: true
    }
};

// Super memory that saves forever!
let userData = {};

// Load memory when bot starts
function loadMemory() {
    try {
        if (fs.existsSync('memory.json')) {
            const data = fs.readFileSync('memory.json');
            userData = JSON.parse(data);
            console.log('✅ Loaded memory from file!');
        }
    } catch (error) {
        console.log('📝 Starting with fresh memory...');
    }
}

// Save memory whenever something changes
function saveMemory() {
    fs.writeFileSync('memory.json', JSON.stringify(userData, null, 2));
}

// Load memory when bot starts
loadMemory();

// Celebration messages when tasks are completed
const celebrations = [
    "🎉 YOU ARE AMAZING! Task completed! 🌟",
    "🚀 Look at you go! Another task conquered! 💪",
    "🌈 Wow! You're on fire! Great job! 🔥",
    "⭐ Superstar alert! Task done! 🎯",
    "😊 You're making progress! So proud! 👏"
];

function getRandomCelebration() {
    return celebrations[Math.floor(Math.random() * celebrations.length)];
}

// ANNOYING reminder system
function sendAnnoyingReminders() {
    console.log('🔔 Checking for reminders...');
    
    for (const chatId in userData) {
        const user = userData[chatId];
        
        if (user.tasks && user.tasks.length > 0) {
            if (!user.reminderCount) user.reminderCount = 0;
            user.reminderCount++;
            
            let annoyingMessage = "";
            let extraAnnoying = "";
            
            if (user.reminderCount <= 3) {
                annoyingMessage = `🚨 REMINDER #${user.reminderCount} 🚨\n\nHEY! You told me to remind you about:\n\n`;
                extraAnnoying = "\n\n⚠️ This won't go away until you deal with it!";
            } else if (user.reminderCount <= 6) {
                annoyingMessage = `🔴 REMINDER #${user.reminderCount} 🔴\n\nLISTEN! You're forgetting:\n\n`;
                extraAnnoying = "\n\n🚫 I'll keep reminding you!";
            } else {
                annoyingMessage = `💀 REMINDER #${user.reminderCount} 💀\n\nSERIOUSLY?! You still haven't done:\n\n`;
                extraAnnoying = "\n\n⏰ I'm now reminding you more often!";
            }
            
            user.tasks.forEach((task) => {
                annoyingMessage += `📌 ${task}\n`;
            });
            
            annoyingMessage += extraAnnoying;
            
            bot.sendMessage(chatId, annoyingMessage, mainMenuKeyboard)
                .catch(error => {
                    console.log('Could not send reminder');
                });
            
            saveMemory();
        }
    }
}

// Start the annoying reminder system
setInterval(sendAnnoyingReminders, 2 * 60 * 1000); // 2 minutes for testing
console.log('🔔 Annoying reminder system ACTIVATED!');

// When someone says "start"
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name;
    
    if (!userData[chatId]) {
        userData[chatId] = {
            tasks: [],
            userName: userName,
            reminderCount: 0
        };
        saveMemory();
    }
    
    bot.sendMessage(chatId, 
        `👋 Hello ${userName}! I'm RemindBuddy!\nI'll help you remember things!`,
        mainMenuKeyboard
    );
});

// When someone clicks buttons
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (!userData[chatId]) {
        userData[chatId] = { 
            tasks: [],
            reminderCount: 0
        };
        saveMemory(); 
    }
    
    const user = userData[chatId];
    
    if (text === '📝 Add Task') {
        bot.sendMessage(chatId, "Tell me what you need to remember! ✏️");
        user.waitingForTask = true;
        
    } else if (text === '✅ I Did It!') {
        if (user.tasks.length === 0) {
            bot.sendMessage(chatId, "🎉 You're all caught up! No tasks!", mainMenuKeyboard);
        } else {
            let taskList = "Which task did you complete?\n\n";
            user.tasks.forEach((task, index) => {
                taskList += `${index + 1}. ${task}\n`;
            });
            bot.sendMessage(chatId, taskList);
            user.waitingForComplete = true;
        }
        
    } else if (text === '🔕 Stop Annoying Me') {
        user.reminderCount = 0;
        saveMemory();
        bot.sendMessage(chatId, "😴 I'll be less annoying now!", mainMenuKeyboard);
        
    } else if (text === '📊 My Progress') {
        const totalTasks = user.tasks.length;
        if (totalTasks === 0) {
            bot.sendMessage(chatId, "No tasks yet! Add some! 🚀", mainMenuKeyboard);
        } else {
            bot.sendMessage(chatId, 
                `📊 You have ${totalTasks} task(s)!\nAnnoyance: ${user.reminderCount}`,
                mainMenuKeyboard
            );
        }
        
    } else if (text === '🗑 Clear Tasks') {
        user.tasks = [];
        user.reminderCount = 0;
        saveMemory();
        bot.sendMessage(chatId, "✅ All cleared! Fresh start! 🧹", mainMenuKeyboard);
        
    } else if (text === '🎯 What I Forgot') {
        if (user.tasks.length === 0) {
            bot.sendMessage(chatId, "Nothing! You're all caught up! 🎉", mainMenuKeyboard);
        } else {
            let taskList = "You told me to remember:\n\n";
            user.tasks.forEach((task, index) => {
                taskList += `${index + 1}. ${task}\n`;
            });
            bot.sendMessage(chatId, taskList, mainMenuKeyboard);
        }
        
    } else if (user.waitingForTask) {
        user.tasks.push(text);
        saveMemory();
        user.waitingForTask = false;
        bot.sendMessage(chatId, `✅ Added: "${text}"`, mainMenuKeyboard);
        
    } else if (user.waitingForComplete) {
        const taskNumber = parseInt(text);
        if (taskNumber >= 1 && taskNumber <= user.tasks.length) {
            const completedTask = user.tasks.splice(taskNumber - 1, 1)[0];
            user.reminderCount = Math.max(0, user.reminderCount - 2);
            const celebration = getRandomCelebration();
            bot.sendMessage(chatId, `${celebration}\n"${completedTask}"`, mainMenuKeyboard);
            saveMemory();
        } else {
            bot.sendMessage(chatId, "Type a valid number! 🔢", mainMenuKeyboard);
        }
        user.waitingForComplete = false;
    }
});

// Simple port binding for Render
const port = process.env.PORT || 3000;
require('http').createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🤖 RemindBuddy Bot is Alive!\n');
}).listen(port, '0.0.0.0');

console.log(`✅ Bot is running on port ${port}`);
