const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = 3000; // You can change the port as needed

app.use(express.json()); // To parse incoming JSON requests

// Replace with your actual API key and secret
const VALID_API_KEY = process.env.API_KEY;
const VALID_API_SECRET = process.env.API_SECRET;

// Middleware to verify API key and secret
const verifyApiKeyAndSecret = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const apiSecret = req.headers["x-api-secret"];

  if (!VALID_API_KEY || !VALID_API_SECRET) {
    // Invalid API key or secret
    return res
      .status(401)
      .json({ message: "Unauthorized: Invalid API key or secret" });
  }

  if (apiKey === VALID_API_KEY && apiSecret === VALID_API_SECRET) {
    // API key and secret are valid, proceed to the next middleware/route
    return next();
  }

  // Invalid API key or secret
  res.status(401).json({ message: "Unauthorized: Invalid API key or secret" });
};

// Apply the verification middleware to all routes
app.use(verifyApiKeyAndSecret);

app.use("/", async (req, res) => {
  const targetUrl = "https://partscentraalws.aldoc.eu:443" + req.originalUrl; // Change to your target app URL

  axios
    .get(targetUrl, {
      headers: {
        "X-Real-IP": "84.241.192.28",
        "X-Forwarded-For": "84.241.192.28",
        Accept: "application/json",
        "User-Agent": "curl/8.5.0",
      },
    })
    .then((response) => {
      res.status(response.status).send(response.data);
    })
    .catch((error) => {
      console.log(
        "Error:",
        error.response ? error.response.data : error.message
      );
      res.status(error.response.status).send(error.response.data);
    });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
