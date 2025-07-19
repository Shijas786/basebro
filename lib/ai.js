// lib/ai.js
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function parseMessage(messageText) {
  const prompt = `
You are a crypto assistant. A user sends you a WhatsApp message like "send 2 USDC to @shijas" or "start escrow with +918888888888 for 5 ETH".

Extract the command from the message in structured JSON format with fields:
{
  "action": "send" | "escrow" | "tip" | "rain" | "history",
  "token": "ETH" | "USDC",
  "amount": number,
  "to": "phone number or username"
}

Message: "${messageText}"
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  });

  const response = completion.choices[0].message.content;

  try {
    return JSON.parse(response);
  } catch (err) {
    return { action: 'unknown', raw: response };
  }
}

module.exports = { parseMessage };
