const { IP_METHODS } = require("./interpartsClient");

const AP_METHODS = [
  "ProductAvailability",
  "ProductsAvailability",
  "ProductAvailabilityTecDoc",
  "ProductsAvailabilityTecDoc",
  "InsertOrder",
  "InsertOrderTecDoc",
  "Invoices",
  "DeliveryDocuments",
  "DeliveryDocumentPositions",
  "InvoicePositions",
];

/** Sample request bodies for InterParts Falcon5 methods (inner params only). */
const INTERPARTS_EXAMPLES = {
  getVersion: {},
  doLogin: {
    userLogin: "YOUR_LOGIN",
    userPassword: "md5_hex_of_password",
  },
  getMyCustomerInfo: {},
  getMyBonuses: { getGroupPromoList: "1", getProductPromoList: "1" },
  doSetRodoStatus: { newStatus: 1, clientIP: "127.0.0.1" },
  getProductsInfo: {
    productList: { product: [{ reference: "0-001-231-030" }] },
    showExternalStockInfo: "2",
    showPhotos: "1",
  },
  getProductFileUrl: { fileId: "00000013", productId: "0003B4" },
  getProductStockChanges: {
    warehouseId: "01",
    fromDt: "2021-09-01 16:17:25",
  },
  doSearchProducts: {
    searchString: "96575",
    searchMode: { modeName: ["name", "reference"] },
  },
  getReplacements: { product: { reference: "0-001-231-030" } },
  doBuyNow: {
    warehouseId: "01",
    productList: { product: [{ id: "0003B4", quantity: "1" }] },
  },
  doOrderProducts: {
    productList: {
      product: [{ id: "0003B4", quantity: "1", warehouseId: "01" }],
    },
  },
  getMyOrders: { getItems: "1" },
  getOrderStockInfo: { orderId: "01512768" },
  doOrderClose: { orderId: "01520531", collectionInPerson: "1" },
  doOrderItemDelete: { orderId: "01520531", itemId: "R-3975485" },
  doOrderItemEdit: {
    orderId: "01520531",
    itemId: "R-3975485",
    itemInfo: { quantity: "2" },
  },
  doOrderEdit: {
    orderId: "01520531",
    orderInfo: { comment: "comment" },
  },
  doOrderDelete: { orderId: "01520531" },
  getMyRoutes: {},
  getMyPackages: { getTrackingUrl: "1" },
  getReturnNowProductInfo: {
    warehouseId: "01",
    product: { id: "0003AZ" },
  },
};

const INTERPARTS_GROUPS = {
  General: [
    "getVersion",
    "doLogin",
    "getMyCustomerInfo",
    "getMyBonuses",
    "doSetRodoStatus",
  ],
  Products: [
    "getProductsInfo",
    "getProductFileUrl",
    "getProductStockChanges",
    "doSearchProducts",
    "getReplacements",
    "doBuyNow",
  ],
  Complaints: [
    "doCreateComplaint",
    "getMyComplaints",
    "getComplaintQuantityAvailable",
    "getInvoicesComplaintProduct",
    "doComplaintPrint",
  ],
  Reservations: [
    "doOrderProducts",
    "getMyOrders",
    "getOrderStockInfo",
    "doOrderClose",
    "doOrderItemDelete",
    "doOrderItemEdit",
    "doOrderEdit",
    "doOrderDelete",
    "doOrderItemsMove",
  ],
  Documents: [
    "getMyInvoices",
    "getEDocument",
    "doDocumentPrint",
    "doSetDeliveryConfirmation",
  ],
  Routes: ["getMyRoutes"],
  Logistics: ["getMyPackages", "doLogmCreatePackage"],
  Payments: ["getMyPayments"],
  Returns: [
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
  ],
};

function jsonResponse(description, schemaRef) {
  return {
    description,
    content: {
      "application/json": {
        schema: schemaRef ? { $ref: schemaRef } : { type: "object" },
      },
    },
  };
}

function postJsonOp(summary, tag, schemaRef, example, description) {
  const body = {
    required: true,
    content: {
      "application/json": {
        schema: schemaRef ? { $ref: schemaRef } : { type: "object" },
      },
    },
  };
  if (example !== undefined) {
    body.content["application/json"].example = example;
  }
  return {
    summary,
    description,
    tags: [tag],
    requestBody: body,
    responses: {
      200: jsonResponse("Upstream response (JSON or passthrough)"),
      401: jsonResponse("Invalid API key or secret", "#/components/schemas/ErrorMessage"),
      500: jsonResponse("Server error", "#/components/schemas/ErrorMessage"),
    },
  };
}

