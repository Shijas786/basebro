// Minimal Gupshup webhook test (no wallet logic)
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/gupshup', (req, res) => {
  console.log('✅ Gupshup POST received:', req.body);
  res.json({
    type: 'text',
    message: '✅ Gupshup webhook is working!'
  });
});

app.get('/gupshup', (req, res) => {
  res.send('✅ Gupshup GET webhook is live');
});

app.listen(PORT, () => {
  console.log(`🚀 Minimal Gupshup bot live on port ${PORT}`);
});
