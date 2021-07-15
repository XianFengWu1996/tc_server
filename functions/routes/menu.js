const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { time } = require('./time');

// retrieve the menu for the users
router.get('/get', async (req, res) => {
    try {
        // The logic here is to limit the number of request made to firestore
        // - prevent the user to make a request every time the website is refresh
        // - prevent the menu to be store in Redux store but never gets refresh unless the store gets reset
        // - the expiration can be change in the server, which means we can control how often the menu gets refresh
        // - the expiration also allows us to control the number of time the request will be call

        // set a timestamp for when the next request should be. 
        // Ex. the expiration will be 1 day, the next request will not be called until the next day 
        const { expiration } = time();
        
        // retrieve the lunch collection 
        let lunch = await admin.firestore().collection('menu').doc('lunch').collection('details').get();
        let temp_lunch = [];
        lunch.docs.map((doc) => {
            temp_lunch.push(doc.data());
        })

        // retrieve the fullday collection
        let fullday = await admin.firestore().collection('menu').doc('fullday').collection('details').get();
        let temp_full = [];
        fullday.docs.map((doc) => {
            temp_full.push(doc.data());
        })

        res.status(200).send({ 
            lunch: temp_lunch, 
            fullday: temp_full, 
            expiration,
            storeTime: time().storeTime
        });

    } catch (error) {
        console.log(error)
        res.status(200).send({ error: "Failed to obtain menu info." })
    }

});

// can set up for functionality to edit the menu or add dish in the future

module.exports = router;