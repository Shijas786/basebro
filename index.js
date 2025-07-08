// index.js (BasePay Bot for Gupshup + Biconomy Sponsorship)
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const { BiconomySmartAccount, Bundler } = require('@biconomy/account');

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

async function createSmartAAWallet(userId) {
  const signer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  const bundler = new Bundler({
    bundlerUrl: process.env.BICONOMY_BUNDLER,
    chainId: 8453,
    entryPointAddress: process.env.ENTRYPOINT
  });

  const config = {
    signer,
    chainId: 8453,
    bundler,
    entryPointAddress: process.env.ENTRYPOINT,
    factoryAddress: process.env.BICONOMY_FACTORY
  };

  const smartAccount = await BiconomySmartAccount.create(config);
  const address = await smartAccount.getAccountAddress();
  wallets[userId] = { address, smartAccount };
  return address;
}

async function getTokenBalance(address, tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const raw = await contract.balanceOf(address);
  return ethers.formatUnits(raw, 6);
}

app.post('/gupshup', async (req, res) => {
  const payload = req.body;
  const from = payload.sender?.phone;
  const incomingMsg = payload.message?.text?.trim().toLowerCase();
  if (!from || !incomingMsg) return res.sendStatus(400);

  let reply = '🤖 Welcome to BasePay!';

  if (!wallets[from]) {
    await createSmartAAWallet(from);
    if (!greetedUsers.has(from)) {
      greetedUsers.add(from);
      reply = `👋 Welcome to *BasePay*\n🪙 Your smart wallet is ready: *${wallets[from].address}*\nType /start to explore.`;
    }
  }

  if (incomingMsg === '/start') {
    reply = `🚀 *Welcome to BasePay*\n\nUse commands:\n/start\n/balance\n/receive\n/send USDC address amount\n/tip USDC amount\n/rain USDC amount`;
  }

  if (incomingMsg === '/receive') {
    reply = `📥 Your wallet address: ${wallets[from].address}`;
  }

  if (incomingMsg === '/balance') {
    const addr = wallets[from].address;
    const [eth, usdc, usdt] = await Promise.all([
      provider.getBalance(addr).then(b => ethers.formatEther(b)),
      getTokenBalance(addr, USDC),
      getTokenBalance(addr, USDT)
    ]);
    reply = `💼 Balance:\nETH: ${eth}\nUSDC: ${usdc}\nUSDT: ${usdt}`;
  }

  res.json({ type: "text", message: reply });
});

app.get('/gupshup', (req, res) => {
  res.send('✅ Gupshup webhook working!');
});

app.listen(PORT, () => console.log(`🚀 BasePay Gupshup bot running on port ${PORT}`));
app.get('/', (req, res) => {
  res.send('✅ BasePay Bot is running.');
});