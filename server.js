const express = require("express");
const admin = require("firebase-admin");

const app = express();

// Load Firebase credentials from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com"
});

const db = admin.database();

// Health check route
app.get("/", (req, res) => {
  res.send("PilakHub reward server OK");
});

// Cron endpoint
app.get("/checkRewards", async (req, res) => {

  try {

    const snapshot = await db.ref("users").once("value");
    const users = snapshot.val();

    if (!users) {
      return res.send("OK");
    }

    const now = Date.now();
    const rewardDelay = 2 * 60 * 60 * 1000; // 2 hours

    let sent = 0;

    for (const uid in users) {

      const user = users[uid];

      if (!user.last_gift_claim) continue;
      if (!user.fcm_token) continue;
      if (user.reward_notified === true) continue;

      if (now - user.last_gift_claim >= rewardDelay) {

        try {

          await admin.messaging().send({
            token: user.fcm_token,
            notification: {
              title: "🎁 Daily Gift Available!",
              body: `Hi ${user.name}, your lucky giftbox is ready!`
            },
            data: {
              screen: "wallet"
            }
          });

          sent++;

          await db.ref(`users/${uid}`).update({
            reward_notified: true
          });

        } catch (err) {
          // silent error to keep response small
        }

      }

    }

    // very small response
    res.send("OK");

  } catch (error) {

    res.send("OK");

  }

});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server started");
});
