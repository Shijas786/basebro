require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');

const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;

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

// Minimal GET check
app.get('/gupshup', (req, res) => {
  res.status(200).send('✅ Gupshup webhook live');
});

// Main Gupshup POST endpoint
app.post('/gupshup', async (req, res) => {
  const payload = req.body;
  const from = payload.sender?.phone;
  const incomingMsg = payload.message?.text?.trim().toLowerCase();

  // Accept sandbox-start event
  if (payload.type === "sandbox-start") {
    return res.sendStatus(200);
  }

  if (!from || !incomingMsg) return res.sendStatus(200); // Acknowledge empty or unknown data

  let reply = '🤖 Welcome to BasePay!';

  if (!wallets[from]) {
    const wallet = ethers.Wallet.createRandom();
    wallets[from] = wallet;
    if (!greetedUsers.has(from)) {
      greetedUsers.add(from);
      reply = `👋 Hello! Wallet created: ${wallet.address}\nType /start to explore.`;
    }
  }

  if (incomingMsg === '/start') {
    reply = `🚀 *Welcome to BasePay*\n/start\n/balance\n/receive\n/send USDC address amount\n/rain USDC amount`;
  } else if (incomingMsg === '/receive') {
    reply = `📥 Address: ${wallets[from].address}`;
  } else if (incomingMsg === '/balance') {
    const addr = wallets[from].address;
    const [eth, usdc, usdt] = await Promise.all([
      provider.getBalance(addr).then(b => ethers.formatEther(b)),
      getTokenBalance(addr, USDC),
      getTokenBalance(addr, USDT)
    ]);
    reply = `💼 Balance:\nETH: ${eth}\nUSDC: ${usdc}\nUSDT: ${usdt}`;
  }

  // Respond immediately to Gupshup
  res.json({ type: "text", message: reply });
});

async function getTokenBalance(address, tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const raw = await contract.balanceOf(address);
  return ethers.formatUnits(raw, 6);
}

app.listen(PORT, () => console.log(`🚀 BasePay Gupshup bot on port ${PORT}`));
