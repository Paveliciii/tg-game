const express = require('express');
const fetch = require('node-fetch');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

app.use(express.json());
app.use(express.static('public'));

// Telegram webhook
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
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
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 