function getOp(summary, tag, parameters = [], description) {
  return {
    summary,
    description,
    tags: [tag],
    parameters,
    responses: {
      200: jsonResponse("Success"),
      401: jsonResponse("Invalid API key or secret", "#/components/schemas/ErrorMessage"),
    },
  };
}

function buildInterPartsPaths() {
  const paths = {};
  const methodToGroup = {};
  for (const [group, methods] of Object.entries(INTERPARTS_GROUPS)) {
    for (const method of methods) {
      methodToGroup[method] = group;
    }
  }

  for (const methodName of IP_METHODS) {
    const tag = `InterParts · ${methodToGroup[methodName] || "Other"}`;
    const example = INTERPARTS_EXAMPLES[methodName];
    const needsSession = !["getVersion", "doLogin"].includes(methodName);
    paths[`/interparts/${methodName}`] = {
      post: postJsonOp(
        methodName,
        tag,
        "#/components/schemas/InterPartsRequest",
        example,
        needsSession
          ? "Session ID is injected server-side from Redis (doLogin). Omit sessionId unless overriding."
          : undefined,
      ),
    };
  }
  return paths;
}

function buildAutoPartnerPaths() {
  const paths = {};
  const examples = {
    ProductAvailability: {
      productCode: "ABC123",
      amount: 1,
      departamentCode: "CN",
      currencyCode: "EUR",
    },
    ProductsAvailability: {
      productsCodes: ["ABC123", "DEF456"],
      amount: [1, 2],
      departamentCode: "CN",
      currencyCode: "EUR",
    },
    InsertOrder: {
      orderNumber: "PO-12345",
      customerName: "Jan Kowalski",
      zone: "03",
      orderItemList: [
        {
          ProductCode: "ABC123",
          Quantity: 1,
          QuantityP: 0,
          PositionNumber: "1",
        },
      ],
      ownCollect: false,
      separateDocsAndPackaging: false,
      onlyWhenAllAvailable: false,
      source: 0,
    },
    Invoices: { dateFrom: "2024-01-01", dateTo: "2024-12-31" },
  };

  for (const methodName of AP_METHODS) {
    paths[`/autopartner/${methodName}`] = {
      post: postJsonOp(
        methodName,
        "AutoPartner",
        "#/components/schemas/AutoPartnerRequest",
        examples[methodName] || { departamentCode: "CN", currencyCode: "EUR" },
        "Credentials (clientCode, wsPassword, clientPassword) are added server-side.",
      ),
    };
  }
  return paths;
}

