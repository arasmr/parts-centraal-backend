const axios = require("axios");
const https = require("https");

const defaultTimeout = 3000;

const requestAldoc = axios.create({
  baseURL: "https://partscentraalws.aldoc.eu:443/PartServices/api/v2/",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

const requestInterCars = axios.create({
  baseURL: "https://api.webapi.intercars.eu/ic/",
  timeout: defaultTimeout,
});

const requestInterParts = axios.create({
  baseURL: (
    process.env.INTERPARTS_BASE_URL ||
    "http://webservice.interparts.pl:7891/ws/"
  ).replace(/\/?$/, "/"),
  timeout: defaultTimeout,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const requestAldocProd = axios.create({
  baseURL: "https://partscentraal.com/wp-json/wc/v3/",
  timeout: defaultTimeout,
  auth: {
    username: process.env.WP_CK_PROD || "",
    password: process.env.WP_CS_PROD || "",
  },
});

const requestAldocLocal = axios.create({
  baseURL: "https://partscentraal.nl/wp-json/wc/v3/",
  timeout: defaultTimeout,
  auth: {
    username: process.env.WP_CK_LOCAL || "",
    password: process.env.WP_CS_LOCAL || "",
  },
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

module.exports = {
  requestAldoc,
  requestInterCars,
  requestInterParts,
  requestAldocProd,
  requestAldocLocal,
};
