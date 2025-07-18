// api/webhook.js

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  try {
    console.log('Incoming Message:', req.body);

    // ✅ You can handle Twilio WhatsApp message here
    // For now, just return success
    return res.status(200).json({ message: 'Received!' });
  } catch (err) {
    console.error('Webhook Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
