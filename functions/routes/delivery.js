const express = require("express");
const router = express.Router();
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const { default: Axios } = require("axios");
const { checkRequestKey} = require("./keys");

// new 
router.post("/calculate_delivery", async (req, res) => {
  try {
    // check if the request is authorized
    let authorized = await checkRequestKey(req.headers.authorization);
    if(authorized){
      const client = new SecretManagerServiceClient();

      // get the credential keys
      accessSecretVersion = async () => {
        const [googleKey] = await client.accessSecretVersion({
          name: "projects/369761240989/secrets/GOOGLE_API_KEY/versions/latest",
        });
    
        // get the data and put it into a string
        const google_key = googleKey.payload.data.toString();
    
        // we are going to assign the key to a variable to be used later
        return { google_key };
      };
    
      let { google_key } = await accessSecretVersion();
    
      let { lat, lng} = req.body;
    
      let distanceResult = await Axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial
          &origins=42.2742,-71.0244
          &destinations=${lat},${lng}
          &key=${google_key}`);
          
          // calculate the delivery fee base on the distance
          let mile = distanceResult.data.rows[0].elements[0].distance.value / 1609.34;
        
          // convert km to mile
          let deliveryFee = 0; // initize delivery fee
        
          // if distance is less than 1.5 mile the delivery fee will be $2
          if (mile < 2) {
            deliveryFee = 2.0;
          // if distance is between 1.5 and 5 the delivery fee will be the distance rounded
          } else if (mile >= 2 && mile <= 4.5) {
            deliveryFee = Math.round(mile);
          // anything above 6miles are too far to be delivery
          } else {
            res.status(400).send({error: 'The address is too far, can not be delivery by the restaurant.'})
            return;
          }
            
          res.status(200).send({ result: deliveryFee });
    } else {
      res.status(400).send({ error: 'The request is denied by the server.'});
    }

  } catch (error) {
    console.log(error);
    res.status(400).send({ error: 'Failed to calculate delivery fee, try again later.'})
  }
}) 


module.exports = router;
