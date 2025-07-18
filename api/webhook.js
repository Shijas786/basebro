import { parseMessage } from '../lib/ai';
import { createOrGetWallet } from '../lib/wallet';
import { sendETH, sendUSDC, tipGroup, rainGroup, startEscrow } from '../lib/chain';
import supabase from '../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const message = req.body.Body?.trim();
  const from = req.body.From;

  const { reply, action } = await parseMessage(message);

  const user = await createOrGetWallet(from);

  // Example: Handle /send command
  if (action === 'send') {
    await sendETH(user, reply.to, reply.amount);
  }

  // Save message to Supabase
  await supabase.from('messages').insert([
    { sender: from, message, type: action }
  ]);

  res.setHeader('Content-Type', 'text/xml');
  res.send(`
    <Response>
      <Message>${reply.text}</Message>
    </Response>
  `);
}
