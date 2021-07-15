const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const client = new SecretManagerServiceClient();

// will retrieve the neccesssary secret from the api
async function getSquareSecret (env){
    const [SQ_TOKEN] = await client.accessSecretVersion({
      name: `projects/369761240989/secrets/SQ_TOKEN_${env}/versions/latest`,
    });
    
    return {
      SQ_TOKEN: SQ_TOKEN.payload.data.toString(),
    }
  }

  // check if the user is authorized
  async function checkRequestKey(key){
    const [REQUEST_API_KEY] = await client.accessSecretVersion({
      name: `projects/369761240989/secrets/REQUEST_API_KEY/versions/latest`,
    });
    return key === REQUEST_API_KEY.payload.data.toString();
  }

  async function getTwilioKeys(){
    const [TWILLIO_ACCOUNT_SID] = await client.accessSecretVersion({
      name: `projects/369761240989/secrets/TWILLIO_ACCOUNT_SID/versions/latest`,
    });

  const [TWILLIO_TOKEN] = await client.accessSecretVersion({
    name: `projects/369761240989/secrets/TWILLIO_TOKEN/versions/latest`,
  });

  const [TWILLIO_NUMBER] = await client.accessSecretVersion({
    name: `projects/369761240989/secrets/TWILLIO_NUMBER/versions/latest`,
  });

  return {
    TWILIO_TOKEN: TWILLIO_TOKEN.payload.data.toString(),
    TWILIO_ACCOUNT_SID: TWILLIO_ACCOUNT_SID.payload.data.toString(),
    TWILIO_NUMBER: TWILLIO_NUMBER.payload.data.toString()
  }
}

  module.exports = {
    getSquareSecret,
    checkRequestKey,
    getTwilioKeys
  }