require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { ethers } = require('ethers');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = twilio(accountSid, authToken);

// Dummy in-memory DB (replace with real DB)
const userWallets = {};
const userHistory = {};

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT_ADDRESS = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

async function getBalances(address) {
  const ethBalance = await provider.getBalance(address);
  const usdc = new ethers.Contract(USDC_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
  const usdt = new ethers.Contract(USDT_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
  const usdcBal = await usdc.balanceOf(address);
  const usdtBal = await usdt.balanceOf(address);

  return {
    eth: ethers.formatEther(ethBalance),
    usdc: ethers.formatUnits(usdcBal, 6),
    usdt: ethers.formatUnits(usdtBal, 6),
  };
}

function logCommand(user, cmd) {
  if (!userHistory[user]) userHistory[user] = [];
  userHistory[user].unshift(cmd);
  if (userHistory[user].length > 5) userHistory[user].pop();
}

function getUserWallet(user) {
  if (!userWallets[user]) {
    userWallets[user] = ethers.Wallet.createRandom().address;
  }
  return userWallets[user];
}

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body.trim();
  const from = req.body.From;
  const lower = incomingMsg.toLowerCase();

  console.log(`Received: "${incomingMsg}" from ${from}`);

  let reply = 'Welcome to BasePay Bot!';

  if (lower === '/start') {
    const wallet = getUserWallet(from);
    reply = `👋 Welcome to BasePay Bot\n\nSend, receive, tip, and trade crypto directly on WhatsApp — simple, secure, gasless, and peer-to-peer, *built on Base*.\n\n⚙️ One-time setup:\nSend *join draw-worker* to *+1 415 523 8886* on WhatsApp to activate your wallet.\n(This is required every 72 hours.)\n\nType /help to view available commands.`;
    logCommand(from, '/start');
  } else if (lower === '/help') {
    reply = '📚 Available commands:\n/start\n/help\n/balance\n/history\n/receive';
    logCommand(from, '/help');
  } else if (lower === '/balance') {
    const wallet = getUserWallet(from);
    const balances = await getBalances(wallet);
    reply = `💰 Your Wallet Balance:\nETH: ${balances.eth}\nUSDC: ${balances.usdc}\nUSDT: ${balances.usdt}`;
    logCommand(from, '/balance');
  } else if (lower === '/history') {
    const hist = userHistory[from] || [];
    reply = `🕓 Your recent actions:\n` + hist.join('\n');
    logCommand(from, '/history');
  } else if (lower === '/receive') {
    const wallet = getUserWallet(from);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${wallet}`;
    await client.messages.create({ from: fromNumber, to: from, body: `🔐 Your wallet address:\n${wallet}` });
    await client.messages.create({ from: fromNumber, to: from, mediaUrl: [qrUrl], body: `📲 Scan this QR to receive tokens.` });
    return res.sendStatus(200);
  }

  await client.messages.create({
    body: reply,
    from: fromNumber,
    to: from,
  });

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
});
