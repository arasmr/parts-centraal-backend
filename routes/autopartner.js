const express = require("express");
const { apPost, forwardApResponse } = require("../lib/autopartnerClient");

const router = express.Router();

// Mirrors method names from AP_CustomerAPI documentation.
router.post("/ProductAvailability", async (req, res) => {
  const apRes = await apPost("ProductAvailability", req.body);
  return forwardApResponse(res, apRes);
});

router.post("/ProductsAvailability", async (req, res) => {
  const apRes = await apPost("ProductsAvailability", req.body);
  return forwardApResponse(res, apRes);
});

router.post("/ProductAvailabilityTecDoc", async (req, res) => {
  const apRes = await apPost("ProductAvailabilityTecDoc", req.body);
  return forwardApResponse(res, apRes);
});

router.post("/ProductsAvailabilityTecDoc", async (req, res) => {
  const apRes = await apPost("ProductsAvailabilityTecDoc", req.body);
  return forwardApResponse(res, apRes);
});

// Useful for order workflows (later)
router.post("/InsertOrder", async (req, res) => {
  const apRes = await apPost("InsertOrder", req.body);
  return forwardApResponse(res, apRes);
});

router.post("/InsertOrderTecDoc", async (req, res) => {
  const apRes = await apPost("InsertOrderTecDoc", req.body);
  return forwardApResponse(res, apRes);
});

module.exports = router;

