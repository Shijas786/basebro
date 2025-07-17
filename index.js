// index.js (BasePay with Supabase + P2P + AI + Escrow)
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const { createSmartAccountClient } = require('@biconomy/account');
const { Configuration, OpenAIApi } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3000;

// Supabase setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// OpenAI setup
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Blockchain + Biconomy
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC);
const USDC = process.env.USDC_ADDRESS;
const ERC20_ABI = ["function balanceOf(address) view returns (uint)", "function transfer(address,uint) returns (bool)"];

// Escrow Contract (deployed separately)
const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS;
const ESCROW_ABI = [
  "function lock(address token, address receiver, uint amount) public",
  "function release(uint escrowId) public",
  "function cancel(uint escrowId) public"
];

app.get('/', (req, res) => {
  res.send('✅ BasePay P2P + AI + Escrow with Supabase running');
});

app.post('/twilio', async (req, res) => {
  const from = req.body.From?.replace('whatsapp:', '').trim();
  const rawMsg = req.body.Body?.trim();
  if (!from || !rawMsg) return res.send('<Response></Response>');

  console.log(`📩 ${from}: ${rawMsg}`);

  // Fetch or create wallet
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

  const aiReply = await parseMessage(rawMsg, from, signer);

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${aiReply}</Message></Response>`);
});

async function parseMessage(msg, from, signer) {
  try {
    const prompt = `You are a blockchain bot assistant. Convert the following WhatsApp message into an intent:\n"${msg}"\nRespond ONLY with a JSON like {action: "send", token: "usdc", to: "+91xxxx", amount: "5"} or {action: "balance"} or {action: "receive"}`;

    const ai = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const json = JSON.parse(ai.data.choices[0].message.content);
    if (json.action === "balance") {
      return await checkBalance(signer);
    } else if (json.action === "receive") {
      return `📥 Wallet: ${signer.address}`;
    } else if (json.action === "send") {
      const { data: receiver } = await supabase.from('users').select('*').eq('phone', json.to).single();
      if (!receiver) return `⚠️ User ${json.to} not registered on BasePay.`;
      const tx = await sendUSDC(signer, receiver.address, json.amount);
      return `✅ Sent ${json.amount} USDC to ${json.to}\nTx: https://basescan.org/tx/${tx}`;
    } else if (json.action === "escrow") {
      const { data: receiver } = await supabase.from('users').select('*').eq('phone', json.to).single();
      if (!receiver) return `⚠️ User ${json.to} not registered.`;
      const escrowId = await lockEscrow(signer, receiver.address, json.amount);
      return `🔐 Escrow created with ID ${escrowId}`;
    }
  } catch (e) {
    console.error('AI parse error:', e);
    return "🤖 Sorry, I couldn't understand that.";
  }
}

async function checkBalance(signer) {
  const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);
  const raw = await usdc.balanceOf(signer.address);
  return `💰 Balance:\nETH: ${(await provider.getBalance(signer.address)) / 1e18}\nUSDC: ${ethers.formatUnits(raw, 6)}`;
}

async function sendUSDC(signer, to, amount) {
  const smartAccount = await createSmartAccountClient({
    signer,
    chainId: 8453,
    bundlerUrl: process.env.BICONOMY_BUNDLER_URL,
    paymaster: { paymasterUrl: `https://paymaster.biconomy.io/api/v1/${process.env.BICONOMY_API_KEY}` },
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
  return receipt.logs[0].topics[1];
}

app.listen(PORT, () => console.log(`🚀 BasePay P2P bot live on port ${PORT}`));
