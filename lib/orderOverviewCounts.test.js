const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getOrderItemStatuses,
  isOrderFullyDelivered,
  countFullyDeliveredOrders,
} = require("./orderOverviewCounts");

test("isOrderFullyDelivered requires every line to be delivered", () => {
  assert.equal(
    isOrderFullyDelivered({
      order_id: "PC-1",
      item_statuses: "delivered,delivered",
    }),
    true,
  );
  assert.equal(
    isOrderFullyDelivered({
      order_id: "PC-2",
      item_statuses: "delivered,shipped",
    }),
    false,
  );
});

test("getOrderItemStatuses reads nested items", () => {
  assert.deepEqual(
    getOrderItemStatuses({
      order_id: "PC-3",
      items: [
        { product_id: "a", item_status: "delivered" },
        { product_id: "b", item_status: "pending" },
      ],
    }),
    ["delivered", "pending"],
  );
});

test("countFullyDeliveredOrders dedupes by order_id", () => {
  assert.equal(
    countFullyDeliveredOrders([
      { order_id: "PC-4", item_statuses: "delivered" },
      { order_id: "PC-4", item_statuses: "delivered" },
      { order_id: "PC-5", item_statuses: "delivered,shipped" },
    ]),
    1,
  );
});
