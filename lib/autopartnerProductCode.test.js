const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  decodeAutopartnerTowKod,
  normalizeAutopartnerProductCode,
  normalizeAutopartnerProductCodes,
} = require("./autopartnerProductCode");

describe("autopartnerProductCode", () => {
  it("decodes oil tow_kod separators for AP API", () => {
    assert.strictEqual(
      decodeAutopartnerTowKod("5W40~MAGN~DUAL~C3~1L"),
      "5W40 MAGN DUAL C3 1L",
    );
  });

  it("normalizes internal product_id to spaced AP index name", () => {
    assert.strictEqual(
      normalizeAutopartnerProductCode("0025W40~MAGN~DUAL~C3~1L"),
      "5W40 MAGN DUAL C3 1L",
    );
  });

  it("leaves regular AP codes unchanged", () => {
    assert.strictEqual(normalizeAutopartnerProductCode("00215F621"), "15F621");
    assert.strictEqual(normalizeAutopartnerProductCode("GDB1330"), "GDB1330");
  });

  it("deduplicates normalized batch codes", () => {
    assert.deepStrictEqual(
      normalizeAutopartnerProductCodes([
        "0025W40~MAGN~DUAL~C3~1L",
        "5W40~MAGN~DUAL~C3~1L",
        "GDB1330",
      ]),
      ["5W40 MAGN DUAL C3 1L", "GDB1330"],
    );
  });
});