function buildInterCarsPaths() {
  const icQuoteParams = [
    {
      name: "sku",
      in: "query",
      schema: { type: "string" },
      description: "InterCars SKU",
    },
    {
      name: "index",
      in: "query",
      schema: { type: "string" },
      description: "InterCars index",
    },
    {
      name: "quantity",
      in: "query",
      schema: { type: "integer", default: 1 },
    },
    {
      name: "location",
      in: "query",
      schema: { type: "string" },
      description: "Warehouse code(s), e.g. KOM",
    },
    {
      name: "shipTo",
      in: "query",
      schema: { type: "string" },
    },
  ];

  const icStockQuery = [
    {
      name: "sku",
      in: "query",
      required: true,
      schema: { type: "string" },
      description: "Comma-separated SKUs",
    },
    {
      name: "location",
      in: "query",
      schema: { type: "string", default: "KOM" },
    },
  ];

  return {
    "/intercars/ic/oauth/token": {
      post: {
        summary: "OAuth token (client credentials)",
        tags: ["InterCars"],
        responses: {
          200: jsonResponse("OAuth token payload"),
          401: jsonResponse("OAuth failed", "#/components/schemas/ErrorMessage"),
        },
      },
    },
    "/intercars/ic/oauth/token/status": {
      get: getOp("OAuth token cache status", "InterCars"),
    },
    "/intercars/ic/customer": {
      get: getOp("Customer profile", "InterCars"),
    },
    "/intercars/ic/customer/finances": {
      get: getOp("Customer finances", "InterCars"),
    },
    "/intercars/ic/inventory/quote": {
      post: postJsonOp(
        "Inventory quote",
        "InterCars",
        "#/components/schemas/IcPricingQuoteRequest",
        { sku: "ADDFFF", quantity: 1, location: ["KOM"] },
      ),
    },
    "/intercars/ic/inventory/stock": {
      get: getOp("Stock by SKU (GET)", "InterCars", icStockQuery),
      post: postJsonOp(
        "Stock by SKU (POST)",
        "InterCars",
        "#/components/schemas/IcStockPostRequest",
        { sku: "ADDFFF,ADDFA" },
      ),
    },
    "/intercars/ic/pricing/quote": {
      post: postJsonOp(
        "Pricing quote",
        "InterCars",
        "#/components/schemas/IcPricingQuoteRequest",
        { sku: "ADDFFF", quantity: 1, location: ["KOM"] },
      ),
    },
    "/intercars/ic/sku-by-reference": {
      get: getOp(
        "Resolve tow_kod (SKU) from a manufacturer/TecDoc reference",
        "InterCars",
        [
          {
            name: "reference",
            in: "query",
            required: true,
            schema: { type: "string" },
            description:
              "Manufacturer / TecDoc reference (e.g. ADH22118). Returns InterCars tow_kod(s) usable as the SKU for pricing/inventory.",
          },
        ],
      ),
    },
    "/intercars/ic/product-info": {
      get: getOp(
        "Brand / name / reference for a tow_kod (SKU)",
        "InterCars",
        [
          {
            name: "sku",
            in: "query",
            required: true,
            schema: { type: "string" },
            description:
              "One or more InterCars tow_kod(s), comma-separated (e.g. BADE08,F61F56). Returns the manufacturer (brand), short description and TecDoc reference from the bundled ProductInformation index. The IC live API does not expose the brand.",
          },
        ],
      ),
    },
    "/intercars/ic/delivery": {
      get: getOp("Delivery list", "InterCars"),
    },
    "/intercars/ic/delivery/{id}": {
      get: getOp("Delivery by ID", "InterCars", [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ]),
    },
    "/intercars/ic/invoice": {
      get: getOp("Invoice list", "InterCars"),
    },
    "/intercars/ic/invoice/detail": {
      get: getOp("Invoice by query id", "InterCars", [
        {
          name: "id",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Invoice id (slashes allowed, e.g. LAZ/19/0001)",
        },
        {
          name: "techId",
          in: "query",
          schema: { type: "string", enum: ["true", "1"] },
        },
      ]),
    },
    "/intercars/ic/invoice/{id}": {
      get: getOp("Invoice by path id", "InterCars", [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ]),
    },
    "/intercars/ic/sales/requisition": {
      get: getOp("List requisitions", "InterCars"),
      post: postJsonOp(
        "Submit requisition",
        "InterCars",
        "#/components/schemas/IcRequisitionRequest",
        { lines: [{ sku: "ADDFFF", quantity: 1 }] },
      ),
    },
    "/intercars/ic/sales/requisition/{id}": {
      get: getOp("Requisition by ID", "InterCars", [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ]),
    },
    "/intercars/ic/sales/requisition/{id}/confirm": {
      post: postJsonOp("Confirm requisition", "InterCars", null, {}),
    },
    "/intercars/ic/sales/requisition/{id}/cancel": {
      post: postJsonOp("Cancel requisition", "InterCars", null, {}),
    },
    "/intercars/ic/sales/order/{id}": {
      get: getOp("Sales order by ID", "InterCars", [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ]),
    },
    "/intercars/pricing/quote": {
      post: postJsonOp(
        "Pricing quote (legacy shortcut)",
        "InterCars · Legacy",
        "#/components/schemas/IcPricingQuoteRequest",
        { sku: "ADDFFF", quantity: 1 },
      ),
    },
    "/intercars/inventory/quote": {
      post: postJsonOp(
        "Inventory quote (legacy shortcut)",
        "InterCars · Legacy",
        "#/components/schemas/IcPricingQuoteRequest",
        { sku: "ADDFFF", quantity: 1 },
      ),
    },
    "/intercars/inventory/stock": {
      get: getOp("Stock GET (legacy shortcut)", "InterCars · Legacy", icStockQuery),
      post: postJsonOp(
        "Stock POST (legacy shortcut)",
        "InterCars · Legacy",
        "#/components/schemas/IcStockPostRequest",
        { sku: "ADDFFF" },
      ),
    },
    "/intercars/customer": {
      get: getOp("Customer (legacy shortcut)", "InterCars · Legacy"),
    },
    "/intercars/customer/finances": {
      get: getOp("Customer finances (legacy shortcut)", "InterCars · Legacy"),
    },
    "/intercars/orders/submit": {
      post: postJsonOp(
        "Submit order (legacy shortcut → sales/requisition)",
        "InterCars · Legacy",
        "#/components/schemas/IcRequisitionRequest",
        { lines: [{ sku: "ADDFFF", quantity: 1 }] },
      ),
    },
    "/intercars/oauth/token": {
      post: {
        summary: "OAuth token (legacy shortcut)",
        tags: ["InterCars · Legacy"],
        responses: { 200: jsonResponse("OAuth token payload") },
      },
    },
  };
}

