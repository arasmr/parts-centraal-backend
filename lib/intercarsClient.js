const axios = require("axios");
const { getSessionId, RedisKeys } = require("./redisClient");
const { sendIntercarsError } = require("./intercarsPricing");

const IC_API_BASE_URL = (
  process.env.IC_API_BASE_URL || "https://api.webapi.intercars.eu/ic"
).replace(/\/$/, "");

const IC_TOKEN_URL =
  process.env.IC_TOKEN_URL ||
  "https://is.webapi.intercars.eu/oauth2/token?grant_type=client_credentials&scope=allinone";

async function getBearerToken() {
  return getSessionId(RedisKeys.INTER_CARS);
}

/**
 * Low-level InterCars HTTP call. Returns axios response (validateStatus: all).
 */
async function icRequest({ method, path, params, data, headers = {} }) {
  const token = await getBearerToken();
  const url = `${IC_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  return axios({
    method: method.toLowerCase(),
    url,
    params,
    data,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    validateStatus: () => true,
  });
}

function forwardStatus(res, icResponse) {
  const contentType = icResponse.headers["content-type"] || "";
  if (contentType.includes("application/json")) {
    return res.status(icResponse.status).json(icResponse.data);
  }
  return res.status(icResponse.status).send(icResponse.data);
}

/**
 * Express handler factory — forwards query/body/params to InterCars.
 */
function createIcProxy(method, pathBuilder, { normalizeBody } = {}) {
  return async function icProxyHandler(req, res) {
    try {
      const path =
        typeof pathBuilder === "function" ? pathBuilder(req) : pathBuilder;
      const hasBody = ["post", "put", "patch"].includes(method.toLowerCase());
      let body =
        hasBody && req.body && Object.keys(req.body).length > 0
          ? req.body
          : hasBody
            ? undefined
            : undefined;

      if (hasBody && body && typeof normalizeBody === "function") {
        body = normalizeBody(body);
      }

      const icResponse = await icRequest({
        method,
        path,
        params: req.query,
        data: body,
        headers:
          hasBody && body
            ? { "Content-Type": "application/json" }
            : {},
      });

      return forwardStatus(res, icResponse);
    } catch (error) {
      return sendIntercarsError(res, error, `IC ${method} ${pathBuilder}`);
    }
  };
}

async function requestOAuthToken() {
  const useSandbox = process.env.IC_USE_SANDBOX === "1";
  const clientId = useSandbox
    ? process.env.IC_SANDBOX_CLIENT_ID || ""
    : process.env.IC_PROD_CLIENT_ID || "";
  const clientSecret = useSandbox
    ? process.env.IC_SANDBOX_SECRET || ""
    : process.env.IC_PROD_SECRET || "";

  const response = await axios.post(IC_TOKEN_URL, null, {
    auth: { username: clientId, password: clientSecret },
    validateStatus: () => true,
  });

  return response;
}

module.exports = {
  IC_API_BASE_URL,
  IC_TOKEN_URL,
  getBearerToken,
  icRequest,
  forwardStatus,
  createIcProxy,
  requestOAuthToken,
};
