const express = require("express");
const axios = require("axios");
const CircularJSON = require("circular-json");
const https = require("https");

const app = express();
const PORT = 3000; // You can change the port as needed

app.use(express.json()); // To parse incoming JSON requests

const agent = new https.Agent({
  rejectUnauthorized: false, // Disables hostname verification
});

// Proxy route that forwards the incoming request
// app.use("/", async (req, res) => {
//   console.log("emre", req.headers);
//   try {
//     const targetUrl = "https://partscentraalws.aldoc.eu:443" + req.originalUrl; // Change to your target app URL

//     console.log("Forwarded request headers:", {
//       ...req.headers,
//       "User-Agent": "curl/8.5.0",
//       Accept: "application/json",
//     });

//     console.log("Request body:", req.body);
//     console.log("Request query:", req.query);

//     console.log("Target URL:", targetUrl);

//     // Forward the request using axios
//     const axiosConfig = {
//       method: req.method,
//       url: targetUrl,
//       headers: {
//         ...req.headers,
//         "User-Agent": "curl/8.5.0",
//         Accept: "application/json",
//       },
//       httpsAgent: agent,
//       data: req.body, // Forward body if there's one
//       params: req.query, // Forward query params if there's any
//     };

//     // Log the config being used for the request
//     console.log("Axios config:", axiosConfig);

//     const response = await axios(axiosConfig);

//     console.log("Response status:", response.status);

//     console.log("Full response:", response);

//     // console.log("response.data emre", CircularJSON.stringify(response));
//     console.log("response.data emre", CircularJSON.stringify(response.data));

//     // Send back the response from the target application
//     res.status(response.status).send(response.data);
//   } catch (error) {
//     if (error.response) {
//       console.log("Error response:", error.response);
//     }
//     console.log("error in catch block", error);
//     // Handle errors and send an appropriate response
//     if (error.response) {
//       res.status(error.response.status).send(error.response.data);
//     } else {
//       res.status(500).send("Error occurred while forwarding the request");
//     }
//   }
// });

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
      console.log(response.data);
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
