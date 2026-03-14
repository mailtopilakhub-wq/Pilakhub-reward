const express = require("express");
const admin = require("firebase-admin");

const app = express();

/* Firebase Service Account from Render ENV */

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com"
});

const db = admin.database();

const FREE_DELIVERY = 500;
const REMINDER_DELAY = 2 * 60 * 60 * 1000; // 2 hours

/* Notification templates */

const templates = [

"🛒 Items worth ₹{cart} are waiting in your cart.",
"🚚 Add ₹{remaining} more to unlock FREE delivery.",
"Great picks! Your cart total is ₹{cart}.",
"Only ₹{remaining} more needed for free delivery.",
"⚡ Hurry! Items worth ₹{cart} are still in your cart.",
"🔥 Your cart worth ₹{cart} is waiting for checkout.",
"🎯 Only ₹{remaining} left for FREE delivery!",
"Don't miss out! ₹{cart} items still in cart.",
"Checkout now! Your cart total is ₹{cart}.",
"Add ₹{remaining} more to get free delivery."

];

/* Home route */

app.get("/", (req,res)=>{
  res.send("PilakHub cart reminder server running");
});


/* Cron endpoint */

app.get("/cartReminder", async (req,res)=>{

  let success = 0;
  let failed = 0;
  let skipped = 0;

  try{

    const snapshot = await db.ref("users").once("value");
    const users = snapshot.val();

    if(!users){
      return res.send("success 0\nfailed 0\nskipped 0");
    }

    for(const uid in users){

      const user = users[uid];

      /* Skip if cart missing */

      if(!user.cart){
        skipped++;
        continue;
      }

      /* Skip if no token */

      if(!user.fcm_token){
        skipped++;
        continue;
      }

      /* Calculate cart total */

      let cartTotal = 0;

      Object.values(user.cart).forEach(item=>{
        cartTotal += (item.price || 0) * (item.quantity || 1);
      });

      if(cartTotal <= 0){
        skipped++;
        continue;
      }

      const remaining = Math.max(0, FREE_DELIVERY - cartTotal);

      /* Only skip if lastCartReminder exists AND within 2 hours */

      if(user.lastCartReminder){

        const lastReminder = user.lastCartReminder;

        if(Date.now() - lastReminder < REMINDER_DELAY){
          skipped++;
          continue;
        }

      }

      /* Random template */

      const template = templates[Math.floor(Math.random()*templates.length)];

      const message = template
        .replace("{cart}",cartTotal)
        .replace("{remaining}",remaining);

      try{

        await admin.messaging().send({
          token:user.fcm_token,
          notification:{
            title:"PilakHub Cart Reminder",
            body:message
          },
          data:{
            type:"cart_reminder",
            screen:"cart"
          }
        });

        success++;

        await db.ref(`users/${uid}`).update({
          lastCartReminder: Date.now()
        });

      }catch(err){

        failed++;

      }

    }

    res.send(`success ${success}\nfailed ${failed}\nskipped ${skipped}`);

  }catch(err){

    res.send(`success ${success}\nfailed ${failed}\nskipped ${skipped}`);

  }

});


/* Start server */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("Server running on port",PORT);
});
