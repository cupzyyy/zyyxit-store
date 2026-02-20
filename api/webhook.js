// ============================================================
//  API: WEBHOOK RECEIVER
//  Endpoint: POST /api/webhook
//  Receives payment notifications from Pakasir
// ============================================================

const crypto = require("crypto");

// ==================== CONFIG ====================
const PROJECT_SLUG = process.env.PROJECT_SLUG || "cupzyyy";
const API_KEY = process.env.API_KEY || "x5ex44h3cexOAvi37EOEKMlFvRPsGa3f";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

// ==================== IMPORT SHARED MODULES ====================
let orderStore;
let processAutoDeliver;
let normalizeStatus;

try {
  const createOrder = require("./create-order");
  orderStore = createOrder.orderStore;

  const checkStatus = require("./check-status");
  processAutoDeliver = checkStatus.processAutoDeliver;
  normalizeStatus = checkStatus.normalizeStatus;

} catch (e) {
  console.error("[WEBHOOK] Failed to import modules:", e.message);
  orderStore = new Map();
  processAutoDeliver = () => { };
  normalizeStatus = (s) => (s || "pending").toLowerCase();
}

// ==================== HELPER FUNCTIONS ====================

function formatRupiah(num) {
  return "Rp " + Number(num).toLocaleString("id-ID");
}

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET || !signature) {
    return true;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

  } catch (e) {
    console.error("[WEBHOOK] Signature verification error:", e.message);
    return false;
  }
}

function getClientIp(req) {
  return req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown";
}

function logWebhookEvent(event, data) {
  const timestamp = new Date().toISOString();
  console.log(`[WEBHOOK][${timestamp}] ${event}:`, typeof data === "object" ? JSON.stringify(data) : data);
}

// ==================== WEBHOOK HISTORY ====================
const webhookHistory = [];
const MAX_WEBHOOK_HISTORY = 100;

function saveWebhookHistory(entry) {
  webhookHistory.unshift(entry);
  if (webhookHistory.length > MAX_WEBHOOK_HISTORY) {
    webhookHistory.pop();
  }
}

// ==================== MAIN HANDLER ====================

async function webhookHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed. Webhook only accepts POST."
    });
  }

  const clientIp = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";
  const contentType = req.headers["content-type"] || "unknown";
  const signature = req.headers["x-webhook-signature"] ||
    req.headers["x-pakasir-signature"] || "";

  const receivedAt = new Date().toISOString();

  console.log("");
  console.log("╔═══════════════════════════════════════╗");
  console.log("║     📨 WEBHOOK RECEIVED                ║");
  console.log("╚═══════════════════════════════════════╝");
  console.log(`[WEBHO
