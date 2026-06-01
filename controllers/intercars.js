const https = require("https");
const axios = require("axios");
const { fetchAndParseCsvFromZip } = require("../lib/csvParser");
const {
  buildPricingQuoteBodyFromRequest,
  sendIntercarsError,
} = require("../lib/intercarsPricing");
const { icRequest } = require("../lib/intercarsClient");

const wpCkProd = process.env.WP_CK_PROD || "";
const wpCsProd = process.env.WP_CS_PROD || "";

async function getProductsByCategory(req, res) {
  try {
    const category = req.body?.category || req.query?.category;

    if (!category) {
      res.status(400).json({ error: "Please provide a category" });
      return;
    }

    const quoteBody = buildPricingQuoteBodyFromRequest(req);
    const pricing = await icRequest({
      method: "post",
      path: "/pricing/quote",
      data: quoteBody,
      headers: { "Content-Type": "application/json" },
    });

    if (pricing.status >= 400) {
      return res.status(pricing.status).json({
        category,
        error: "InterCars API error",
        intercars: pricing.data,
      });
    }

    res.json({ category, pricing: pricing.data });
  } catch (error) {
    return sendIntercarsError(res, error, "getProductsByCategory");
  }
}

async function updateProductsByTecDocId(req, res) {
  try {
    const { tecdocIds } = req.body;

    if (!tecdocIds || !tecdocIds.length) {
      res.status(400).json({ error: "Please provide tecdocIds" });
      return;
    }

    const aldocData = await axios.get(
      `https://partscentraalws.aldoc.eu:443/PartServices/api/v2/Articles/${tecdocIds[0]}`,
    );

    res.json(aldocData.data);
  } catch (error) {
    console.error("updateProductsByTecDocId:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function createCsvFiles(req, res) {
  try {
    const zipUrl =
      req.body?.zipUrl ||
      "https://data.webapi.intercars.eu/customer/9ABZVV/Stock/Stock_2025-01-31.csv.zip";

    const auth =
      req.body?.icUsername && req.body?.icPassword
        ? { username: req.body.icUsername, password: req.body.icPassword }
        : undefined;

    await fetchAndParseCsvFromZip(zipUrl, {
      auth,
      outputPath: req.body?.outputPath || "./output.csv",
    });

    res.json({ result: "Csv files created" });
  } catch (error) {
    console.error("createCsvFiles:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function writeProductIntoDatabase(data) {
  await axios.post(
    "https://partscentraal.nl/wp-json/wc/v3/products",
    { create: data },
    {
      timeout: 5000,
      auth: {
        username: wpCkProd,
        password: wpCsProd,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    },
  );
}

module.exports = {
  getProductsByCategory,
  updateProductsByTecDocId,
  createCsvFiles,
  writeProductIntoDatabase,
};
