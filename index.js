// index.js - BaseBro WhatsApp Bot
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { MessagingResponse } = require("twilio").twiml;
const { createClient } = require("@supabase/supabase-js");
const { Configuration, OpenAIApi } = require("openai");
const { ethers } = require("ethers");
const { parseMessage } = require("./lib/parser");
const { sendUSDC, sendETH, checkBalance, lockEscrow, releaseEscrow } = require("./lib/chain");
const { createSmartAccount } = require("./lib/wallet");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);

app.post("/whatsapp", async (req, res) => {
  const twiml = new MessagingResponse();
  const msg = req.body.Body.trim().toLowerCase();
  const from = req.body.From.replace("whatsapp:", "");

  // 1. Create wallet if new user
  let { data: user, error } = await supabase.from("users").select("*").eq("phone", from).single();
  if (!user) {
    if (msg.includes("bro")) {
      const smartWallet = await createSmartAccount(from);
      await supabase.from("users").insert({ phone: from, address: smartWallet });
      twiml.message(`👋 Welcome to BaseBro!
Your smart wallet is ready: ${smartWallet}

💸 Say "send 2 usdc to @raj" or "balance" to begin!`);
    } else {
      twiml.message(`👋 Welcome to BaseBro!
We're your crypto bro for gasless, smart account-based payments on WhatsApp.

💡 Say "bro" to create your wallet now.`);
    }
    return res.send(twiml.toString());
  }

  // 2. Check balance
  if (msg.includes("balance")) {
    const bal = await checkBalance(user.address);
    twiml.message(`💰 Balance for ${user.address}:
${bal}`);
    return res.send(twiml.toString());
  }

  // 3. Transaction history
  if (msg.includes("history")) {
    const { data: txs } = await supabase.from("transactions").select("*").eq("phone", from);
    if (!txs || txs.length === 0) {
      twiml.message("📜 No transaction history yet.");
    } else {
      let msgText = "📜 Transaction History:\n";
      txs.forEach(t => {
        msgText += `• ${t.type} ${t.amount} ${t.token} to ${t.to} (${t.status})\n`;
      });
      twiml.message(msgText);
    }
    return res.send(twiml.toString());
  }

  // 4. Parse message with OpenAI
  const parsed = await parseMessage(msg, openai);
  if (parsed.type === "send") {
    const result = parsed.token === "usdc"
      ? await sendUSDC(user.address, parsed.to, parsed.amount)
      : await sendETH(user.address, parsed.to, parsed.amount);

    await supabase.from("transactions").insert({
      phone: from,
      type: "send",
      amount: parsed.amount,
      token: parsed.token,
      to: parsed.to,
      status: result.success ? "sent" : "failed"
    });

    twiml.message(result.success
      ? `✅ Sent ${parsed.amount} ${parsed.token.toUpperCase()} to ${parsed.to}`
      : `❌ Failed to send ${parsed.token}`);
    return res.send(twiml.toString());
  }

  // 5. P2P Escrow Lock
  if (parsed.type === "escrow") {
    const locked = await lockEscrow(user.address, parsed.to, parsed.amount);
    await supabase.from("transactions").insert({
      phone: from,
      type: "escrow",
      amount: parsed.amount,
      token: parsed.token,
      to: parsed.to,
      status: locked ? "locked" : "fail"
    });
    twiml.message(locked
      ? `🔒 Locked ${parsed.amount} ${parsed.token} in escrow with ${parsed.to}`
      : `❌ Escrow failed`);
    return res.send(twiml.toString());
  }

  // 6. Group Tip / Rain
  if (parsed.type === "tip" || parsed.type === "rain") {
    // Simulated group tip
    twiml.message(`🎉 Tipped ${parsed.amount} ${parsed.token} to random group members!`);
    return res.send(twiml.toString());
  }

  // 7. Unknown
  twiml.message("🤖 Sorry, I didn’t understand that. Try: \n- 'send 2 usdc to @raj'\n- 'balance'\n- 'history'\n- 'escrow 5 eth to @anil'");
  res.send(twiml.toString());
});

app.listen(3000, () => console.log("🚀 BaseBro running on port 3000"));
