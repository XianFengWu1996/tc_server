const express = require('express');
const router = express.Router();
const randomstring = require('randomstring')
const { getSquareSecret, checkRequestKey} = require('./keys')
const { Client, Environment } = require('square'); 
const admin = require("firebase-admin");

const { time }= require('./time')


router.post('/partial_refund', async (req, res) => {
    try {
        const { timestamp } = time();
        const { amount, order, env } = req.body

        if(order.paymentId){
            let { SQ_TOKEN } = await getSquareSecret(env === 'development' ? 'DEV' : 'PROD');
      
            const client = new Client({
                environment: env === 'development' ? Environment.Sandbox : Environment.Production,
                accessToken: SQ_TOKEN,
            })

           await client.refundsApi.refundPayment({
                idempotencyKey: randomstring.generate(18),
                amountMoney: {
                    amount: amount,
                    currency: 'USD'
                } ,
                paymentId: order.paymentId,
            }).catch(error => {
                throw new Error(error.result.errors[0].detail);
            })
        }
     
        admin.firestore().runTransaction(async(transaction) => { 
            let { point, pointDetails } = (await transaction.get(admin.firestore().collection(`users/${order.userId}/rewards`).doc('points'))).data();
            let { rewardPercentage } = (await transaction.get(admin.firestore().collection('admin').doc('details'))).data().server;

            // handle setting refund to order and customer
            transaction.update(admin.firestore().collection(`order/${order.year}/${order.month}`).doc(`${order.orderId}`), {
                refund_amount: amount,
                refund: true,
                total: order.total - amount
            })
            transaction.update(admin.firestore().collection(`users/${order.userId}/order`).doc(`${order.orderId}`), {
                refund_amount: amount,
                refund: true,
                total: order.total - amount
            })
            // Handle reward points    
            // reward will contain point and pointDetails 

            let pointToDeduct = Math.round(amount * (order.method === 'Cash' ? rewardPercentage.cashReward : rewardPercentage.cardReward / 100) * 100 / 100);

            point = point - pointToDeduct;

            pointDetails.unshift({
                'action': 'subtract',
                'amount': pointToDeduct,
                'createdAt': timestamp,
                'orderId': order.orderId,
                'method': order.method === 'Cash' ? 'cash' : 'card',
                'refund': true,
                'cancel': false,  
            })

            transaction.update(admin.firestore().collection(`users/${order.userId}/rewards`).doc('points'), {
                point,
                pointDetails,
            })
        }).catch((error) => {
            throw new Error(error.message ? error.message : 'Something went wrong with firebase')
        })


        res.send({ message: 'Payment has been sucessfully cancelled.'})
      } catch (error) {
        console.log(error)
        res.send({ error: error.message ? error.message : 'Failed to refund, try again later.'})
      }
})

module.exports = router;