function buildServicesPaths() {
  return {
    "/getProductsByCategory": {
      get: {
        ...getOp("Products by category (GET)", "Services", [
          {
            name: "category",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          ...[
            "sku",
            "index",
            "quantity",
            "location",
            "shipTo",
          ].map((name) => ({
            name,
            in: "query",
            schema: { type: "string" },
          })),
        ]),
      },
      post: postJsonOp(
        "Products by category (POST)",
        "Services",
        "#/components/schemas/GetProductsByCategoryRequest",
        { category: "filters", sku: "ADDFFF", quantity: 1 },
      ),
    },
    "/updateProductsByTecDocId": {
      post: postJsonOp(
        "Fetch Aldoc article by TecDoc id",
        "Services",
        "#/components/schemas/UpdateProductsByTecDocIdRequest",
        { tecdocIds: ["12345"] },
      ),
    },
    "/createCsvFiles": {
      post: postJsonOp(
        "Download and parse InterCars stock CSV zip",
        "Services",
        "#/components/schemas/CreateCsvFilesRequest",
        {
          zipUrl:
            "https://data.webapi.intercars.eu/customer/XXX/Stock/Stock_2025-01-31.csv.zip",
          outputPath: "./output.csv",
        },
      ),
    },
  };
}

function buildAdminPaths() {
  return {
    "/admin/price-comparison/autodoc": {
      get: {
        summary: "Scrape Autodoc listing for price comparison",
        tags: ["Admin"],
        parameters: [
          {
            name: "url",
            in: "query",
            required: true,
            schema: { type: "string", format: "uri" },
            description: "Full https://www.autodoc.nl/... product listing URL",
          },
        ],
        responses: {
          200: jsonResponse("Scrape result", "#/components/schemas/AutodocScrapeResponse"),
          400: jsonResponse("Missing url", "#/components/schemas/AutodocScrapeResponse"),
          500: jsonResponse("Scrape error", "#/components/schemas/AutodocScrapeResponse"),
        },
      },
    },
  };
}

function buildAldocProxyPath() {
  return {
    "/PartServices/api/v2/{path}": {
      get: {
        summary: "Aldoc PartServices proxy (GET)",
        description:
          "Any unmatched route is forwarded to https://partscentraalws.aldoc.eu. Example: GET /PartServices/api/v2/Articles/{tecdocId}",
        tags: ["Aldoc Proxy"],
        parameters: [
          {
            name: "path",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Remaining path after /PartServices/api/v2/",
          },
        ],
        responses: { 200: { description: "Proxied Aldoc response" } },
      },
      post: {
        summary: "Aldoc PartServices proxy (POST)",
        tags: ["Aldoc Proxy"],
        parameters: [
          {
            name: "path",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 200: { description: "Proxied Aldoc response" } },
      },
    },
  };
}

function buildComponents() {
  return {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "Backend API key (see API_KEY in .env)",
      },
      ApiSecretAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-secret",
        description: "Backend API secret (see API_SECRET in .env)",
      },
    },
    schemas: {
      ErrorMessage: {
        type: "object",
        properties: {
          message: { type: "string" },
          error: { type: "string" },
        },
      },
      InterPartsRequest: {
        type: "object",
        description:
          "Inner Falcon5 method parameters. Wrapped as {\"methodName\": params} upstream. sessionId auto-injected except getVersion/doLogin.",
        additionalProperties: true,
      },
      AutoPartnerRequest: {
        type: "object",
        description:
          "AutoPartner CustomerAPI body. clientCode, wsPassword, clientPassword added server-side.",
        properties: {
          departamentCode: { type: "string", example: "CN" },
          currencyCode: { type: "string", example: "EUR" },
          productCode: { type: "string" },
          productsCodes: { type: "array", items: { type: "string" } },
          amount: {
            oneOf: [
              { type: "number" },
              { type: "array", items: { type: "number" } },
            ],
          },
          orderItemList: {
            type: "array",
            items: { $ref: "#/components/schemas/AutoPartnerOrderItem" },
          },
          comments: { type: "string" },
          orderNumber: {
            type: "string",
            description:
              "Friendly alias mapped to externalOrderId on InsertOrder.",
          },
          customerName: {
            type: "string",
            description:
              "Friendly alias appended to comments on InsertOrder.",
          },
          zone: { type: "string", example: "03" },
          externalOrderId: {
            type: "string",
            description: "AutoPartner external order reference (AP §2.10).",
          },
        },
        additionalProperties: true,
      },
      AutoPartnerOrderItem: {
        type: "object",
        properties: {
          ProductCode: { type: "string" },
          Quantity: { type: "number" },
          QuantityP: { type: "number" },
          PositionNumber: { type: "string" },
        },
      },
      IcPricingQuoteRequest: {
        type: "object",
        properties: {
          sku: { type: "string", example: "ADDFFF" },
          skus: { type: "array", items: { type: "string" } },
          index: { type: "string" },
          indices: { type: "array", items: { type: "string" } },
          quantity: { type: "integer", default: 1 },
          location: {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
            ],
            example: ["KOM"],
          },
          shipTo: { type: "string" },
          lines: {
            type: "array",
            items: { $ref: "#/components/schemas/IcQuoteLine" },
          },
        },
      },
      IcQuoteLine: {
        type: "object",
        properties: {
          sku: { type: "string" },
          index: { type: "string" },
          quantity: { type: "integer" },
        },
      },
      IcStockPostRequest: {
        type: "object",
        properties: {
          sku: {
            type: "string",
            description: "Comma-separated SKUs",
            example: "ADDFFF,ADDFA",
          },
        },
        required: ["sku"],
      },
      IcRequisitionRequest: {
        type: "object",
        description:
          "Forwarded to InterCars /sales/requisition. orderNumber maps to customNumber; customerName maps to comments.",
        properties: {
          orderNumber: { type: "string", example: "PO-12345" },
          customerName: { type: "string", example: "Jan Kowalski" },
          customNumber: {
            type: "string",
            description: "InterCars external order reference.",
          },
          comments: { type: "string" },
          shipTo: { type: "string" },
          deliveryMethod: { type: "string" },
        },
        additionalProperties: true,
      },
      GetProductsByCategoryRequest: {
        type: "object",
        required: ["category"],
        properties: {
          category: { type: "string", example: "filters" },
          sku: { type: "string" },
          index: { type: "string" },
          quantity: { type: "integer" },
          location: { type: "string" },
          shipTo: { type: "string" },
        },
      },
      UpdateProductsByTecDocIdRequest: {
        type: "object",
        required: ["tecdocIds"],
        properties: {
          tecdocIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
        },
      },
      CreateCsvFilesRequest: {
        type: "object",
        properties: {
          zipUrl: { type: "string", format: "uri" },
          outputPath: { type: "string", example: "./output.csv" },
          icUsername: { type: "string" },
          icPassword: { type: "string" },
        },
      },
      AutodocScrapeResponse: {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
              message: { type: "string" },
              products: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
  };
}

