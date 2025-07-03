require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const fs = require('fs');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const client = twilio(accountSid, authToken);

const USDT_ADDRESS = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

const historyFile = './history.json';
if (!fs.existsSync(historyFile)) fs.writeFileSync(historyFile, '{}');

function saveAction(user, action) {
  const data = JSON.parse(fs.readFileSync(historyFile));
  if (!data[user]) data[user] = [];
  data[user].unshift({ action, time: new Date().toISOString() });
  if (data[user].length > 5) data[user] = data[user].slice(0, 5);
  fs.writeFileSync(historyFile, JSON.stringify(data));
}

async function getTokenBalance(tokenAddress, userAddress) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await token.balanceOf(userAddress);
  const decimals = await token.decimals();
  return Number(ethers.formatUnits(balance, decimals)).toFixed(2);
}

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.trim().toLowerCase();
  const from = req.body.From;
  const user = from.replace('whatsapp:', '');
  let reply = '';

  if (incomingMsg === '/start') {
    reply = `👋 *Welcome to BasePay Bot*

Send, receive, tip, and trade crypto directly on WhatsApp — simple, secure, gasless, and peer-to-peer, *built on Base*.

⚙️ *One-time setup:*  
Send *join draw-worker* to *+1 415 523 8886* on WhatsApp to activate your wallet.  
(This is required every 72 hours.)

Type /help to view available commands.`;
  } else if (incomingMsg === '/help') {
    reply = `📖 *BasePay Bot Commands*:

💰 /balance – View token balances  
📤 /send 5 usdt to +91xxxxxxxxxx  
💸 /tip 2 usdc  
🌧 /rain 10 usdt to 3 users  
📜 /history – Recent actions  
/start – Setup your wallet  
/help – Show this menu`;
  } else if (incomingMsg === '/balance') {
    const walletAddress = process.env.DEFAULT_USER_WALLET || '0x000000000000000000000000000000000000dead';
    const eth = await provider.getBalance(walletAddress);
    const ethBal = ethers.formatEther(eth);
    const usdcBal = await getTokenBalance(USDC_ADDRESS, walletAddress);
    const usdtBal = await getTokenBalance(USDT_ADDRESS, walletAddress);

    reply = `🪙 *Your Balance*:
• ETH: ${parseFloat(ethBal).toFixed(4)}  
• USDT: ${usdtBal}  
• USDC: ${usdcBal}`;
  } else if (incomingMsg === '/history') {
    const data = JSON.parse(fs.readFileSync(historyFile));
    const actions = data[user] || [];
    reply = actions.length === 0
      ? '📜 No recent activity.'
      : `📜 *Last ${actions.length} actions:*\n` + actions.map(e => `- ${e.action} (${e.time.split('T')[0]})`).join('\n');
  } else if (incomingMsg.startsWith('/send')) {
    reply = '📤 Usage:\n/send 5 usdt to +918123456789';
    saveAction(user, incomingMsg);
  } else if (incomingMsg.startsWith('/tip')) {
    reply = '💸 Usage:\n/tip 2 usdc';
    saveAction(user, incomingMsg);
  } else if (incomingMsg.startsWith('/rain')) {
    reply = '🌧️ Usage:\n/rain 10 usdt to 3 users';
    saveAction(user, incomingMsg);
  } else {
    reply = '👋 Welcome to BasePay Bot!\nType /help to see available commands.';
  }

  await client.messages.create({ body: reply, from: fromNumber, to: from });
  res.sendStatus(200);
});

app.listen(PORT, () => console.log(`🚀 Bot running on port ${PORT}`));
