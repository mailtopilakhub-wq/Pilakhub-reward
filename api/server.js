const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Initialize Firebase Admin with Environment Variable
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

app.post('/send-notification', async (req, res) => {
  const { token, title, message, type } = req.body;

  if (!token) return res.status(400).json({ error: 'Token is required' });

  const payload = {
    token: token,
    notification: { title, body: message },
    data: { type: type || 'payment', screen: 'wallet' }
  };

  try {
    await admin.messaging().send(payload);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
