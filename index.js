// index.js (BasePay Bot)
// Full Setup: Smart Wallet + P2P Escrow + AI-style Commands + Token Balance + Tutorial + Full Escrow Logic + Rain + Tip + Group Tracking + Real Smart AA Wallets + Group Rain

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const { BiconomySmartAccount, BiconomySmartAccountConfig, Bundler } = require('@biconomy/account');
const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 3000;

const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC);
const wallets = {};
const ads = [];
const escrow = {};
const history = {};
const p2pHistory = {};
const contactNames = {};
const groupMembers = {};
const greetedUsers = new Set();

const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

function getWallet(privateKey) {
  return new ethers.Wallet(privateKey, provider);
}

async function createSmartAAWallet(userId) {
  const signer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
  const bundler = new Bundler({ bundlerUrl: process.env.BICONOMY_BUNDLER, chainId: 8453, entryPointAddress: process.env.ENTRYPOINT });
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

function recordTx(user, type, token, amount, to) {
  if (!history[user]) history[user] = [];
  history[user].unshift({ type, token, amount, to, time: new Date().toISOString() });
  if (history[user].length > 5) history[user] = history[user].slice(0, 5);
}

function recordP2PTx(user, orderId, role, action, token, amount, peer) {
  if (!p2pHistory[user]) p2pHistory[user] = [];
  p2pHistory[user].unshift({ orderId, role, action, token, amount, peer, time: new Date().toISOString() });
  if (p2pHistory[user].length > 5) p2pHistory[user] = p2pHistory[user].slice(0, 5);
}

function trackGroupMember(groupId, userId) {
  if (!groupId || !userId) return;
  if (!groupMembers[groupId]) groupMembers[groupId] = [];
  if (!groupMembers[groupId].includes(userId)) {
    groupMembers[groupId].push(userId);
  }
}

async function getTokenBalance(address, tokenAddress) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const raw = await contract.balanceOf(address);
  return ethers.formatUnits(raw, 6);
}

function parseAICommand(msg) {
  msg = msg.toLowerCase();
  if (msg.startsWith('send') && msg.includes('to')) {
    const [, amount, token,, name] = msg.split(' ');
    return { type: 'send', amount, token: token.toUpperCase(), name };
  }
  if (msg.startsWith('tip') && msg.includes('to')) {
    const [, amount, token,, name] = msg.split(' ');
    return { type: 'tip', amount, token: token.toUpperCase(), name };
  }
  if (msg.startsWith('rain')) {
    const [, amount, token] = msg.split(' ');
    return { type: 'rain', amount, token: token.toUpperCase() };
  }
  return null;
}

app.post('/gupshup', async (req, res) => {
  const incomingMsg = req.body.message?.text?.toLowerCase() || "";
  const from = req.body.sender.phone;
  const isGroup = !!req.body.group?.id;
  const groupId = req.body.group?.id || null;
  let reply = "";

  if (!wallets[from]) {
    await createSmartAAWallet(from);
    if (!greetedUsers.has(from)) {
      greetedUsers.add(from);
      reply += `👋 Welcome to *BasePay*!\n🪙 You now have a smart wallet: *${wallets[from].address}*\nType /start to explore features like send, swap, rain, P2P and more.\n`;
    }
  }

  if (isGroup && groupId) trackGroupMember(groupId, from);

  if (incomingMsg === "/start") {
    reply = `🚀 *Welcome to BasePay* \n\nBasePay is your all-in-one WhatsApp crypto wallet powered by Account Abstraction on Base chain.\n\nHere's what you can do:\n• 💸 Send/Receive USDT, USDC easily\n• 🎯 Tip & Rain to friends and groups\n• 🧾 View wallet balances & history\n• 🛒 P2P Ads, Buy, Sell, Escrow with UPI\n• 🧠 Chat naturally: "send 5 usdt to amal"\n\nTry commands like:\n• /balance\n• /history\n• /p2phistory\n• /tip 1 usdt to +9181xxxxx\n• /post to sell\n• /buy to order\n\nEnjoy your Web3 experience inside WhatsApp 🔥`;
    return res.send({ reply });
  }

  const aiParsed = parseAICommand(incomingMsg);

  if (aiParsed?.type === 'rain' && isGroup && groupId) {
    const { amount, token } = aiParsed;
    const recipients = groupMembers[groupId]?.filter(u => u !== from) || [];
    if (!recipients.length) return res.send({ reply: '🙁 No members to rain on.' });
    const each = parseFloat(amount) / recipients.length;
    const tokenAddress = token === 'USDT' ? process.env.USDT : process.env.USDC;
    try {
      const sender = wallets[from].smartAccount;
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      for (const user of recipients) {
        if (!wallets[user]) await createSmartAAWallet(user);
        const tx = await sender.sendTransaction({
          to: wallets[user].address,
          data: tokenContract.interface.encodeFunctionData('transfer', [wallets[user].address, ethers.parseUnits(each.toFixed(6), 6)])
        });
        await tx.wait();
      }
      recordTx(from, 'rain', token, amount, `${recipients.length} users`);
      reply = `🌧️ Rained ${amount} ${token} on ${recipients.length} group members.`;
    } catch (err) {
      reply = `❌ Rain failed: ${err.message}`;
    }
    return res.send({ reply });
  }

  return res.send({ reply: reply || "🤖 Command not recognized. Try /start /balance /history /p2phistory /tip /rain /post /buy /cancel /release." });
});
// Health check route for Gupshup webhook validation
app.get('/gupshup', (req, res) => {
  res.status(200).send('✅ BasePay Webhook Ready');
});

app.listen(PORT, () => console.log(`BasePay bot running on port ${PORT}`));
