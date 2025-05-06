const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

// Middleware for logging requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
const publicPath = path.join(__dirname, '../public');
console.log('Public path:', publicPath);

// Static file middleware
app.use(express.static(publicPath));

// Telegram webhook
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const message = req.body.message;

    if (message?.text === '/start') {
      const chatId = message.chat.id;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Играй в сапера!',
          reply_markup: {
            inline_keyboard: [[{
              text: '🎮 Играть',
              web_app: { url: WEBAPP_URL }
            }]]
          }
        })
      });
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Internal Server Error');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Static files being served from: ${publicPath}`);
  // List files in public directory
  const fs = require('fs');
  try {
    const files = fs.readdirSync(publicPath);
    console.log('Files in public directory:', files);
  } catch (error) {
    console.error('Error reading public directory:', error);
  }
});