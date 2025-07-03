require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

const client = twilio(accountSid, authToken);

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDT = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)"
];

const wallets = {}; // In-memory wallets

app.get('/webhook', (req, res) => {
  res.status(200).send('✅ Webhook up and running!');
});

function parseSendCommand(text) {
  const parts = text.trim().split(' ');
  return {
    command: parts[0].toLowerCase(),
    token: parts[1]?.toUpperCase(),
    to: parts[2],
    amount: parts[3]
  };
}

async function getBalance(tokenAddress, userAddress, decimals = 6) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const bal = await token.balanceOf(userAddress);
  return ethers.formatUnits(bal, decimals);
}

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.trim();
  const from = req.body.From;

  console.log(`Received: "${incomingMsg}" from ${from}`);
  let reply = '🤖 Welcome to BasePay Bot! Built on Base.';

  if (!incomingMsg) return res.sendStatus(400);

  if (incomingMsg.toLowerCase() === '/start') {
    if (!wallets[from]) {
      const newWallet = ethers.Wallet.createRandom();
      wallets[from] = newWallet;
      reply = `👋 Wallet created!\nAddress: ${newWallet.address}`;
    } else {
      reply = '✅ Wallet already exists. Use /help to see available commands.';
    }
  } else if (incomingMsg.toLowerCase() === '/help') {
    reply = `📖 *BasePay Help Menu*\n/start – Create wallet\n/balance – Check balances\n/receive – Show address\n/send TOKEN ADDRESS AMOUNT\n/tip TOKEN AMOUNT\n/rain TOKEN AMOUNT`;
  } else if (incomingMsg.toLowerCase() === '/balance') {
    if (!wallets[from]) {
      reply = '❌ You need to /start first.';
    } else {
      const addr = wallets[from].address;
      const [eth, usdc, usdt] = await Promise.all([
        provider.getBalance(addr).then(b => ethers.formatEther(b)),
        getBalance(USDC, addr),
        getBalance(USDT, addr)
      ]);
      reply = `💼 ${addr}\nETH: ${eth}\nUSDC: ${usdc}\nUSDT: ${usdt}`;
    }
  } else if (incomingMsg.toLowerCase() === '/receive') {
    if (!wallets[from]) {
      reply = '❌ Use /start first.';
    } else {
      reply = `📥 Address: ${wallets[from].address}`;
    }
  } else if (incomingMsg.toLowerCase().startsWith('/send')) {
    if (!wallets[from]) {
      reply = '❌ Use /start first.';
    } else {
      const { token, to, amount } = parseSendCommand(incomingMsg);
      const tokenAddress = token === 'USDC' ? USDC : token === 'USDT' ? USDT : null;
      if (!tokenAddress || !ethers.isAddress(to)) {
        reply = '❌ Invalid token or address format. Example: /send USDC 0xabc... 1.5';
      } else {
        try {
          const sender = wallets[from].connect(provider);
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, sender);
          const tx = await tokenContract.transfer(to, ethers.parseUnits(amount, 6));
          await tx.wait();
          reply = `✅ Sent ${amount} ${token} to ${to}`;
        } catch (err) {
          reply = `❌ Send failed: ${err.message}`;
        }
      }
    }
  } else if (incomingMsg.toLowerCase().startsWith('/tip')) {
    if (!wallets[from]) {
      reply = '❌ You need to /start first.';
    } else {
      const { token, amount } = parseSendCommand(incomingMsg);
      const users = Object.keys(wallets).filter(u => u !== from);
      if (users.length === 0) {
        reply = '⚠ No one to tip yet.';
      } else {
        const to = users[Math.floor(Math.random() * users.length)];
        const recipient = wallets[to].address;
        const tokenAddress = token === 'USDC' ? USDC : token === 'USDT' ? USDT : null;
        try {
          const sender = wallets[from].connect(provider);
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, sender);
          const tx = await tokenContract.transfer(recipient, ethers.parseUnits(amount, 6));
          await tx.wait();
          reply = `🎁 You tipped ${amount} ${token} to a random user (${recipient})!`;
        } catch (err) {
          reply = `❌ Tip failed: ${err.message}`;
        }
      }
    }
  } else if (incomingMsg.toLowerCase().startsWith('/rain')) {
    if (!wallets[from]) {
      reply = '❌ You need to /start first.';
    } else {
      const { token, amount } = parseSendCommand(incomingMsg);
      const recipients = Object.keys(wallets).filter(u => u !== from);
      if (recipients.length === 0) {
        reply = '⚠ No users to rain on yet.';
      } else {
        const tokenAddress = token === 'USDC' ? USDC : token === 'USDT' ? USDT : null;
        const splitAmount = parseFloat(amount) / recipients.length;
        try {
          const sender = wallets[from].connect(provider);
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, sender);
          for (const u of recipients) {
            const tx = await tokenContract.transfer(wallets[u].address, ethers.parseUnits(splitAmount.toString(), 6));
            await tx.wait();
          }
          reply = `🌧 Rained ${amount} ${token} equally on ${recipients.length} users!`;
        } catch (err) {
          reply = `❌ Rain failed: ${err.message}`;
        }
      }
    }
  }

  // Send reply
  await client.messages.create({
    body: reply,
    from: fromNumber,
    to: from
  });

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 BasePay bot live on port ${PORT}`);
});
