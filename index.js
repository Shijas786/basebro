app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.trim().toLowerCase();
  const from = req.body.From;

  console.log(`📩 Incoming: "${incomingMsg}" from ${from}`);

  let reply = '';

  if (incomingMsg === '/start') {
    reply = '👋 Hello! Your wallet is being set up.';
  } else if (incomingMsg === '/help') {
    reply = '📖 Use:\n/start - Setup Wallet\n/balance - View Balance\n/send - Send Tokens\n/tip - Tip in Groups\n/rain - Rain tokens randomly';
  } else if (incomingMsg === '/balance') {
    reply = '🪙 Your balance:\nUSDT: 0.00\nUSDC: 0.00';
  } else if (incomingMsg === '/send') {
    reply = '📤 Usage:\n/send <amount> <token> to <phone>\nExample: /send 5 usdt to +918123456789';
  } else if (incomingMsg === '/tip') {
    reply = '💸 Usage:\n/tip <amount> <token>\nExample: /tip 2 usdc';
  } else if (incomingMsg === '/rain') {
    reply = '🌧️ Usage:\n/rain <amount> <token> to <number>\nExample: /rain 10 usdt to 3 users';
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

