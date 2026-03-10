const express = require("express");
const admin = require("firebase-admin");

const app = express();

/* Load Firebase Service Account from Render ENV */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com"
});

const db = admin.database();

/* Test route */
app.get("/", (req, res) => {
  res.send("PilakHub reward notification server running");
});

/* Reward check route */
app.get("/checkRewards", async (req, res) => {

  try {

    const snapshot = await db.ref("users").once("value");
    const users = snapshot.val();

    if (!users) {
      return res.send("No users found");
    }

    const now = Date.now();
    const rewardDelay = 2 * 60 * 60 * 1000; // 2 hours

    for (const uid in users) {

      const user = users[uid];

      if (!user.last_gift_claim) continue;
      if (!user.fcm_token) continue;

      const lastClaim = user.last_gift_claim;

      /* Prevent duplicate notifications */
      if (user.reward_notified === true) continue;

      if (now - lastClaim >= rewardDelay) {

        try {

          await admin.messaging().send({
            token: user.fcm_token,
            notification: {
              title: "🎁 Daily Gift Available!",
              body: `Hi ${user.name}, your lucky giftbox is ready! Claim your P-Coins now.`
            },
            data: {
              screen: "wallet"
            }
          });

          console.log("Notification sent to:", user.name);

          /* Mark notification sent */
          await db.ref(`users/${uid}`).update({
            reward_notified: true
          });

        } catch (err) {

          console.log("FCM Error:", err);

        }

      }

    }

    res.send("Reward check completed");

  } catch (error) {

    console.log(error);
    res.status(500).send("Server error");

  }

});

/* Start server */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
