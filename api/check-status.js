// ============================================================
//  API: CHECK PAYMENT STATUS
//  Endpoint: POST /api/check-status
//  Integration: Pakasir Payment Gateway
// ============================================================

const crypto = require("crypto");

// ==================== CONFIG ====================
const PROJECT_SLUG = process.env.PROJECT_SLUG || "cupzyyy";
const API_KEY = process.env.API_KEY || "x5ex44h3cexOAvi37EOEKMlFvRPsGa3f";
const PAKASIR_BASE = "https://app.pakasir.com/api";

// ==================== IMPORT ORDER STORE ====================
let orderStore;
let findProduct;

try {
  const createOrder = require("./create-order");
  orderStore = createOrder.orderStore;
  findProduct = createOrder.findProduct;
} catch (e) {
  console.error("[CHECK-STATUS] Failed to import orderStore:", e.message);
  orderStore = new Map();
  findProduct = () => null;
}

// ==================== HELPER FUNCTIONS ====================

function formatRupiah(num) {
  return "Rp " + Number(num).toLocaleString("id-ID");
}

function normalizeStatus(rawStatus) {
  if (!rawStatus || typeof rawStatus !== "string") return "pending";

  const status = rawStatus.toLowerCase().trim();

  if (status === "paid" || status === "success" || status === "settlement" || status === "completed") {
    return "paid";
  }

  if (status === "expired" || status === "expire") {
    return "expired";
  }

  if (status === "failed" || status === "fail" || status === "error") {
    return "failed";
  }

  if (status === "cancel" || status === "cancelled" || status === "canceled") {
    return "cancelled";
  }

  if (status === "refund" || status === "refunded") {
    return "refunded";
  }

  return "pending";
}

