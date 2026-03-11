const admin = require('firebase-admin');
const serviceAccount = require('../service_account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, title, message, type } = req.body;

  const payload = {
    token: token,
    notification: { title, body: message },
    data: { type: type || 'payment', screen: 'wallet' }
  };

  try {
    const response = await admin.messaging().send(payload);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
