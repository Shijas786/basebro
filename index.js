require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// Blockchain Setup
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC);
const wallets = {};
const greetedUsers = new Set();

const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';


// ✅ Health Check (Render or browser)
app.get('/', (req, res) => {
  res.status(200).send('✅ BasePay server running. Use /gupshup for webhook.');
});

// ✅ Gupshup-specific test GET
app.get('/gupshup', (req, res) => {
  res.status(200).send('✅ Gupshup webhook live');
});

// ✅ Main WhatsApp Webhook (Gupshup POST)
app.post('/gupshup', async (req, res) => {
  const payload = req.body;
  const from = payload.sender?.phone;
  const incomingMsg = payload.message?.text?.trim().toLowerCase();

  console.log('📩 Incoming:', payload);

  // Accept sandbox-start (required)
  if (payload.type === "sandbox-start") {
    return res.sendStatus(200);
  }

  if (!from || !incomingMsg) {
    console.log('⚠️ Empty message or missing sender');
    return res.sendStatus(200);
  }

  let reply = '🤖 Welcome to BasePay!';

  // Auto-wallet creation
  if (!wallets[from]) {
    const wallet = ethers.Wallet.createRandom();
    wallets[from] = wallet;
    if (!greetedUsers.has(from)) {
      greetedUsers.add(from);
      reply = `👋 Hello! Wallet created: ${wallet.address}\nType /start to explore.`;
    }
  }

  // Command handling
  if (incomingMsg === '/start') {
    reply = `🚀 *Welcome to BasePay*\n\nCommands:\n/start\n/balance\n/receive\n/send USDC address amount\n/rain USDC amount`;
  } else if (incomingMsg === '/receive') {
    reply = `📥 Your wallet address:\n${wallets[from].address}`;
  } else if (incomingMsg === '/balance') {
    const addr = wallets[from].address;
    try {
      const [eth, usdc, usdt] = await Promise.all([
        provider.getBalance(addr).then(b => ethers.formatEther(b)),
        getTokenBalance(addr, USDC),
        getTokenBalance(addr, USDT)
      ]);
      reply = `💼 Balance:\nETH: ${eth}\nUSDC: ${usdc}\nUSDT: ${usdt}`;
    } catch (err) {
      console.error('⚠️ Error fetching balance:', err);
      reply = `⚠️ Error fetching balance. Try again later.`;
    }
  }

  // Default reply
  res.json({ type: "text", message: reply });
});

// Helper to get token balance
async function getTokenBalance(address, tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const raw = await contract.balanceOf(address);
  return ethers.formatUnits(raw, 6); // USDC/USDT decimals
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 BasePay Gupshup bot running on port ${PORT}`);
});