function processAutoDeliver(orderId) {
  if (!orderStore || !orderStore.has(orderId)) {
    console.log(`[AUTO-DELIVER] Order ${orderId} not found in store`);
    return;
  }

  const order = orderStore.get(orderId);

  if (order.status === "delivered") {
    console.log(`[AUTO-DELIVER] Order ${orderId} already delivered`);
    return;
  }

  console.log("");
  console.log("╔═══════════════════════════════════════╗");
  console.log("║     🚀 AUTO DELIVERING PRODUCT...      ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`[DELIVER] Order: ${orderId}`);
  console.log(`[DELIVER] Product: ${order.product_name} x${order.quantity}`);
  console.log(`[DELIVER] Buyer: ${order.buyer_email}`);

  order.status = "delivered";
  order.delivered_at = new Date().toISOString();

  const codePrefix = order.product_category === "cheat" ? "CHT" : "LIC";

  order.delivery_code = `${codePrefix}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

  order.delivery_message = `Produk "${order.product_name}" x${order.quantity} berhasil dikirim ke ${order.buyer_email}. Kode: ${order.delivery_code}`;

  try {
    const product = findProduct(order.product_id);
    if (product) {
      product.stock = Math.max(0, product.stock - order.quantity);
      console.log(`[STOCK] ${product.name} stock updated: ${product.stock}`);
    }
  } catch (e) {
    console.log("[STOCK] Failed to update stock:", e.message);
  }

  orderStore.set(orderId, order);

  console.log(`[DELIVER] ✅ SUCCESS!`);
  console.log(`[DELIVER] Code: ${order.delivery_code}`);
  console.log(`[DELIVER] Message: ${order.delivery_message}`);
  console.log("");

  // In production: send email to buyer
  // sendEmail(order.buyer_email, order.delivery_code, order);
}

// ==================== MAIN HANDLER ====================

async function checkStatusHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const orderId = (req.body.order_id || "").trim();

    if (!orderId) {
      console.log("[CHECK-STATUS] Missing order_id");
      return res.json({
        ok: false,
        error: "Order ID diperlukan"
      });
    }

    console.log(`[CHECK-STATUS] Checking: ${orderId}`);

    const order = orderStore.get(orderId);

    if (!order) {
      console.log(`[CHECK-STATUS] Order not found: ${orderId}`);
      return res.json({
        ok: false,
        error: "Order tidak ditemukan",
        status: "not_found"
      });
    }

    if (order.status === "delivered") {
      console.log(`[CHECK-STATUS] ${orderId} -> DELIVERED (cached)`);
      return res.json({
        ok: true,
        status: "delivered",
        order: order
      });
    }

    if (order.status === "paid") {
      console.log(`[CHECK-STATUS] ${orderId} -> PAID (cached, triggering delivery)`);

      setTimeout(() => processAutoDeliver(orderId), 1000);

      return res.json({
        ok: true,
        status: "paid",
        order: order
      });
    }

    if (order.status === "expired" || order.status === "failed" || order.status === "cancelled") {
      console.log(`[CHECK-STATUS] ${orderId} -> ${order.status.toUpperCase()} (cached)`);
      return res.json({
        ok: true,
        status: order.status,
        order: order
      });
    }

    console.log(`[CHECK-STATUS] ${orderId} -> PENDING, checking Pakasir...`);

    const pakasirUrl = new URL(`${PAKASIR_BASE}/transactiondetail`);
    pakasirUrl.searchParams.set("project", PROJECT_SLUG);
    pakasirUrl.searchParams.set("amount", String(order.total_amount));
    pakasirUrl.searchParams.set("order_id", orderId);
    pakasirUrl.searchParams.set("api_key", API_KEY);

    console.log(`[PAKASIR] GET ${pakasirUrl.toString().replace(API_KEY, "***")}`);

    const pakasirResponse = await fetch(pakasirUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    const pakasirText = await pakasirResponse.text();
    let pakasirJson;

    try {
      pakasirJson = JSON.parse(pakasirText);
    } catch (parseError) {
      console.error("[PAKASIR] Parse error:", pakasirText.substring(0, 200));
      return res.json({
        ok: true,
        status: "pending",
        order: order
      });
    }

    console.log(`[PAKASIR] Response:`, JSON.stringify(pakasirJson).substring(0, 200));

    const transaction = pakasirJson.transaction || pakasirJson;
    const rawStatus = transaction.status || "pending";
    const normalizedStatus = normalizeStatus(rawStatus);

    console.log(`[PAKASIR] Raw status: "${rawStatus}" -> Normalized: "${normalizedStatus}"`);

    if (normalizedStatus === "paid") {
      console.log("");
      console.log("╔═══════════════════════════════════════╗");
      console.log("║     💰 PAYMENT CONFIRMED!              ║");
      console.log("╚═══════════════════════════════════════╝");
      console.log(`[PAID] Order: ${orderId}`);
      console.log(`[PAID] Amount: ${formatRupiah(order.total_amount)}`);
      console.log(`[PAID] Product: ${order.product_name}`);
      console.log(`[PAID] Buyer: ${order.buyer_email}`);

      order.status = "paid";
      order.paid_at = new Date().toISOString();
      orderStore.set(orderId, order);

      setTimeout(() => processAutoDeliver(orderId), 2000);

      return res.json({
        ok: true,
        status: "paid",
        order: order
      });
    }

    if (normalizedStatus === "expired" || normalizedStatus === "failed" || normalizedStatus === "cancelled") {
      console.log(`[STATUS] ${orderId} -> ${normalizedStatus.toUpperCase()}`);

      order.status = normalizedStatus;
      orderStore.set(orderId, order);

      return res.json({
        ok: true,
        status: normalizedStatus,
        order: order
      });
    }

    console.log(`[STATUS] ${orderId} -> PENDING (still waiting)`);

    return res.json({
      ok: true,
      status: "pending",
      order: order
    });

  } catch (error) {
    console.error("");
    console.error("❌ CHECK-STATUS ERROR:");
    console.error("   Message:", error.message);
    console.error("   Stack:", error.stack);
    console.error("");

    return res.json({
      ok: true,
      status: "pending"
    });
  }
}

// ==================== EXPORTS ====================
module.exports = checkStatusHandler;
module.exports.processAutoDeliver = processAutoDeliver;
module.exports.normalizeStatus = normalizeStatus;
