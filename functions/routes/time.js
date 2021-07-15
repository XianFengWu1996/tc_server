const moment = require("moment");
const timezone = require("moment-timezone");

// converts the server time to ETD
// return neccessary variables
exports.time = () => {
  const date = new Date();
  const ETD = moment.tz(date, "America/New_York");

  const timestamp = moment().valueOf();
  const hour = ETD.hour();
  const minute = ETD.minute();
  const day = ETD.date();
  const month = ETD.month() + 1;
  const year = ETD.year();
  const currentTime = hour * 60 + minute;
  const expiration = moment().add(12, 'hours').valueOf();
  const storeIsOpen = currentTime >= 660 && currentTime <= 1310;
  const isLunchTime = currentTime >= 660 && currentTime <= 960;
  const storeTime = {
    lunchStart: 660,
    lunchEnds: 960,
    storeOpen: 660,
    storeClose: 1310,
  }

  return { ETD, hour, minute, day, month, year, currentTime, timestamp, expiration, storeIsOpen , isLunchTime, storeTime};
};
