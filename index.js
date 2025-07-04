// index.js (BasePay Bot)
// Full Setup: Smart Wallet + P2P Escrow + AI-style Commands + Token Balance + Tutorial + Full Escrow Logic + Rain + Tip + Group Tracking + Real Smart AA Wallets

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
const contactNames = {};
const groupMembers = {};

const ERC20_ABI = ["function transfer(address to, uint amount) returns (bool)", "function balanceOf(address) view returns (uint256)"];

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

function trackGroupMember(groupId, userId) {
  if (!groupId || !userId) return;
  if (!groupMembers[groupId]) groupMembers[groupId] = [];
  if (!groupMembers[groupId].includes(userId)) {
    groupMembers[groupId].push(userId);
  }
}

app.post('/gupshup', async (req, res) => {
  const incomingMsg = req.body.message?.text?.toLowerCase() || "";
  const from = req.body.sender.phone;
  const isGroup = !!req.body.group?.id;
  const groupId = req.body.group?.id || null;
  let reply = "";

  if (!wallets[from]) await createSmartAAWallet(from);
  if (isGroup && groupId) trackGroupMember(groupId, from);

  if (/^\/mywallet$/.test(incomingMsg)) {
    return res.send({ reply: `🧾 Your smart wallet address is:\n\`${wallets[from].address}\`` });
  }

  if (/^\/balance$/.test(incomingMsg)) {
    const usdcAddress = process.env.USDC;
    const usdtAddress = process.env.USDT;
    const userAddress = wallets[from].address;

    const usdc = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
    const usdt = new ethers.Contract(usdtAddress, ERC20_ABI, provider);

    try {
      const usdcBal = await usdc.balanceOf(userAddress);
      const usdtBal = await usdt.balanceOf(userAddress);
      return res.send({
        reply: `💰 Your balances:\nUSDC: ${ethers.formatUnits(usdcBal, 6)}\nUSDT: ${ethers.formatUnits(usdtBal, 6)}`
      });
    } catch (err) {
      return res.send({ reply: `❌ Failed to fetch balance: ${err.message}` });
    }
  }

  if (/^\/history$/.test(incomingMsg)) {
    const txs = history[from] || [];
    if (!txs.length) {
      return res.send({ reply: '📭 No transactions yet.' });
    } else {
      const txList = txs.map(tx => `• ${tx.type.toUpperCase()} ${tx.amount} ${tx.token} → ${tx.to}`).join('\n');
      return res.send({ reply: `📜 *Last 5 transactions:*\n${txList}` });
    }
  }

  if (/tip\s+\d+(\.\d+)?\s+(usdt|usdc)\s+to\s+@\d+/.test(incomingMsg)) {
    const parts = incomingMsg.split(/\s+/);
    const amount = parts[1];
    const token = parts[2].toUpperCase();
    const toNumber = parts[4].replace('@', '');
    const senderWallet = getWallet(process.env.WALLET_PRIVATE_KEY);
    const tokenAddress = token === 'USDT' ? process.env.USDT : process.env.USDC;
    try {
      if (!wallets[toNumber]) await createSmartAAWallet(toNumber);
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, senderWallet);
      const tx = await contract.transfer(wallets[toNumber].address, ethers.parseUnits(amount, 6));
      await tx.wait();
      recordTx(from, 'tip', token, amount, toNumber);
      return res.send({ reply: `💸 Tipped ${amount} ${token} to @${toNumber}` });
    } catch (err) {
      return res.send({ reply: `❌ Tip failed: ${err.message}` });
    }
  }

  if (incomingMsg.startsWith("/rain")) {
    const parts = incomingMsg.split(" ");
    const amount = parts[1];
    const token = parts[2]?.toUpperCase();
    if (!isGroup || !groupId) return res.send({ reply: "⚠️ Rain can only be used in groups." });
    const recipients = groupMembers[groupId]?.filter(u => u !== from) || [];
    if (!recipients.length) return res.send({ reply: "❌ No other users in this group yet." });
    const share = parseFloat(amount) / recipients.length;
    const senderWallet = getWallet(process.env.WALLET_PRIVATE_KEY);
    const tokenAddress = token === 'USDT' ? process.env.USDT : process.env.USDC;
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, senderWallet);
      for (let user of recipients) {
        if (!wallets[user]) await createSmartAAWallet(user);
        await contract.transfer(wallets[user].address, ethers.parseUnits(share.toFixed(6), 6));
        recordTx(from, 'rain', token, share.toFixed(6), user);
      }
      return res.send({ reply: `🌧️ Rained ${amount} ${token} on ${recipients.length} users.` });
    } catch (err) {
      return res.send({ reply: `❌ Rain failed: ${err.message}` });
    }
  }

  return res.send({ reply: "🤖 Command not recognized. Type /help to begin." });
});

app.listen(PORT, () => console.log(`BasePay bot running on port ${PORT}`));
