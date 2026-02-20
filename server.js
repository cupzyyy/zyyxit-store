// ============================================================
//  MAIN SERVER: Auto Order + Pakasir Payment Gateway
//  Production Ready Node.js/Express Server
// ============================================================

const express = require("express");
const cors = require("cors");
const path = require("path");

// Import API handlers
const createOrderHandler = require("./api/create-order");
const checkStatusHandler = require("./api/check-status");
const webhookHandler = require("./api/webhook");

// ==================== CONFIG ====================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ==================== INIT APP ====================
const app = express();

// ==================== MIDDLEWARE ====================
// Enable CORS for all origins (production: restrict to your domain)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Parse JSON body
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// ==================== STATIC FILES ====================
app.use(express.static(path.join(__dirname, "public")));

// ==================== API ROUTES ====================

/**
 * POST /api/create-order
 * Create new order with QRIS payment
 */
app.post("/api/create-order", createOrderHandler);

/**
 * POST /api/check-status
 * Check payment status
 */
app.post("/api/check-status", checkStatusHandler);

/**
 * POST /api/webhook
 * Receive payment notifications from Pakasir
 */
app.post("/api/webhook", webhookHandler);

/**
 * GET /api/webhook/history
 * Debug: View webhook history (admin only in production)
 */
app.get("/api/webhook/history", webhookHandler.getHistory);

// ==================== HEALTH CHECK ====================
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "running",
    timestamp: new Date().toISOString(),
    env: NODE_ENV
  });
});

// ==================== ROOT ROUTE ====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Endpoint not found",
    path: req.path,
    method: req.method
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("❌ SERVER ERROR:", err);
  res.status(500).json({
    ok: false,
    error: NODE_ENV === "production" ? "Internal server error" : err.message
  });
});

// ==================== START SERVER ====================
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log("");
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║     🚀 AUTO ORDER SERVER STARTED                   ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log(`   Port: ${PORT}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Pakasir Slug: ${process.env.PROJECT_SLUG || "cupzyyy"}`);
    console.log(`   API Key: ${process.env.API_KEY ? "✅ Set" : "❌ Not Set"}`);
    console.log("");
    console.log("   Endpoints:");
    console.log("   • POST /api/create-order  - Create order + QRIS");
    console.log("   • POST /api/check-status  - Check payment status");
    console.log("   • POST /api/webhook       - Pakasir webhook");
    console.log("   • GET  /api/health        - Health check");
    console.log("");
  });
}

// ==================== EXPORTS ====================
module.exports = app;
