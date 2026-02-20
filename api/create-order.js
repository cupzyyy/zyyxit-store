// ============================================================
//  API: CREATE ORDER + QRIS PAYMENT
//  Endpoint: POST /api/create-order
//  Integration: Pakasir Payment Gateway
// ============================================================

const crypto = require("crypto");

// ==================== CONFIG ====================
const PROJECT_SLUG = process.env.PROJECT_SLUG || "cupzyyy";
const API_KEY = process.env.API_KEY || "x5ex44h3cexOAvi37EOEKMlFvRPsGa3f";
const PAKASIR_BASE = "https://app.pakasir.com/api";

// ==================== PRODUCTS DATABASE ====================
const PRODUCTS = [
  {
    id: "body-hs-100",
    name: "BODY HS 100%",
    description: "Work disemua device",
    price: 50000,
    icon: "🎯",
    category: "cheat",
    stock: 999,
    popular: true
  },
  {
    id: "aimbot-100",
    name: "AIMBOT 100%",
    description: "Work disemua device",
    price: 20000,
    icon: "🤖",
    category: "cheat",
    stock: 999,
    popular: true
  },
  {
    id: "headlock-100",
    name: "HEADLOCK 100%",
    description: "Work disemua device",
    price: 15000,
    icon: "🔒",
    category: "cheat",
    stock: 999,
    popular: false
  },
  {
    id: "aimlock-100",
    name: "AIMLOCK 100%",
    description: "Work disemua device",
    price: 5000,
    icon: "🎮",
    category: "cheat",
    stock: 999,
    popular: false
  }
];

// ==================== HELPER FUNCTIONS ====================

