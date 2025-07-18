const { Configuration, OpenAIApi } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

// ENV vars from Vercel dashboard
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// Vercel-style default export
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const incomingMsg = req.body.Body?.trim();
    const from = req.body.From;

    // Save message in Supabase
    await supabase.from('messages').insert([{ sender: from, message: incomingMsg, type: 'text' }]);

    let reply = "👋 Hey! I'm BaseBro, your WhatsApp crypto buddy.";

    if (/send|escrow|tip|rain/i.test(incomingMsg)) {
      const ai = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: `Parse and summarize this crypto instruction: "${incomingMsg}"` }],
      });

      reply = ai.data.choices[0].message.content;
    }

    // Send back via WhatsApp
    await twilioClient.messages.create({
      body: reply,
      from: `whatsapp:${process.env.TWILIO_NUMBER}`,
      to: from,
    });

    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    res.status(500).send('Internal Server Error');
  }
};
// api/webhook.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  console.log('Incoming message:', req.body);

  // Just echo back message (Twilio will retry if no 200)
  res.status(200).send('OK');
}
