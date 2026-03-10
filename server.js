const express = require("express");
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com"
});

const db = admin.database();
const app = express();

app.get("/", (req,res)=>{
  res.send("PilakHub Notification Server Running");
});

app.get("/checkRewards", async (req,res)=>{

  const snapshot = await db.ref("users").once("value");
  const users = snapshot.val();

  const now = Date.now();
  const rewardDelay = 2 * 60 * 60 * 1000;

  for(const uid in users){

    const user = users[uid];

    if(!user.last_gift_claim || !user.fcm_token) continue;

    if(now - user.last_gift_claim >= rewardDelay){

      try{

        await admin.messaging().send({
          notification:{
            title:"🎁 Reward Available",
            body:`${user.name}, your reward is ready!`
          },
          token:user.fcm_token
        });

      }catch(err){
        console.log(err);
      }

    }

  }

  res.send("Reward check complete");

});

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("Server running");
});
