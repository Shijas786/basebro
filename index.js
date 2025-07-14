const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3000;

// Blockchain Setup
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC);
const wallets = {};
const greetedUsers = new Set();

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';

// ✅ Health Check
app.get('/', (req, res) => {
  res.status(200).send('✅ BasePay server running. Use POST /twilio for webhook.');
});

// ✅ Twilio Webhook (POST)
app.post('/twilio', async (req, res) => {
  const from = req.body.From?.replace('whatsapp:', '').trim();
  const incomingMsg = req.body.Body?.trim().toLowerCase();

  console.log('📩 Incoming:', from, incomingMsg);

  if (!from || !incomingMsg) {
    console.log('⚠️ Empty or malformed message');
    return res.send('<Response></Response>');
  }

  // Create wallet if not exists
  if (!wallets[from]) {
    const wallet = ethers.Wallet.createRandom();
    wallets[from] = wallet;
  }

  let reply = '🤖 Welcome to BasePay!';

  if (incomingMsg === '/start') {
    reply = `🚀 *Welcome to BasePay*\n\nCommands:\n/start\n/balance\n/receive`;
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

  // ✅ Respond using TwiML XML
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

// Token Balance Fetch
async function getTokenBalance(address, tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const raw = await contract.balanceOf(address);
  return ethers.formatUnits(raw, 6); // USDC/USDT decimals
}

app.listen(PORT, () => {
  console.log(`🚀 BasePay running with Twilio on port ${PORT}`);
});
