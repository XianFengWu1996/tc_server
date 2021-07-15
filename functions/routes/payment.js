const express = require("express");
const router = express.Router();
const randomstring = require("randomstring");
const { getSquareSecret, checkRequestKey } = require("./keys");
const { Client, Environment } = require("square");
const admin = require("firebase-admin");
const { time } = require("./time");

router.post("/processing", async (req, res) => {
  try {
    const { storeIsOpen } = time();

    if (storeIsOpen) {
      let authorized = await checkRequestKey(req.headers.authorization);

      if (authorized) {
        // CREDIT CARD PAYMENT WITH SQUARE
        // STEP 1
        // information pass from req.body should include:
        // - node enviroment    production || development
        const { source_id, amount, tip, customer_id, env } = req.body;
        // every new create payment request will need to have a different idempotency key
        const idem_key = randomstring.generate(18);

        let { SQ_TOKEN } = await getSquareSecret(
          env === "development" ? "DEV" : "PROD"
        );

        const client = new Client({
          environment:
            env === "development"
              ? Environment.Sandbox
              : Environment.Production,
          accessToken: SQ_TOKEN,
        });
        //STEP 2
        // Set up the config and information need for the payment api
        // Send back the result: the order id and payment id
        // if fail, check for the possible error and send the error back

        let body = {
          sourceId: source_id,
          idempotencyKey: idem_key,
          amountMoney: {
            amount: Math.round((amount - tip) * 100),
            currency: "USD",
          },
          tipMoney: {
            amount: Math.round(tip * 100),
            currency: "USD",
          },
          autocomplete: false,
          customerId: customer_id,
        };

        client.paymentsApi
          .createPayment(body)
          .then((result) => {
            res.send({
              square_payment_id: result.result.payment.id,
              square_order_id: result.result.payment.orderId,
            });
          })
          .catch((error) => {
            switch (error.result.errors[0].code) {
              case "CVV_FAILURE":
                res.send({ error: "The CVV entered is incorrect" });
                break;
              case "BAD_EXPIRATION":
                res.send({
                  error:
                    "The card expiration date is either missing or incorrectly formatted.",
                });
                break;
              case "ADDRESS_VERIFICATION_FAILURE":
                res.send({ error: "The postal code is invalid" });
                break;
              case "CARD_EXPIRED":
                res.send({ error: "The card is expired" });
                break;
              case "CARD_NOT_SUPPORTED":
                res.send({
                  error:
                    "The card is not supported either in the geographic region or by the MCC",
                });
                break;
              case "EXPIRATION_FAILURE":
                res.send({
                  error:
                    "The card expiration date is either invalid or indicates that the card is expired.",
                });
                break;
              case "INSUFFICIENT_FUNDS":
                res.send({
                  error:
                    "The funding source has insufficient funds to cover the payment.",
                });
                break;
              case "INVALID_ACCOUNT":
                res.send({
                  error:
                    "The card issuer was not able to locate account on record.",
                });
                break;
              case "INVALID_CARD":
                res.send({
                  error:
                    "The credit card cannot be validated based on the provided details.",
                });
                break;
              case "INVALID_CARD_DATA":
                res.send({ error: "The provided card data is invalid." });
                break;
              case "INVALID_EXPIRATION":
                res.send({
                  error: "The expiration date for the payment card is invalid.",
                });
                break;
              case "INVALID_POSTAL_CODE":
                res.send({
                  error: "The postal code is incorrectly formatted.",
                });
                break;
              case "PAN_FAILURE":
                res.send({ error: "The specified card number is invalid." });
                break;
              default:
                res.send({
                  error:
                    "Unknown error occur while processing the credit card.",
                });
            }
          });
      } else {
        res.send({ error: "Request has been denied by the server." });
      }
    } else {
      res.send({
        error: "The store is close, the operating hour is from 11am - 9:50pm.",
      });
    }
  } catch (error) {
    res.send({
      error: error.message ? error.message : "Unexpected error occurred..",
    });
  }
});

