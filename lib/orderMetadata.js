const FRIENDLY_ORDER_KEYS = [
  "orderNumber",
  "order_number",
  "customerName",
  "customer_name",
  "customer",
  "comment",
];

function pickOrderNumber(body) {
  if (!body || typeof body !== "object") {
    return "";
  }
  for (const key of [
    "orderNumber",
    "order_number",
    "externalOrderId",
    "customNumber",
  ]) {
    const value = body[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function pickCustomerName(body) {
  if (!body || typeof body !== "object") {
    return "";
  }
  for (const key of ["customerName", "customer_name"]) {
    const value = body[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  if (body.customer && typeof body.customer === "object") {
    const name = body.customer.name ?? body.customer.customerName;
    if (name != null && String(name).trim()) {
      return String(name).trim();
    }
  }
  return "";
}

function mergeCustomerIntoComments(existingComments, customerName) {
  const comments = String(existingComments ?? "").trim();
  const name = String(customerName ?? "").trim();
  if (!name) {
    return comments;
  }
  if (!comments) {
    return name;
  }
  if (comments.toLowerCase().includes(name.toLowerCase())) {
    return comments;
  }
  return `${comments} | Customer: ${name}`;
}

/**
 * Map friendly orderNumber / customerName into supplier-specific fields.
 */
function applyOrderMetadataFields(body, { orderIdField, commentsField = "comments" }) {
  const result = { ...body };

  const orderNumber = pickOrderNumber(body);
  if (orderNumber && !result[orderIdField]) {
    result[orderIdField] = orderNumber;
  }

  const customerName = pickCustomerName(body);
  const existingComments = result[commentsField] ?? result.comment ?? "";
  if (customerName) {
    result[commentsField] = mergeCustomerIntoComments(
      existingComments,
      customerName,
    );
  } else if (result.comment != null && result[commentsField] == null) {
    result[commentsField] = String(result.comment);
  }

  return result;
}

function stripFriendlyOrderKeys(body) {
  const payload = { ...body };
  for (const key of FRIENDLY_ORDER_KEYS) {
    delete payload[key];
  }
  delete payload.clientCode;
  delete payload.wsPassword;
  delete payload.clientPassword;
  return payload;
}

function applyAutopartnerOrderMetadata(body) {
  return stripFriendlyOrderKeys(
    applyOrderMetadataFields(body || {}, { orderIdField: "externalOrderId" }),
  );
}

function applyIntercarsOrderMetadata(body) {
  return stripFriendlyOrderKeys(
    applyOrderMetadataFields(body || {}, { orderIdField: "customNumber" }),
  );
}

module.exports = {
  pickOrderNumber,
  pickCustomerName,
  mergeCustomerIntoComments,
  applyOrderMetadataFields,
  applyAutopartnerOrderMetadata,
  applyIntercarsOrderMetadata,
};
