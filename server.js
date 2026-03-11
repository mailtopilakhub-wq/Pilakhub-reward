const express = require("express");
const admin = require("firebase-admin");
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Load Firebase service account from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com"
});

const db = admin.database();

app.get("/", (req, res) => {
  res.send("PilakHub Reward Server is Online");
});

// Manual Payment Notification (Called by Android App)
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

// Cron Job Endpoint (Check for available rewards)
app.get("/checkRewards", async (req, res) => {
  try {
    console.log("Cron job started: Checking rewards...");
    const snapshot = await db.ref("users").once("value");
    const users = snapshot.val();
    
    if (!users) {
        console.log("No users found in database.");
        return res.send("Notifications sent: 0 (No users)");
    }

    const now = Date.now();
    const rewardDelay = 2 * 60 * 60 * 1000; // 2 hours
    const todayStart = new Date().setHours(0, 0, 0, 0);
    let sentCount = 0;

    for (const uid in users) {
      const user = users[uid];
      
      // Skip if no FCM token
      if (!user.fcm_token) continue;

      // CASE 1: NEW USER (No wallet activity yet)
      // If they haven't claimed and haven't been notified to register
      if (user.last_gift_claim === undefined) {
        if (user.reward_notified === undefined) {
          try {
            await admin.messaging().send({
              token: user.fcm_token,
              notification: {
                title: "🎁 Start Earning P-Coins!",
                body: `Hi ${user.name || 'User'}, open the app and register your wallet to start claiming lucky gifts!`
              },
              data: { type: "registration", screen: "wallet" }
            });
            sentCount++;
            await db.ref(`users/${uid}`).update({ reward_notified: true });
            console.log(`[Reg] Notified new user: ${uid}`);
          } catch (err) {
            console.error(`FCM Error (New User) ${uid}:`, err.message);
          }
        }
        continue; // Don't check rewards for users with no claims
      }

      // CASE 2: REGISTERED USER (Waiting for next 2-hour window)
      // Check if they need a notification (reward_notified is false OR missing)
      if (user.reward_notified === true) continue;

      // Check daily limit (2.0 P-Coins)
      const dailySum = (user.last_sum_update < todayStart) ? 0 : (user.daily_reward_sum || 0);
      if (dailySum >= 2.0) {
          // If they reached limit, we don't notify but we might want to reset the flag for tomorrow
          continue; 
      }

      // Check if 2 hours passed since last claim
      if (now - user.last_gift_claim >= rewardDelay) {
        try {
          await admin.messaging().send({
            token: user.fcm_token,
            notification: {
              title: "🎁 Lucky Giftbox Ready!",
              body: `Hi ${user.name || 'User'}, your giftbox is ready! Claim your P-Coins now.`
            },
            data: { type: "reward", screen: "wallet" }
          });
          
          sentCount++;
          await db.ref(`users/${uid}`).update({ reward_notified: true });
          console.log(`[Reward] Notified ready user: ${uid}`);
        } catch (err) {
          console.error(`FCM Error (Reward) ${uid}:`, err.message);
        }
      }
    }

    console.log(`Cron job finished. Sent: ${sentCount}`);
    res.send(`Notifications sent: ${sentCount}`);

  } catch (error) {
    console.error("Critical Server Error:", error);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
