/**
 * InterParts Falcon5 WebService routes (v1.20).
 * POST /interparts/<methodName> — body is the inner JSON params (sessionId injected server-side).
 */
const express = require("express");
const {
  IP_METHODS,
  ipPost,
  forwardIpResponse,
} = require("../lib/interpartsClient");

const router = express.Router();

for (const methodName of IP_METHODS) {
  router.post(`/${methodName}`, async (req, res) => {
    try {
      const ipRes = await ipPost(methodName, req.body);
      return forwardIpResponse(res, ipRes);
    } catch (err) {
      console.error(`[interparts] ${methodName}:`, err.message);
      return res.status(500).json({
        error: err.message || "InterParts request failed",
      });
    }
  });
}

module.exports = router;