function buildTags() {
  const tags = [
    { name: "Admin", description: "Internal admin utilities" },
    { name: "Services", description: "Parts Centraal service endpoints" },
    { name: "InterCars", description: "InterCars IC API (/intercars/ic/...)" },
    {
      name: "InterCars · Legacy",
      description: "Shortcut routes under /intercars/...",
    },
    { name: "AutoPartner", description: "AutoPartner CustomerAPI proxy" },
  ];

  for (const group of Object.keys(INTERPARTS_GROUPS)) {
    tags.push({
      name: `InterParts · ${group}`,
      description: `InterParts Falcon5 WebService — ${group}`,
    });
  }

  tags.push({
    name: "Aldoc Proxy",
    description: "Catch-all proxy to partscentraalws.aldoc.eu",
  });

  return tags;
}

function buildOpenApiSpec() {
  const port = process.env.PORT || 3000;
  return {
    openapi: "3.0.3",
    info: {
      title: "Parts Centraal Backend API",
      version: "1.0.0",
      description: [
        "Unified API gateway for Parts Centraal integrations.",
        "",
        "**Authentication:** Most routes require `x-api-key` and `x-api-secret` headers.",
        "Set `SKIP_API_AUTH=1` locally to disable.",
        "",
        "**InterParts:** MD5 password login; session cached in Redis.",
        "**AutoPartner:** Credentials injected from env.",
        "**InterCars:** OAuth client-credentials token cached in Redis.",
      ].join("\n"),
    },
    servers: [{ url: `http://localhost:${port}`, description: "Local dev" }],
    tags: buildTags(),
    security: [{ ApiKeyAuth: [], ApiSecretAuth: [] }],
    paths: {
      ...buildAdminPaths(),
      ...buildServicesPaths(),
      ...buildInterCarsPaths(),
      ...buildAutoPartnerPaths(),
      ...buildInterPartsPaths(),
      ...buildAldocProxyPath(),
    },
    components: buildComponents(),
  };
}

module.exports = { buildOpenApiSpec };
