const axios = require("axios");
const crypto = require("crypto");
const { applyAutopartnerOrderMetadata } = require("./orderMetadata");
const {
  normalizeAutopartnerProductCode,
  normalizeAutopartnerProductCodes,
} = require("./autopartnerProductCode");

const AP_BASE_URL = (
  process.env.AUTOPARTNER_BASE_URL ||
  "https://customerapi.autopartner.dev/CustomerAPI.svc/rest"
).replace(/\/$/, "");

function getApCredentials() {
  const clientCode = process.env.AUTOPARTNER_CLIENT_CODE || "";
  const wsPassword = process.env.AUTOPARTNER_WS_PASSWORD || "";
  const clientPasswordMd5 = process.env.AUTOPARTNER_CLIENT_PASSWORD_MD5 || "";
  const clientPasswordPlain = process.env.AUTOPARTNER_CLIENT_PASSWORD || "";

  const clientPassword =
    clientPasswordMd5 ||
    (clientPasswordPlain
      ? crypto
          .createHash("md5")
          .update(clientPasswordPlain, "utf8")
          .digest("hex")
      : "");

  if (!clientCode || !wsPassword || !clientPassword) {
    const missing = [
      !clientCode ? "AUTOPARTNER_CLIENT_CODE" : null,
      !wsPassword ? "AUTOPARTNER_WS_PASSWORD" : null,
      !clientPassword
        ? "AUTOPARTNER_CLIENT_PASSWORD_MD5 (or AUTOPARTNER_CLIENT_PASSWORD)"
        : null,
    ].filter(Boolean);
    throw new Error(
      `Missing AutoPartner credentials: ${missing.join(
        ", ",
      )}. See .env.example`,
    );
  }

  return { clientCode, wsPassword, clientPassword };
}

function applyDefaults(body) {
  if (!body || typeof body !== "object") {
    return body;
  }
  const currencyCode =
    body.currencyCode || process.env.AUTOPARTNER_CURRENCY || "EUR";
  const departamentCode =
    body.departamentCode || process.env.AUTOPARTNER_DEPARTAMENT_CODE || "CN";
  return {
    ...body,
    ...(body.currencyCode ? {} : { currencyCode }),
    ...(body.departamentCode ? {} : { departamentCode }),
  };
}

/**
 * ProductAvailability  → productCode (string) + amount (number)
 * ProductsAvailability → productsCodes (string[]) + amount (number[])
 */
function normalizeStandardOrderItems(orderItemList) {
  return orderItemList
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const qty = Number(row.Quantity ?? row.quantity ?? 1);
      return {
        ...row,
        ProductCode: normalizeAutopartnerProductCode(
          row.ProductCode ?? row.productCode ?? "",
        ),
        Quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        QuantityP: Number(row.QuantityP ?? row.quantityP ?? 0) || 0,
        PositionNumber: String(
          row.PositionNumber ?? row.positionNumber ?? index + 1,
        ),
        ...(row.QuantityWZ != null || row.quantityWZ != null
          ? {
              QuantityWZ: Number(row.QuantityWZ ?? row.quantityWZ ?? 0) || 0,
            }
          : {}),
      };
    })
    .filter((row) => row.ProductCode);
}

function buildOrderItemListFromLegacy(body) {
  let productsCodes = body.productsCodes;
  if (!Array.isArray(productsCodes)) {
    productsCodes = body.productCode ? [body.productCode] : [];
  }
  productsCodes = productsCodes.map(String).filter(Boolean);

  let amount = body.amount;
  if (!Array.isArray(amount)) {
    const n = Number(amount);
    amount = productsCodes.map(() => (Number.isFinite(n) && n > 0 ? n : 1));
  } else {
    amount = amount.map((n) => {
      const v = Number(n);
      return Number.isFinite(v) && v > 0 ? v : 1;
    });
  }
  while (amount.length < productsCodes.length) {
    amount.push(1);
  }

  return productsCodes.map((code, index) => ({
    ProductCode: normalizeAutopartnerProductCode(code),
    Quantity: amount[index] ?? 1,
    QuantityP: 0,
    PositionNumber: String(index + 1),
  }));
}

