const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { scrapeAutodocListing } = require("./lib/autodocScrape");
const servicesRouter = require("./routes/services");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VALID_API_KEY = process.env.API_KEY;
const VALID_API_SECRET = process.env.API_SECRET;

const verifyApiKeyAndSecret = (req, res, next) => {
  if (process.env.SKIP_API_AUTH === "1") {
    return next();
  }

  const apiKey = req.headers["x-api-key"];
  const apiSecret = req.headers["x-api-secret"];

  if (!VALID_API_KEY || !VALID_API_SECRET) {
    return res.status(503).json({
      message:
        "Server missing API_KEY / API_SECRET configuration. Set SKIP_API_AUTH=1 locally if needed.",
    });
  }

  if (apiKey === VALID_API_KEY && apiSecret === VALID_API_SECRET) {
    return next();
  }

  return res.status(401).json({
    message: "Unauthorized: Invalid API key or secret",
  });
};

app.use(verifyApiKeyAndSecret);

/** Admin: Autodoc price comparison scrape */
app.get("/admin/price-comparison/autodoc", async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return res.status(400).json({
      data: {
        success: false,
        error: "MISSING_URL",
        message:
          "Query parameter ?url= is required (full https://www.autodoc.nl/... URL)",
      },
    });
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {
    decodedUrl = rawUrl;
  }

  try {
    const result = await scrapeAutodocListing(decodedUrl);
    return res.json({ data: result });
  } catch (err) {
    console.error("price-comparison autodoc:", err);
    return res.status(500).json({
      data: {
        success: false,
        error: "SCRAPE_ERROR",
        message: err.message || "Failed to scrape Autodoc",
        products: [],
      },
    });
  }
});

/** parts-centraal-services routes (InterCars, CSV, Aldoc articles) */
app.use(servicesRouter);

/** Proxy remaining paths to Aldoc WS */
app.use("/", async (req, res) => {
  const targetUrl = "https://partscentraalws.aldoc.eu:443" + req.originalUrl;

  try {
    const response = await axios({
      method: req.method.toLowerCase(),
      url: targetUrl,
      headers: {
        "X-Real-IP": "84.241.192.28",
        "X-Forwarded-For": "84.241.192.28",
        Accept: req.headers.accept || "application/json",
        "User-Agent": req.headers["user-agent"] || "curl/8.5.0",
        "Content-Type": req.headers["content-type"],
      },
      data: req.body && Object.keys(req.body).length ? req.body : undefined,
      validateStatus: () => true,
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    const body = error.response?.data ?? { message: error.message };
    console.log("Proxy error:", error.response?.data ?? error.message);
    res.status(status).send(body);
  }
});

app.listen(PORT, () => {
  console.log(`Parts Centraal backend listening on ${PORT}`);
});
