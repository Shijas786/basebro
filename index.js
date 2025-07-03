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
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

const client = twilio(accountSid, authToken);

// ERC20 token contract addresses
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)"
];

const wallets = {}; // In-memory user wallets for demo purposes

async function getBalance(tokenAddress, userAddress, decimals = 6) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const bal = await token.balanceOf(userAddress);
  return ethers.formatUnits(bal, decimals);
}

// Webhook for WhatsApp messages
app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body.trim();
  const from = req.body.From;

  console.log(`Received: "${incomingMsg}" from ${from}`);
  let reply = '🤖 Welcome to BasePay Bot!';

  if (incomingMsg.toLowerCase() === '/start') {
    if (!wallets[from]) {
      const newWallet = ethers.Wallet.createRandom();
      wallets[from] = newWallet;
      reply = `🎉 Wallet created!\nAddress: ${newWallet.address}`;
    } else {
      reply = '✅ Wallet already exists.';
    }
  } else if (incomingMsg.toLowerCase() === '/balance') {
    if (!wallets[from]) {
      reply = '❌ You need to /start first to create your wallet.';
    } else {
      const address = wallets[from].address;
      const [eth, usdc, usdt] = await Promise.all([
        provider.getBalance(address).then(b => ethers.formatEther(b)),
        getBalance(USDC, address, 6),
        getBalance(USDT, address, 6)
      ]);
      reply = `💼 Balance for ${address}\nETH: ${eth}\nUSDC: ${usdc}\nUSDT: ${usdt}`;
    }
  } else if (incomingMsg.toLowerCase().startsWith('/receive')) {
    if (!wallets[from]) {
      reply = '❌ You need to /start first to create your wallet.';
    } else {
      const addr = wallets[from].address;
      const qr = await QRCode.toDataURL(addr);
      reply = `📥 Your address: ${addr}\n(Send tokens to this address)`;
    }
  } else if (incomingMsg.toLowerCase().startsWith('/send')) {
    const parts = incomingMsg.split(' ');
    if (parts.length !== 4) {
      reply = '❌ Format: /send token address amount';
    } else if (!wallets[from]) {
      reply = '❌ You need to /start first to create your wallet.';
    } else {
      const token = parts[1].toLowerCase();
      const to = parts[2];
      const amt = parts[3];
      const wallet = wallets[from].connect(provider);
      const contractAddr = token === 'usdc' ? USDC : token === 'usdt' ? USDT : null;
      const decimals = 6;

      if (!contractAddr) {
        reply = '❌ Unsupported token. Use usdc or usdt.';
      } else {
        const contract = new ethers.Contract(contractAddr, ERC20_ABI, wallet);
        const tx = await contract.transfer(to, ethers.parseUnits(amt, decimals));
        reply = `✅ Sent ${amt} ${token.toUpperCase()} to ${to}\nTx: ${tx.hash}`;
      }
    }
  } else if (incomingMsg.toLowerCase().startsWith('/tip')) {
    const parts = incomingMsg.split(' ');
    if (parts.length !== 3) {
      reply = '❌ Format: /tip token amount';
    } else if (!wallets[from]) {
      reply = '❌ You need to /start first to create your wallet.';
    } else {
      const token = parts[1].toLowerCase();
      const amt = parts[2];
      const contractAddr = token === 'usdc' ? USDC : token === 'usdt' ? USDT : null;
      const decimals = 6;
      const wallet = wallets[from].connect(provider);

      if (!contractAddr) {
        reply = '❌ Unsupported token. Use usdc or usdt.';
      } else {
        // Tip everyone else (excluding sender)
        const recipients = Object.entries(wallets).filter(([k]) => k !== from);
        const eachAmt = ethers.parseUnits((amt / recipients.length).toFixed(6), decimals);
        const contract = new ethers.Contract(contractAddr, ERC20_ABI, wallet);
        for (const [user, w] of recipients) {
          await contract.transfer(w.address, eachAmt);
        }
        reply = `💸 Tipped ${amt} ${token.toUpperCase()} equally to ${recipients.length} users.`;
      }
    }
  } else if (incomingMsg.toLowerCase().startsWith('/rain')) {
    const parts = incomingMsg.split(' ');
    if (parts.length !== 3) {
      reply = '❌ Format: /rain token amount';
    } else if (!wallets[from]) {
      reply = '❌ You need to /start first to create your wallet.';
    } else {
      const token = parts[1].toLowerCase();
      const amt = parts[2];
      const contractAddr = token === 'usdc' ? USDC : token === 'usdt' ? USDT : null;
      const decimals = 6;
      const wallet = wallets[from].connect(provider);

      if (!contractAddr) {
        reply = '❌ Unsupported token. Use usdc or usdt.';
      } else {
        const recipients = Object.entries(wallets).filter(([k]) => k !== from);
        const eachAmt = ethers.parseUnits((amt / recipients.length).toFixed(6), decimals);
        const contract = new ethers.Contract(contractAddr, ERC20_ABI, wallet);
        for (const [user, w] of recipients) {
          await contract.transfer(w.address, eachAmt);
        }
        reply = `🌧️ Rained ${amt} ${token.toUpperCase()} on ${recipients.length} users.`;
      }
    }
  } else {
    reply = '⚙️ Unknown command. Try /start, /balance, /receive, /send, /tip, /rain.';
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
  console.log(`🚀 BasePay bot live on port ${PORT}`);
});
