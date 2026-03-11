const admin = require('firebase-admin');

// We use an environment variable instead of a file
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { token, title, message, type } = req.body;

  try {
    await admin.messaging().send({
      token,
      notification: { title, body: message },
      data: { type: type || 'payment' }
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