router.post("/save_card", async (req, res) => {
  try {
    const {
      given_name,
      family_name,
      phone,
      customer_id,
      env,
      card_nonce,
    } = req.body;

    const { storeIsOpen } = time();

    if (storeIsOpen) {
      let authorized = await checkRequestKey(req.headers.authorization);

      if (authorized) {
        let { SQ_TOKEN } = await getSquareSecret(
          env === "development" ? "DEV" : "PROD"
        );

        const client = new Client({
          environment:
            env === "development"
              ? Environment.Sandbox
              : Environment.Production,
          accessToken: SQ_TOKEN,
        });

        // this variable is going to hold the value for the customer id going to square
        let temp_customerId;

        // if no customer id is passed in the req.body, then we will need to create new customer id
        if (!customer_id) {
          // called the customer api to create user, the result will be either the customer object or the eror object
          await client.customersApi
            .createCustomer({
              idempotencyKey: randomstring.generate(18),
              givenName: given_name,
              familyName: family_name,
              phoneNumber: phone,
            })
            .then((result) => {
              // if no error, and the customer object is present, then set the id in the customer object to be the customer id
              temp_customerId = result.result.customer.id;
            });
        } else {
          // else the customer id passed in by the user will be used
          temp_customerId = customer_id;
        }

        client.customersApi
          .createCustomerCard(temp_customerId, {
            cardNonce: card_nonce,
          })
          .then((result) => {
            res.send({
              card: result.result.card,
              customer_id: temp_customerId,
            });
          })
          .catch((error) => {
            switch (error.result.errors[0].code) {
              case "VERIFY_CVV_FAILURE":
                res.send({ error: "The CVV entered is incorrect." });
                break;
              case "VERIFY_AVS_FAILURE":
                res.send({ error: "The postal code is invalid." });
                break;
              case "CARD_EXPIRED":
                res.send({
                  error:
                    "The card issuer declined the request because the card is expired.",
                });
                break;
              case "INVALID_CARD":
                res.send({
                  error:
                    "The credit card cannot be validated based on the provided details.",
                });
                break;
              case "INVALID_EXPIRATION":
                res.send({
                  error: "The expiration date for the payment card is invalid.",
                });
                break;
              case "INVALID_CARD_DATA":
                res.send({ error: "The provided card data is invalid." });
                break;
              default:
                res.send({
                  error:
                    "Unexpected error occur while processing the credit card.",
                });
            }
          });
      } else {
        res.send({ error: "Request has been denied by the server." });
      }
    } else {
      res.send({
        error: "The store is close, the operating hour is from 11am - 9:50pm.",
      });
    }
  } catch (error) {
    res.send({
      error: error.message
        ? error.message
        : "Failed to save the credit card to Square, try again later.",
      detail: error,
    });
  }
});

router.post("/delete_card", async (req, res) => {
  try {
    const { card, customerId, env } = req.body;
    let authorized = await checkRequestKey(req.headers.authorization);

    if (authorized) {
      let { SQ_TOKEN } = await getSquareSecret(
        env === "development" ? "DEV" : "PROD"
      );

      const client = new Client({
        environment:
          env === "development" ? Environment.Sandbox : Environment.Production,
        accessToken: SQ_TOKEN,
      });

      await client.customersApi.deleteCustomerCard(customerId, card.cofId);

      res.status(200).send({ message: "Card has been successfully deleted." });
    } else {
      res.status(400).send({ error: "Request has been denied by the server." });
    }
  } catch (error) {
    res.status(400).send({
      error: error.message
        ? error.message
        : "Failed to delete the credit card from Square, try again later.",
    });
  }
});

router.post("/cancel_payment", async (req, res) => {
  try {
    const { paymentId, env } = req.body;
    let authorized = await checkRequestKey(req.headers.authorization);

    if (authorized) {
      let { SQ_TOKEN } = await getSquareSecret(
        env === "development" ? "DEV" : "PROD"
      );

      const client = new Client({
        environment:
          env === "development" ? Environment.Sandbox : Environment.Production,
        accessToken: SQ_TOKEN,
      });
      client.paymentsApi.cancelPayment(paymentId);

      res.send({ message: "Payment has been sucessfully cancelled." });
    } else {
      res.send({ error: "Request has been denied by the server." });
    }
  } catch (error) {
    res.send({
      error: error.message
        ? error.message
        : "Failed to cancel the payment, try again later.",
    });
  }
});

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
          }/customer_information`
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
            }/${userId}/customer_information`
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
        .collection(`${development ? 'usersTest' : 'users'}/${userId}/customer_information`)
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
