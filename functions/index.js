const admin = require('firebase-admin')
admin.initializeApp();

const express = require('express');
const cors = require("cors");

const app = express();
const functions = require('firebase-functions');

const delivery = require('./routes/delivery');
const payment  = require('./routes/payment');
const order  = require('./routes/order');
const menu  = require('./routes/menu');
const auth  = require('./routes/auth');
const restaurant = require('./routes/restaurant')
const { time } = require('./routes/time');
const { getSquareSecret, } = require('./routes/keys');
const { Client, Environment } = require('square');

app.use(cors({ origin: '*'}));

app.use('/delivery', delivery);
app.use('/payment', payment);
app.use('/order', order);
app.use('/menu', menu);
app.use('/auth', auth);
app.use('/restaurant', restaurant);


exports.app = functions.https.onRequest(app);

exports.payment_processing = functions.pubsub.schedule('45 22 * * *')
  .timeZone('America/New_York') // Users can choose timezone - default is America/Los_Angeles
  .onRun( async (context) => {
    try {
      const { SQ_TOKEN } = await getSquareSecret('PROD');
      const { month, day } = time();
  
      const client = new Client({
        environment: Environment.Production,
        accessToken: SQ_TOKEN,
      })
    
      // new
      let newUnprocess = (await admin.firestore().collection('unprocessPayment').doc(`${month}${day}`).get()).data().paymentId;
      newUnprocess.map( async (paymentId) => {
        await client.paymentsApi.completePayment(paymentId, { }).catch((e) => {
          console.log(e)
        });
      })
    } catch (error) {
      console.error(error)
    }
});

