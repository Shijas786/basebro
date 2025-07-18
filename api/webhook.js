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
    return res.status(405).send('Only POST requests allowed');
  }

  try {
    console.log('Twilio payload:', req.body);

    // Send a response back
    return res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('Error in webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
