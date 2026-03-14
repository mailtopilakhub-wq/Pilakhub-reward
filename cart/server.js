const express = require("express");
const admin = require("firebase-admin");

const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com"
});

const db = admin.database();

const FREE_DELIVERY = 500;
const REMINDER_DELAY = 2 * 60 * 60 * 1000;

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

app.get("/", (req,res)=>{
  res.send("PilakHub cart reminder server running");
});

app.get("/cartReminder", async (req,res)=>{

  let success = 0;
  let failed = 0;
  let skipped = 0;

  try{

    const usersSnap = await db.ref("users").once("value");
    const users = usersSnap.val();

    const productsSnap = await db.ref("products").once("value");
    const products = productsSnap.val() || {};

    for(const uid in users){

      const user = users[uid];

      if(!user.cart){
        skipped++;
        continue;
      }

      if(!user.fcm_token){
        skipped++;
        continue;
      }

      /* Calculate cart total */

      let cartTotal = 0;

      for(const productId in user.cart){

        const qty = user.cart[productId] || 1;

        const product = products[productId];

        if(product && product.price){
          cartTotal += product.price * qty;
        }

      }

      if(cartTotal <= 0){
        skipped++;
        continue;
      }

      const remaining = Math.max(0, FREE_DELIVERY - cartTotal);

      /* Correct reminder logic */

      if(user.lastCartReminder !== undefined){

        const diff = Date.now() - user.lastCartReminder;

        if(diff < REMINDER_DELAY){
          skipped++;
          continue;
        }

      }

      const template = templates[Math.floor(Math.random()*templates.length)];

      const message = template
        .replace("{cart}", cartTotal)
        .replace("{remaining}", remaining);

      try{

        /* FCM push */

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

        /* Personal notification */

        const notifRef = db.ref(`users/${uid}/notifications`).push();

        await notifRef.set({
          title:"PilakHub Cart Reminder",
          body:message,
          type:"cart_reminder",
          screen:"cart",
          timestamp: Date.now(),
          read:false
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

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("Server running on port",PORT);
});
