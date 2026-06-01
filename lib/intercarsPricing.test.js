const { describe, it } = require("node:test");
const assert = require("node:assert");
const { buildPricingQuoteBody } = require("./intercarsPricing");

describe("buildPricingQuoteBody", () => {
  it("wraps sku in lines with location KOM", () => {
    const body = buildPricingQuoteBody({ sku: "ADDFFF", quantity: 2 });
    assert.deepStrictEqual(body, {
      location: ["KOM"],
      lines: [{ sku: "ADDFFF", quantity: 2 }],
    });
  });

  it("supports IC index lookup", () => {
    const body = buildPricingQuoteBody({ index: "C39251" });
    assert.deepStrictEqual(body.lines, [{ index: "C39251", quantity: 1 }]);
  });

  it("passes through lines array", () => {
    const body = buildPricingQuoteBody({
      lines: [{ sku: "ADDFFA", quantity: 5 }],
    });
    assert.deepStrictEqual(body.lines, [{ sku: "ADDFFA", quantity: 5 }]);
  });
});