function generateOrderId(prefix = "ORD") {
  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${randomHex}`;
}

function extractQris(str) {
  if (!str) return null;
  if (str.startsWith("00020101")) return str;
  const idx = str.indexOf("00020101");
  if (idx !== -1) return str.substring(idx);
  return null;
}

function formatRupiah(num) {
  return "Rp " + Number(num).toLocaleString("id-ID");
}

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function findProduct(productId) {
  if (!productId || typeof productId !== "string") return null;
  return PRODUCTS.find(p => p.id === productId) || null;
}

function sanitize(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/[<>"'&]/g, "").trim().substring(0, 200);
}

// ==================== ORDER STORE ====================
const orderStore = new Map();

// ==================== MAIN HANDLER ====================

async function createOrderHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Use POST."
    });
  }

  try {
    const productId = sanitize(req.body.product_id);
    const buyerEmail = sanitize(req.body.buyer_email);
    const buyerName = sanitize(req.body.buyer_name) || "Guest";
    const quantity = parseInt(req.body.quantity) || 1;

    console.log("");
    console.log("╔═══════════════════════════════════════╗");
    console.log("║      📦 NEW ORDER REQUEST RECEIVED     ║");
    console.log("╚═══════════════════════════════════════╝");
    console.log(`[INPUT] Product: ${productId}`);
    console.log(`[INPUT] Email: ${buyerEmail}`);
    console.log(`[INPUT] Name: ${buyerName}`);
    console.log(`[INPUT] Qty: ${quantity}`);

    if (!productId) {
      console.log("[ERROR] Product ID kosong");
      return res.json({
        ok: false,
        error: "Pilih produk terlebih dahulu"
      });
    }

    if (!buyerEmail) {
      console.log("[ERROR] Email kosong");
      return res.json({
        ok: false,
        error: "Masukkan email atau nomor WhatsApp"
      });
    }

    if (quantity < 1) {
      console.log("[ERROR] Qty kurang dari 1");
      return res.json({
        ok: false,
        error: "Jumlah minimal 1"
      });
    }

    if (quantity > 99) {
      console.log("[ERROR] Qty lebih dari 99");
      return res.json({
        ok: false,
        error: "Jumlah maksimal 99"
      });
    }

    const product = findProduct(productId);

    if (!product) {
      console.log("[ERROR] Produk tidak ditemukan:", productId);
      return res.json({
        ok: false,
        error: "Produk tidak ditemukan"
      });
    }

    console.log(`[PRODUCT] ${product.name} | ${formatRupiah(product.price)} | Stock: ${product.stock}`);

    if (product.stock < quantity) {
      console.log("[ERROR] Stok tidak cukup. Stock:", product.stock, "Requested:", quantity);
      return res.json({
        ok: false,
        error: `Stok tidak mencukupi. Tersisa ${product.stock} item.`
      });
    }

    const totalAmount = product.price * quantity;

    console.log(`[CALC] ${formatRupiah(product.price)} x ${quantity} = ${formatRupiah(totalAmount)}`);

    if (totalAmount < 1000) {
      console.log("[ERROR] Total kurang dari Rp 1.000");
      return res.json({
        ok: false,
        error: "Minimal total pembayaran Rp 1.000"
      });
    }

    if (totalAmount > 10000000) {
      console.log("[ERROR] Total lebih dari Rp 10.000.000");
      return res.json({
        ok: false,
        error: "Maksimal total pembayaran Rp 10.000.000"
      });
    }

    const orderId = generateOrderId("ORD");
    console.log(`[ORDER] Generated ID: ${orderId}`);

    if (!API_KEY) {
      console.log("[WARNING] API_KEY belum di-set!");
    }

    console.log("[PAKASIR] Creating QRIS payment...");
    console.log(`[PAKASIR] Slug: ${PROJECT_SLUG}`);
    console.log(`[PAKASIR] Amount: ${totalAmount}`);
    console.log(`[PAKASIR] Order ID: ${orderId}`);

    const pakasirPayload = {
      project: PROJECT_SLUG,
      order_id: orderId,
      amount: totalAmount,
      api_key: API_KEY
    };

    console.log("[PAKASIR] Sending request to:", `${PAKASIR_BASE}/transactioncreate/qris`);

    const pakasirResponse = await fetch(`${PAKASIR_BASE}/transactioncreate/qris`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(pakasirPayload)
    });

    const pakasirText = await pakasirResponse.text();
    let pakasirJson;

    try {
      pakasirJson = JSON.parse(pakasirText);
    } catch (parseError) {
      console.error("[PAKASIR] Failed to parse response:", pakasirText.substring(0, 200));
      return res.json({
        ok: false,
        error: "Gateway error: Invalid response from payment provider"
      });
    }

    console.log("[PAKASIR] Response status:", pakasirResponse.status);
    console.log("[PAKASIR] Response:", JSON.stringify(pakasirJson).substring(0, 300));

    const payment = pakasirJson.payment;

    if (!payment) {
      console.error("[PAKASIR] No payment object in response");
      console.error("[PAKASIR] Full response:", JSON.stringify(pakasirJson));
      return res.json({
        ok: false,
        error: "Gagal membuat pembayaran. Coba lagi nanti."
      });
    }

    if (!payment.payment_number) {
      console.error("[PAKASIR] No payment_number in payment object");
      console.error("[PAKASIR] Payment:", JSON.stringify(payment));
      return res.json({
        ok: false,
        error: "Gagal mendapatkan QRIS. Coba lagi nanti."
      });
    }

    const rawQris = payment.payment_number;
    const qris = extractQris(rawQris);

    console.log("[QRIS] Raw length:", rawQris.length);
    console.log("[QRIS] Raw preview:", rawQris.substring(0, 50) + "...");

    if (!qris) {
      console.error("[QRIS] Failed to extract valid QRIS from:", rawQris.substring(0, 100));
      return res.json({
        ok: false,
        error: "QRIS tidak valid dari gateway. Coba lagi."
      });
    }

    console.log("[QRIS] Valid QRIS extracted, length:", qris.length);

    const totalPayment = payment.total_payment || totalAmount;
    const fee = payment.fee || 0;
    const expiredAt = payment.expired_at || null;

    console.log(`[PAYMENT] Total Payment: ${formatRupiah(totalPayment)}`);
    console.log(`[PAYMENT] Fee: ${formatRupiah(fee)}`);
    console.log(`[PAYMENT] Expired: ${expiredAt || "N/A"}`);

    const orderData = {
      order_id: orderId,
      product_id: product.id,
      product_name: product.name,
      product_icon: product.icon,
      product_description: product.description,
      product_category: product.category,
      quantity: quantity,
      unit_price: product.price,
      total_amount: totalAmount,
      total_payment: totalPayment,
      fee: fee,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      qris: qris,
      status: "pending",
      created_at: new Date().toISOString(),
      expired_at: expiredAt,
      paid_at: null,
      delivered_at: null,
      delivery_code: null,
      delivery_message: null
    };

    orderStore.set(orderId, orderData);

    console.log("");
    console.log("✅ ORDER CREATED SUCCESSFULLY!");
    console.log(`   ID: ${orderId}`);
    console.log(`   Product: ${product.name} x${quantity}`);
    console.log(`   Amount: ${formatRupiah(totalAmount)}`);
    console.log(`   Buyer: ${buyerEmail}`);
    console.log(`   Status: PENDING (Waiting Payment)`);
    console.log("");

    return res.json({
      ok: true,
      order_id: orderId,
      product_name: product.name,
      product_icon: product.icon,
      product_description: product.description,
      quantity: quantity,
      unit_price: product.price,
      total_amount: totalAmount,
      total_payment: totalPayment,
      fee: fee,
      qris: qris,
      expired_at: expiredAt,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      created_at: orderData.created_at
    });

  } catch (error) {
    console.error("");
    console.error("❌ CREATE ORDER ERROR:");
    console.error("   Message:", error.message);
    console.error("   Stack:", error.stack);
    console.error("");

    return res.json({
      ok: false,
      error: "Server error. Silakan coba lagi."
    });
  }
}

// ==================== EXPORTS ====================
module.exports = createOrderHandler;
module.exports.orderStore = orderStore;
module.exports.PRODUCTS = PRODUCTS;
module.exports.findProduct = findProduct;
module.exports.extractQris = extractQris;
module.exports.formatRupiah = formatRupiah;
module.exports.generateOrderId = generateOrderId;
