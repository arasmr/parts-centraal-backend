/**
 * Order-level overview helpers (mirrors partscentraal-admin-app logic).
 * An order counts as delivered only when every line item is delivered.
 */

function getOrderItemStatuses(order) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((item) => (item.item_status ?? "pending").trim());
  }
  if (typeof order.item_statuses === "string" && order.item_statuses.length > 0) {
    return order.item_statuses
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean);
  }
  return [];
}

function isOrderFullyDelivered(order) {
  const statuses = getOrderItemStatuses(order);
  if (statuses.length === 0) {
    return false;
  }
  return statuses.every((status) => status === "delivered");
}

function countFullyDeliveredOrders(orders) {
  const seen = new Set();
  let count = 0;

  for (const order of orders) {
    if (!order?.order_id || seen.has(order.order_id)) {
      continue;
    }
    seen.add(order.order_id);
    if (isOrderFullyDelivered(order)) {
      count += 1;
    }
  }

  return count;
}

module.exports = {
  getOrderItemStatuses,
  isOrderFullyDelivered,
  countFullyDeliveredOrders,
};
