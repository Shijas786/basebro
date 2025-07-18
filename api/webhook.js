// api/webhook.js

import { Configuration, OpenAIApi } from "openai";
import twilio from "twilio";

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const body = req.body;
    const message = body.Body;
    const from = body.From;

    console.log("📩 WhatsApp message:", message);

    const prompt = `Extract intent from this crypto WhatsApp command:\n"${message}"\nReturn JSON like: { "action": "send", "amount": "1", "token": "USDC", "to": "0xabc..." }`;

    const gpt = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    });

    const parsed = gpt.data.choices[0].message.content.trim();

    await twilioClient.messages.create({
      body: `✅ Got your message:\n"${message}"\n\n🤖 Parsed as:\n${parsed}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: from,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ error: "Server crash" });
  }
}