function normalizeInsertOrderBody(body, isTecDoc = false) {
  const payload = applyAutopartnerOrderMetadata(body || {});

  if (
    !isTecDoc &&
    (!Array.isArray(payload.orderItemList) || payload.orderItemList.length === 0)
  ) {
    payload.orderItemList = buildOrderItemListFromLegacy(body || {});
  } else if (!isTecDoc && Array.isArray(payload.orderItemList)) {
    payload.orderItemList = normalizeStandardOrderItems(payload.orderItemList);
  }

  delete payload.productsCodes;
  delete payload.productCode;
  delete payload.amount;
  delete payload.departamentCode;
  delete payload.currencyCode;

  if (payload.comments == null) {
    payload.comments = "";
  } else {
    payload.comments = String(payload.comments);
  }
  if (payload.zone == null) {
    payload.zone = "03";
  }
  if (payload.ownCollect == null) {
    payload.ownCollect = false;
  }
  if (payload.separateDocsAndPackaging == null) {
    payload.separateDocsAndPackaging = false;
  }
  if (payload.onlyWhenAllAvailable == null) {
    payload.onlyWhenAllAvailable = false;
  }
  if (payload.source == null && Number.isFinite(Number(body?.source))) {
    payload.source = Number(body.source);
  }

  return payload;
}

function normalizeApRequestBody(methodName, body) {
  if (methodName === "InsertOrder" || methodName === "InsertOrderTecDoc") {
    return normalizeInsertOrderBody(body, methodName === "InsertOrderTecDoc");
  }

  const b = applyDefaults(body || {});

  if (methodName === "ProductAvailability") {
    const productCode = normalizeAutopartnerProductCode(
      b.productCode ||
        (Array.isArray(b.productsCodes)
          ? b.productsCodes[0]
          : b.productsCodes) ||
        "",
    );
    const rawAmount = Array.isArray(b.amount) ? b.amount[0] : b.amount;
    const amount = Number(rawAmount);
    return {
      departamentCode: b.departamentCode,
      currencyCode: b.currencyCode,
      productCode,
      amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
    };
  }

  if (methodName === "ProductsAvailability") {
    let productsCodes = b.productsCodes;
    if (!Array.isArray(productsCodes)) {
      productsCodes = b.productCode ? [b.productCode] : [];
    }
    productsCodes = normalizeAutopartnerProductCodes(productsCodes);

    let amount = b.amount;
    if (!Array.isArray(amount)) {
      const n = Number(amount);
      amount = productsCodes.map(() =>
        Number.isFinite(n) && n > 0 ? n : 1,
      );
    } else {
      amount = amount.map((n) => {
        const v = Number(n);
        return Number.isFinite(v) && v > 0 ? v : 1;
      });
    }
    while (amount.length < productsCodes.length) {
      amount.push(1);
    }

    return {
      departamentCode: b.departamentCode,
      currencyCode: b.currencyCode,
      productsCodes,
      amount: amount.slice(0, productsCodes.length),
      ...(b.comment ? { comment: b.comment } : {}),
    };
  }

  return b;
}

function withCredentials(methodName, body) {
  const creds = getApCredentials();
  return {
    ...creds,
    ...normalizeApRequestBody(methodName, body),
  };
}

async function apPost(methodName, body, { timeoutMs } = {}) {
  const url = `${AP_BASE_URL}/${methodName}`;
  const payload = withCredentials(methodName, body);
  if (process.env.AUTOPARTNER_DEBUG === "1") {
    console.log(`[autopartner] POST ${url}`, payload);
  }
  const response = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeout: timeoutMs || 30000,
    validateStatus: () => true,
  });
  return response;
}

const { normalizeApFileResponseBody } = require("./autopartnerFileDecode");

function forwardApResponse(res, apResponse) {
  const ct = apResponse.headers?.["content-type"] || "";
  if (ct.includes("application/json")) {
    const body = normalizeApFileResponseBody(apResponse.data);
    return res.status(apResponse.status).json(body);
  }
  return res.status(apResponse.status).send(apResponse.data);
}

module.exports = {
  AP_BASE_URL,
  apPost,
  forwardApResponse,
};
