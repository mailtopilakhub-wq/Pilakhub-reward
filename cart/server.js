const express = require("express");
const admin = require("firebase-admin");

const app = express();

/* Firebase service account from Render ENV */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://pilakhub-default-rtdb.firebaseio.com"
});

const db = admin.database();

const FREE_DELIVERY = 500;
const REMINDER_DELAY = 2 * 60 * 60 * 1000; // 2 hours

/* Cart reminder templates */

const cartTemplates = [

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

/* Empty cart templates */

const emptyCartTemplates = [

"🛍️ It's time to fill your cart with awesome products we have!",
"Discover amazing deals today. Start filling your cart now!",
"Your next favorite product is waiting. Add items to your cart.",
"Browse PilakHub and add something exciting to your cart!",
"🔥 Trending products are waiting for you. Start shopping!"

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

    const usersSnap = await db.ref("users").once("value");
    const users = usersSnap.val();

    const productsSnap = await db.ref("products").once("value");
    const products = productsSnap.val() || {};

    for(const uid in users){

      const user = users[uid];

      if(!user.fcm_token){
        skipped++;
        continue;
      }

      let message = "";
      let cartTotal = 0;

      /* If user has cart */

      if(user.cart){

        for(const productId in user.cart){

          const qty = user.cart[productId] || 1;

          const product = products[productId];

          if(product && product.price){
            cartTotal += product.price * qty;
          }

        }

      }

      /* If cart empty */

      if(cartTotal === 0){

        message = emptyCartTemplates[
          Math.floor(Math.random()*emptyCartTemplates.length)
        ];

      }else{

        const remaining = Math.max(0, FREE_DELIVERY - cartTotal);

        const template = cartTemplates[
          Math.floor(Math.random()*cartTemplates.length)
        ];

        message = template
          .replace("{cart}",cartTotal)
          .replace("{remaining}",remaining);

      }

      /* Skip if reminder sent within 2 hours */

      if(user.lastCartReminder !== undefined){

        const diff = Date.now() - user.lastCartReminder;

        if(diff < REMINDER_DELAY){
          skipped++;
          continue;
        }

      }

      try{

        /* FCM push */

        await admin.messaging().send({
          token:user.fcm_token,
          notification:{
            title:"PilakHub",
            body:message
          },
          data:{
            type:"cart_reminder",
            screen:"cart",
            message:message
          }
        });

        /* Personal notification */

        const notifRef = db.ref(`users/${uid}/notifications`).push();

        await notifRef.set({
          title:"PilakHub",
          message:message,
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


/* Start server */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
  console.log("Server running on port",PORT);
});
