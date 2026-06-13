const crypto = require("crypto");
const axios = require("axios");
const {
  getSessionId,
  invalidateSessionId,
  cacheSessionId,
  RedisKeys,
} = require("./redisClient");

const IP_BASE_URL = (
  process.env.INTERPARTS_BASE_URL || "http://webservice.interparts.pl:7891/ws/"
).replace(/\/?$/, "/");

const PUBLIC_METHODS = new Set(["getVersion", "doLogin"]);

function getIpCredentials() {
  const userLogin = process.env.INTERPARTS_USER_LOGIN || "";
  const passwordMd5 = process.env.INTERPARTS_USER_PASSWORD_MD5 || "";
  const passwordPlain = process.env.INTERPARTS_USER_PASSWORD || "";

  const userPassword =
    passwordMd5 ||
    (passwordPlain
      ? crypto.createHash("md5").update(passwordPlain, "utf8").digest("hex")
      : "");

  if (!userLogin || !userPassword) {
    const missing = [
      !userLogin ? "INTERPARTS_USER_LOGIN" : null,
      !userPassword
        ? "INTERPARTS_USER_PASSWORD_MD5 (or INTERPARTS_USER_PASSWORD)"
        : null,
    ].filter(Boolean);
    throw new Error(
      `Missing InterParts credentials: ${missing.join(", ")}. See .env.example`,
    );
  }

  return { userLogin, userPassword };
}

function applyLoginDefaults(body) {
  const creds = getIpCredentials();
  return {
    userLogin: body.userLogin || creds.userLogin,
    userPassword: body.userPassword || creds.userPassword,
    ...(body.languageId ? { languageId: body.languageId } : {}),
  };
}

function isInterPartsSessionError(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const code = String(data.error?.code || data.error?.Code || "")
    .trim()
    .toUpperCase();
  if (code === "ERR_SESSION") {
    return true;
  }

  const msg = String(data.error?.msg || data.error?.Msg || "").toLowerCase();
  return msg.includes("session expired") || msg.includes("session does not exist");
}

async function ipPost(methodName, body = {}, { timeoutMs, retried } = {}) {
  const params = { ...(body || {}) };

  if (methodName === "doLogin") {
    Object.assign(params, applyLoginDefaults(params));
  } else if (!PUBLIC_METHODS.has(methodName) && !params.sessionId) {
    params.sessionId = await getSessionId(RedisKeys.INTER_PARTS);
  }

  const payload = { [methodName]: params };
  const url = IP_BASE_URL;

  if (process.env.INTERPARTS_DEBUG === "1") {
    const logPayload = { ...payload };
    if (logPayload.doLogin?.userPassword) {
      logPayload.doLogin = { ...logPayload.doLogin, userPassword: "[redacted]" };
    }
    console.log(`[interparts] POST ${url}`, logPayload);
  }

  const response = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeout: timeoutMs || 30000,
    validateStatus: () => true,
  });

  if (methodName === "doLogin") {
    const sessionId = response.data?.doLoginResponse?.sessionId;
    if (sessionId) {
      await cacheSessionId(RedisKeys.INTER_PARTS, sessionId);
    }
  }

  if (
    !retried &&
    !PUBLIC_METHODS.has(methodName) &&
    isInterPartsSessionError(response.data)
  ) {
    console.warn(
      `[interparts] ${methodName}: session expired (ERR_SESSION), re-login and retry once`,
    );
    await invalidateSessionId(RedisKeys.INTER_PARTS);
    const retryBody = { ...(body || {}) };
    delete retryBody.sessionId;
    return ipPost(methodName, retryBody, { timeoutMs, retried: true });
  }

  return response;
}

function forwardIpResponse(res, ipResponse) {
  const ct = ipResponse.headers?.["content-type"] || "";
  if (ct.includes("application/json")) {
    return res.status(ipResponse.status).json(ipResponse.data);
  }
  return res.status(ipResponse.status).send(ipResponse.data);
}

/** All Falcon5 WebService methods (v1.20). */
const IP_METHODS = [
  "getVersion",
  "getMyCustomerInfo",
  "doLogin",
  "getMyBonuses",
  "doSetRodoStatus",
  "getProductsInfo",
  "getProductFileUrl",
  "getProductStockChanges",
  "doSearchProducts",
  "getReplacements",
  "doBuyNow",
  "doCreateComplaint",
  "getMyComplaints",
  "getComplaintQuantityAvailable",
  "getInvoicesComplaintProduct",
  "doComplaintPrint",
  "doOrderProducts",
  "getMyOrders",
  "getOrderStockInfo",
  "doOrderClose",
  "doOrderItemDelete",
  "doOrderItemEdit",
  "doOrderEdit",
  "doOrderDelete",
  "doOrderItemsMove",
  "getMyInvoices",
  "getEDocument",
  "doDocumentPrint",
  "doSetDeliveryConfirmation",
  "getMyRoutes",
  "getMyPackages",
  "doLogmCreatePackage",
  "getMyPayments",
  "getMyReturns",
  "doReturnCreatePackage",
  "doDeleteReturn",
  "doEditReturn",
  "doCreateReturn",
  "getReturnQuantityAvailable",
  "getReturnNowProductInfo",
  "doReturnClearPackage",
  "doReturnGetPackageLabel",
  "doReturnSendPackage",
  "doReturnNow",
];

module.exports = {
  IP_BASE_URL,
  IP_METHODS,
  ipPost,
  forwardIpResponse,
  getIpCredentials,
};
