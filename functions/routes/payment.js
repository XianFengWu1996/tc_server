const express = require("express");
const router = express.Router();
const randomstring = require("randomstring");
const { getSquareSecret, checkRequestKey } = require("./keys");
const { Client, Environment } = require("square");
const admin = require("firebase-admin");
const { time } = require("./time");

// new
router.post("/register_card", async (req, res) => {
  try {
    let authorized = await checkRequestKey(req.headers.authorization);

    if (authorized) {
      let { billing, nonce, customer, user, env } = req.body;
      let { customerId, cards } = billing;

      let development = env === "development";

      let { SQ_TOKEN } = await getSquareSecret(development ? "DEV" : "PROD");

      const client = new Client({
        environment: development
          ? Environment.Sandbox
          : Environment.Production,
        accessToken: SQ_TOKEN,
      });

      // create a customer id if customer dont have one
      if (customerId == "") {
        var customerResult = await client.customersApi.createCustomer({
          idempotencyKey: randomstring.generate(18),
          givenName: customer.name,
          phoneNumber: customer.phone,
          emailAddress: user.email,
        });
        customerId = customerResult.result.customer.id;
      }

      // save card for the customer
      var cardResult = await client.customersApi.createCustomerCard(
        customerId,
        {
          cardNonce: nonce,
          cardholderName: customer.name,
        }
      );

      let { card } = cardResult.result;
      let temp_card = cards;

      temp_card.push({
        brand: card.cardBrand,
        lastFourDigit: card.last4,
        cofId: card.id,
        month: card.expMonth,
        year: card.expYear,
      });

      await admin
        .firestore()
        .collection(
          `${development ? "usersTest" : "users"}/${
            user.userId
          }/customer`
        )
        .doc("details")
        .update({
          billing: {
            customerId: customerId,
            cards: temp_card,
          },
        });

      res.status(200).send({
        customerId: customerId,
        card: {
          brand: card.cardBrand,
          lastFourDigit: card.last4,
          cofId: card.id,
          month: card.expMonth,
          year: card.expYear,
        },
      });
    } else {
      res.status(400).send({ error: "Not authorized" });
    }
  } catch (error) {
    console.log(error)
    let tempError = "";

    if (error.result) {
      switch (error.result.errors[0].code) {
        case "VERIFY_CVV_FAILURE":
          tempError = "The CVV entered is incorrect.";
          break;
        case "VERIFY_AVS_FAILURE":
          tempError = "The postal code is invalid.";
          break;
        case "CARD_EXPIRED":
          tempError =
            "The card issuer declined the request because the card is expired.";
          break;
        case "INVALID_CARD":
          tempError =
            "The credit card cannot be validated based on the provided details.";
          break;
        case "INVALID_EXPIRATION":
          tempError = "The expiration date for the payment card is invalid.";
          break;
        case "INVALID_CARD_DATA":
          tempError = "The provided card data is invalid.";
          break;
        default:
          tempError =
            "Unexpected error occur while processing the credit card.";
          break;
      }
    }

    res
      .status(400)
      .send({ error: tempError != "" ? tempError : "Failed to save card" });
  }
});

router.post("/create_customer", async (req, res) => {
  try {
    let authorized = await checkRequestKey(req.headers.authorization);

    if (authorized) {
      const { name, phone, email, userId, cards, env } = req.body;

      let development = env === "development";

      let { SQ_TOKEN } = await getSquareSecret(development ? "DEV" : "PROD");

      const client = new Client({
        environment: development
          ? Environment.Sandbox
          : Environment.Production,
        accessToken: SQ_TOKEN,
      });

      // create a customer id if customer dont have one
      var customerResult = await client.customersApi.createCustomer({
        idempotencyKey: randomstring.generate(18),
        givenName: name,
        phoneNumber: phone,
        emailAddress: email,
      });

      if (customerResult.result.customer) {
        await admin
          .firestore()
          .collection(
            `${
              development ? "usersTest" : "users"
            }/${userId}/customer`
          )
          .doc("details")
          .update({
            billing: {
              customerId: customerResult.result.customer.id,
              cards: cards,
            },
          });
        res.status(200).send({ customerId: customerResult.result.customer.id });
      }
    } else {
      res.status(400).send({ error: "Not authorized" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: "Failed to create user..try again later.." });
  }
});

router.post("/remove_card", async (req, res) => {
  try {
    let authorized = await checkRequestKey(req.headers.authorization);

    if (authorized) {
      const { card, cards, customerId, userId, env } = req.body;
      let development = env === 'development';

      let { SQ_TOKEN } = await getSquareSecret(
        development ? "DEV" : "PROD"
      );

      const client = new Client({
        environment:
          development ? Environment.Sandbox : Environment.Production,
        accessToken: SQ_TOKEN,
      });

      await client.customersApi.deleteCustomerCard(customerId, card.cofId);

      let result = cards.filter((e) => e.cofId != card.cofId);

      await admin
        .firestore()
        .collection(`${development ? 'usersTest' : 'users'}/${userId}/customer`)
        .doc("details")
        .update({
          billing: {
            customerId: customerId,
            cards: result,
          },
        });

      res.status(200).send({ result: result});
    } else {
      res.status(400).send({ error: "Request has been denied by the server." });
    }
  } catch (error) {
    console.log(error)

    res.status(400).send({
      error: error.message
        ? error.message
        : "Failed to delete the credit card from Square, try again later.",
    });
  }
});

module.exports = router;
