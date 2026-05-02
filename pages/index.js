/**
 * ============================================================
 *  superB AI Brain — index.js
 *  superb.base.eth | Railway deployment
 * ============================================================
 */

const cron         = require("node-cron");
const express      = require("express");
const Scanner      = require("./src/scanner");
const SafetyFilter = require("./src/safety");
const Strategy     = require("./src/strategy");
const Executor     = require("./src/executor");
const Brain        = require("./src/brain");
const ChatHandler  = require("./src/chat");
require("dotenv").config();

const app = express();
app.use(express.json());

// ── CORS — allow frontend ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin",  "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:  "online",
    name:    "superB AI Brain",
    version: "2.0.0",
    uptime:  process.uptime(),
    time:    new Date().toISOString(),
    users:   Executor.openPositions?.size || 0,
  });
});

// ── Register user after USDC approval ────────────────────────────────────────
app.post("/register", async (req, res) => {
  try {
    const { userAddress, approvedAmount } = req.body;
    if (!userAddress || !approvedAmount) {
      return res.status(400).json({ error: "userAddress and approvedAmount required" });
    }
    Executor.registerUser(userAddress, approvedAmount);
    res.json({ success: true, message: `User ${userAddress.slice(0,8)}... registered` });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
  try {
    const { userAddress, message } = req.body;
    if (!userAddress || !message) {
      return res.status(400).json({ error: "userAddress and message required" });
    }
    const reply = await ChatHandler.handleMessage(userAddress, message);
    res.json({ reply }); // key is "reply" to match frontend
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Chat failed" });
  }
});

// ── Bot status endpoint ───────────────────────────────────────────────────────
app.get("/status/:userAddress", async (req, res) => {
  try {
    const status = await Brain.getUserStatus(req.params.userAddress);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Main trading loop — every 2 minutes ──────────────────────────────────────
cron.schedule("*/2 * * * *", async () => {
  console.log(`\n[${new Date().toISOString()}] 🔍 Scanning for opportunities...`);
  try {
    const opportunities = await Scanner.scan();
    console.log(`Found ${opportunities.length} potential opportunities`);

    for (const token of opportunities) {
      const isSafe = await SafetyFilter.check(token.address);
      if (!isSafe) {
        console.log(`⚠️  Skipping ${token.symbol} — failed safety check`);
        continue;
      }
      const signal = await Strategy.analyze(token);
      if (!signal.shouldTrade) {
        console.log(`📊 Skipping ${token.symbol} — no strong signal`);
        continue;
      }
      await Executor.executeForAllUsers(token, signal);
    }
  } catch (err) {
    console.error("Trading loop error:", err.message);
  }
});

// ── Learning loop — every 30 minutes ─────────────────────────────────────────
cron.schedule("*/30 * * * *", async () => {
  console.log(`\n[${new Date().toISOString()}] 🧠 Running learning cycle...`);
  try {
    await Brain.learn();
    console.log("✅ Learning cycle complete");
  } catch (err) {
    console.error("Learning error:", err.message);
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("\n========================================");
  console.log("  🚀 superB AI Brain v2.0 Online");
  console.log("  superb.base.eth — No Vault Model");
  console.log("========================================");
  console.log(`  Port:    ${PORT}`);
  console.log(`  Network: Base Mainnet`);
  console.log("========================================\n");
});