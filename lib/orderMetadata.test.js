const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  applyAutopartnerOrderMetadata,
  applyIntercarsOrderMetadata,
  mergeCustomerIntoComments,
} = require("./orderMetadata");

describe("order metadata", () => {
  it("maps orderNumber and customerName for AutoPartner", () => {
    const body = applyAutopartnerOrderMetadata({
      orderNumber: "PO-123",
      customerName: "Jan Kowalski",
      orderItemList: [{ ProductCode: "GDB1330", Quantity: 1 }],
    });
    assert.strictEqual(body.externalOrderId, "PO-123");
    assert.strictEqual(body.comments, "Jan Kowalski");
    assert.strictEqual(body.orderNumber, undefined);
    assert.strictEqual(body.customerName, undefined);
  });

  it("maps orderNumber and customerName for InterCars", () => {
    const body = applyIntercarsOrderMetadata({
      orderNumber: "PO-456",
      customerName: "Anna Nowak",
      lines: [{ sku: "ADDFFF", quantity: 1 }],
    });
    assert.strictEqual(body.customNumber, "PO-456");
    assert.strictEqual(body.comments, "Anna Nowak");
  });

  it("appends customer name to existing comments", () => {
    assert.strictEqual(
      mergeCustomerIntoComments("Rush delivery", "Jan Kowalski"),
      "Rush delivery | Customer: Jan Kowalski",
    );
  });

  it("does not override explicit externalOrderId or customNumber", () => {
    const ap = applyAutopartnerOrderMetadata({
      orderNumber: "PO-1",
      externalOrderId: "KEEP-AP",
    });
    assert.strictEqual(ap.externalOrderId, "KEEP-AP");

    const ic = applyIntercarsOrderMetadata({
      orderNumber: "PO-2",
      customNumber: "KEEP-IC",
    });
    assert.strictEqual(ic.customNumber, "KEEP-IC");
  });
});
