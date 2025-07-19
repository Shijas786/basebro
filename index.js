require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const supabase = require('./lib/supabase'); // ✅ This file should create and export the Supabase client

const { parseMessage } = require('./lib/ai');
const { createOrGetWallet } = require('./lib/wallet');
const { sendETH, sendUSDC, tipGroup, rainGroup, startEscrow } = require('./lib/chain');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));


const findWalletByNameOrPhone = async (query) => {
  let { data, error } = await supabase
    .from('users')
    .select('wallet_address')
    .ilike('name', `%${query}%`)
    .maybeSingle();

  if (data?.wallet_address) return data.wallet_address;

  let { data: data2 } = await supabase
    .from('users')
    .select('wallet_address')
    .eq('phone', query)
    .maybeSingle();

  return data2?.wallet_address || null;
};

const registerUser = async (phone, name, walletAddress) => {
  await supabase
    .from('users')
    .upsert([{ phone, name, wallet_address: walletAddress }], {
      onConflict: ['phone'],
    });
};

const logMessage = async (phone, message, type = 'text') => {
  await supabase.from('messages').insert([{ phone, message, type }]);
};

app.post('/webhook', async (req, res) => {
  const msg = req.body.Body?.trim();
  const from = req.body.From?.replace('whatsapp:', '');
  const name = req.body.ProfileName || 'User';

  await logMessage(from, msg);

  const reply = (text) => res.send(`<Response><Message>${text}</Message></Response>`);

  const { wallet, smartAccount } = await createOrGetWallet(from);
  await registerUser(from, name, smartAccount.address);

  if (!msg) return reply('❌ No message received.');
  if (msg.toLowerCase() === 'hi' || msg.toLowerCase().includes('bro')) {
    return reply(`👋 Hey ${name}! I'm BaseBro, your crypto buddy.\n\nTry:\n• Send 5 USDC to Priya\n• Tip group 0.1 ETH\n• Lock 10 USDC in escrow`);
  }

  const parsed = await parseMessage(msg);
  if (!parsed) return reply('🤖 Sorry, I couldn’t understand. Try saying “Send 1 USDC to Arjun”.');

  try {
    if (parsed.action === 'send') {
      const to = await findWalletByNameOrPhone(parsed.to);
      if (!to) return reply(`❌ Couldn’t find wallet for: ${parsed.to}`);
      const tx = parsed.token === 'ETH'
        ? await sendETH(smartAccount, to, parsed.amount)
        : await sendUSDC(smartAccount, to, parsed.amount);
      return reply(`✅ Sent ${parsed.amount} ${parsed.token} to ${parsed.to}\n🔗 ${tx}`);
    }

    if (parsed.action === 'tip') {
      const tx = await tipGroup(smartAccount, parsed.amount, parsed.token);
      return reply(`💸 Tipped group: ${parsed.amount} ${parsed.token}\n🔗 ${tx}`);
    }

    if (parsed.action === 'rain') {
      const tx = await rainGroup(smartAccount, parsed.amount, parsed.token);
      return reply(`🌧️ Rained on group: ${parsed.amount} ${parsed.token}\n🔗 ${tx}`);
    }

    if (parsed.action === 'escrow') {
      const tx = await startEscrow(smartAccount, parsed.amount, parsed.token);
      return reply(`🔒 Locked in escrow: ${parsed.amount} ${parsed.token}\n🔗 ${tx}`);
    }

    return reply('🤖 Unrecognized command. Try “Send 2 USDC to +911234567890”');
  } catch (err) {
    console.error(err);
    return reply('⚠️ Something went wrong: ' + err.message);
  }
});

app.listen(3000, () => console.log('🚀 BaseBro running on http://localhost:3000'));
// 👇 Home route serves the landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ Start the server only if not in serverless (Vercel handles it differently)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 BaseBro running on http://localhost:${PORT}`);
  });
}

module.exports = app; // For Vercel serverless
