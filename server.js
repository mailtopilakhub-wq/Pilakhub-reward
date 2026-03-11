const express = require("express");
const admin = require("firebase-admin");
const bodyParser = require('body-parser');

const app = express();app.use(bodyParser.json());

// Load Firebase service account from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com" // Ensure this matches your DB URL
});

const db = admin.database();

// 1. Root Test Route
app.get("/", (req, res) => {
  res.send("PilakHub Reward Server is Online");
});

// 2. Manual Payment Notification (Called by Android App)
app.post('/send-notification', async (req, res) => {
  const { token, title, message, type } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    await admin.messaging().send({
      token: token,
      notification: { title, body: message },
      data: { type: type || 'payment', screen: 'wallet' }
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Cron Job Endpoint (Check for available rewards every 2 hours)
app.get("/checkRewards", async (req, res) => {
  try {
    const snapshot = await db.ref("users").once("value");
    const users = snapshot.val();
    if (!users) return res.send("No users found.");

    const now = Date.now();
    const rewardDelay = 2 * 60 * 60 * 1000; // 2 hours
    const todayStart = new Date().setHours(0, 0, 0, 0);
    let sentCount = 0;

    for (const uid in users) {
      const user = users[uid];
      if (!user.fcm_token || !user.last_gift_claim) continue;
      if (user.reward_notified === true) continue;

      // Check daily limit (2.0 P-Coins)
      const dailySum = (user.last_sum_update < todayStart) ? 0 : (user.daily_reward_sum || 0);
      if (dailySum >= 2.0) continue; 

      // Check if 2 hours have passed
      if (now - user.last_gift_claim >= rewardDelay) {
        try {
          await admin.messaging().send({
            token: user.fcm_token,
            notification: {
              title: "🎁 Lucky Giftbox Ready!",
              body: `Hi ${user.name || 'User'}, your giftbox is ready to open. Claim your P-Coins now!`
            },
            data: { type: "reward", screen: "wallet" }
          });

          sentCount++;
          await db.ref(`users/${uid}`).update({ reward_notified: true });
        } catch (err) {
          console.error(`FCM Error for ${uid}:`, err.message);
        }
      }
    }
    res.send(`Notifications sent: ${sentCount}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
