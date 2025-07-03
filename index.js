require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

// Handle incoming WhatsApp messages
app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.trim().toLowerCase();
  const from = req.body.From;

  console.log(`📩 Incoming: "${incomingMsg}" from ${from}`);

  let reply = '';

  if (incomingMsg === '/start') {
    reply = `👋 Hello! Your wallet is being set up.

⚠️ If you haven’t joined the WhatsApp Sandbox yet:
👉 Send *join draw-worker* to *+1 415 523 8886*
(This step is needed only once every 72 hours)`;
  } else if (incomingMsg === '/help') {
    reply = `📖 Commands:
✅ /start - Setup Wallet
💰 /balance - Check Token Balance
📤 /send - Send Tokens
💸 /tip - Tip in Group
🌧️ /rain - Random Tip in Group`;
  } else if (incomingMsg === '/balance') {
    reply = '🪙 Your balance:\nUSDT: 0.00\nUSDC: 0.00';
  } else if (incomingMsg === '/send') {
    reply = '📤 Usage:\n/send 5 usdt to +918123456789';
  } else if (incomingMsg === '/tip') {
    reply = '💸 Usage:\n/tip 2 usdc';
  } else if (incomingMsg === '/rain') {
    reply = '🌧️ Usage:\n/rain 10 usdt to 3 users';
  } else {
    reply = '👋 Welcome to BasePay Bot!\nSend /help to see available commands.';
  }

  await client.messages.create({
    body: reply,
    from: fromNumber,
    to: from,
  });

  res.sendStatus(200);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});
