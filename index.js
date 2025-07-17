// index.js – BasePay (WhatsApp + AI + Supabase + Escrow + Gasless)
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');
const { createSmartAccountClient } = require('@biconomy/account');
const OpenAI = require("openai");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3000;

// Setup: Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Setup: OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Setup: Blockchain
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC);
const USDC = process.env.USDC_ADDRESS;
const ERC20_ABI = ["function balanceOf(address) view returns (uint)", "function transfer(address,uint) returns (bool)"];

// Setup: Escrow Contract
const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS;
const ESCROW_ABI = [
  "function lock(address token, address receiver, uint amount) public",
  "function release(uint escrowId) public",
  "function cancel(uint escrowId) public"
];

// Health check
app.get('/', (req, res) => {
  res.send('✅ BasePay running on WhatsApp + Escrow + AI');
});

// WhatsApp webhook (from Twilio)
app.post('/twilio', async (req, res) => {
  const from = req.body.From?.replace('whatsapp:', '').trim();
  const rawMsg = req.body.Body?.trim();
  if (!from || !rawMsg) return res.send('<Response></Response>');

  console.log(`📩 ${from}: ${rawMsg}`);

  // Step 1: Load/create user wallet
  let { data: user } = await supabase.from('users').select('*').eq('phone', from).single();
  let signer;

  if (!user) {
    const wallet = ethers.Wallet.createRandom();
    signer = wallet.connect(provider);
    await supabase.from('users').insert({
      phone: from,
      wallet_pk: wallet.privateKey,
      address: wallet.address
    });
  } else {
    signer = new ethers.Wallet(user.wallet_pk, provider);
  }

  // Step 2: Parse AI message
  const aiReply = await parseMessage(rawMsg, from, signer);

  // Step 3: Send response back to WhatsApp
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${aiReply}</Message></Response>`);
});

async function parseMessage(msg, from, signer) {
  try {
    const prompt = `You are a blockchain assistant. Convert this WhatsApp message into a JSON action:\n"${msg}"\nRespond ONLY with:\n{action: "balance"}\n{action: "receive"}\n{action: "send", token: "usdc", to: "+91xxxx", amount: "5"}\n{action: "escrow", token: "usdc", to: "+91xxxx", amount: "3"}`;

    const ai = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const json = JSON.parse(ai.choices[0].message.content);

    if (json.action === "balance") {
      return await checkBalance(signer);
    }

    if (json.action === "receive") {
      return `📥 Your wallet address:\n${signer.address}`;
    }

    if (json.action === "send") {
      const { data: receiver } = await supabase.from('users').select('*').eq('phone', json.to).single();
      if (!receiver) return `⚠️ User ${json.to} not found on BasePay.`;
      const tx = await sendUSDC(signer, receiver.address, json.amount);
      return `✅ Sent ${json.amount} USDC to ${json.to}\n🔗 Tx: https://basescan.org/tx/${tx}`;
    }

    if (json.action === "escrow") {
      const { data: receiver } = await supabase.from('users').select('*').eq('phone', json.to).single();
      if (!receiver) return `⚠️ User ${json.to} not found.`;
      const escrowId = await lockEscrow(signer, receiver.address, json.amount);
      return `🔐 Escrow of ${json.amount} USDC created.\nEscrow ID: ${escrowId}`;
    }

    return "❓ Unknown action.";
  } catch (e) {
    console.error('❌ AI parse error:', e);
    return "🤖 Sorry, I couldn't understand your request.";
  }
}

async function checkBalance(signer) {
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);
  const raw = await usdc.balanceOf(signer.address);
  const ethBal = await provider.getBalance(signer.address);
  return `💰 Balance:\nETH: ${(ethBal / 1e18).toFixed(4)}\nUSDC: ${ethers.formatUnits(raw, 6)}`;
}

async function sendUSDC(signer, to, amount) {
  const smartAccount = await createSmartAccountClient({
    signer,
    chainId: 8453,
    bundlerUrl: process.env.BICONOMY_BUNDLER_URL,
    paymaster: {
      paymasterUrl: `https://paymaster.biconomy.io/api/v1/${process.env.BICONOMY_API_KEY}`
    }
  });

  const iface = new ethers.Interface(ERC20_ABI);
  const tx = {
    to: USDC,
    data: iface.encodeFunctionData("transfer", [to, ethers.parseUnits(amount, 6)])
  };

  const op = await smartAccount.sendTransaction(tx);
  return await op.waitForTxHash();
}

async function lockEscrow(signer, receiver, amount) {
  const escrow = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
  const tx = await escrow.lock(USDC, receiver, ethers.parseUnits(amount, 6));
  const receipt = await tx.wait();
  return receipt.logs[0].topics[1]; // Escrow ID
}

app.listen(PORT, () => {
  console.log(`🚀 BasePay WhatsApp P2P running on http://localhost:${PORT}`);
});
