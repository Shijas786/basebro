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

// Simple webhook to respond to WhatsApp messages
app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body;
  const from = req.body.From;

  console.log(`Received: "${incomingMsg}" from ${from}`);

  let reply = 'Welcome to BasePay Bot!';

  if (incomingMsg.toLowerCase() === '/start') {
    reply = '👋 Hello! Your wallet is being set up.';
  } else if (incomingMsg.toLowerCase() === '/help') {
    reply = 'Use /balance, /send, /tip to manage your wallet.';
  }

  // Send back a WhatsApp reply
  await client.messages.create({
    body: reply,
    from: fromNumber,
    to: from,
  });

  res.sendStatus(200);
});

// Start server
app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
});
