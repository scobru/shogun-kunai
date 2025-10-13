#!/usr/bin/env node

/**
 * Gun Relay Server for Yumi (弓) & Yari (槍)
 *
 * This relay server helps Yumi/Yari peers discover each other
 * and relay messages when direct connections aren't possible.
 *
 * Usage:
 *   node relay/relay.js [port]
 *
 * Example:
 *   node relay/relay.js 8765
 */

import { ShogunCore } from "shogun-core";
import http from "http";
import fs from "fs";
import path from "path";

// Configuration
const PORT = process.argv[2] || 8765;
const HOST = "0.0.0.0";

// Create HTTP server
const server = http.createServer((req, res) => {
  // Serve simple status page for root
  if (req.url === "/" || req.url === "/status") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Gun Relay Server</title>
  <style>
    body {
      font-family: monospace;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #0f0f23;
      color: #00ff00;
    }
    h1 { text-shadow: 0 0 10px #00ff00; }
    .status { 
      padding: 10px; 
      background: #1a1a2e; 
      border: 1px solid #00ff00;
      border-radius: 4px;
      margin: 10px 0;
    }
    .info { color: #888; }
    code {
      background: #1a1a2e;
      padding: 2px 6px;
      border-radius: 3px;
      color: #00ff00;
    }
  </style>
</head>
<body>
  <h1>🏹 Yumi & Yari Gun Relay Server</h1>
  <div style="color: #888; font-size: 0.9em; margin-top: -10px; text-align: center;">Shogun P2P Messaging Infrastructure</div>
  
  <div class="status">
    <strong>Status:</strong> ✅ Online<br>
    <strong>Port:</strong> ${PORT}<br>
    <strong>Gun Endpoint:</strong> <code>http://localhost:${PORT}/gun</code> or <code>ws://localhost:${PORT}/gun</code><br>
    <strong>Uptime:</strong> <span id="uptime">0s</span>
  </div>
  
  <h2>Usage with Yumi (弓 - Plain P2P)</h2>
  <pre style="background: #1a1a2e; padding: 15px; border-radius: 4px; overflow-x: auto;">import { Yumi } from 'shogun-yumi';

const yumi = new Yumi('my-room', {
  announce: ['http://localhost:${PORT}/gun']
});</pre>

  <h2>Usage with Yari (槍 - Encrypted P2P)</h2>
  <pre style="background: #1a1a2e; padding: 15px; border-radius: 4px; overflow-x: auto;">import { Yari } from 'shogun-yumi';

const yari = new Yari('secret-room', {
  announce: ['http://localhost:${PORT}/gun']
});</pre>

  <h2>Info</h2>
  <p class="info">
    <strong>🏹 Yumi (弓 - Bow):</strong> Launches messages across the decentralized network (plain text, signed)<br>
    <strong>⚔️  Yari (槍 - Spear):</strong> Direct, precise, and protected messaging (end-to-end encrypted)<br><br>
    This relay helps peers discover each other and synchronize data using GunDB.<br>
    Gun uses a decentralized graph sync algorithm to propagate messages.<br>
    Yari messages are end-to-end encrypted before reaching this relay.
  </p>

  <script>
    const start = Date.now();
    setInterval(() => {
      const uptime = Math.floor((Date.now() - start) / 1000);
      document.getElementById('uptime').textContent = uptime + 's';
    }, 1000);
  </script>
</body>
</html>
    `);
    return;
  }

  // Serve example_gun.html if requested
  if (req.url === "/example" || req.url === "/demo") {
    const examplePath = path.join(__dirname, "example_gun.html");
    if (fs.existsSync(examplePath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      const content = fs.readFileSync(examplePath, "utf8");
      // Update relay URLs in the example to point to this server
      const modified = content.replace(
        /'https:\/\/gun-manhattan\.herokuapp\.com\/gun'/g,
        `'http://localhost:${PORT}/gun'`
      );
      res.end(modified);
      return;
    }
  }

  // 404 for other routes
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found. Try / for status or /gun for Gun endpoint.");
});

const shogun = new ShogunCore({
  gunOptions: {
    web: server,
    localStorage: false,
    radisk: false,
  },
});

// Initialize Gun on the server
const gun = shogun.gun;

// Log some Gun events for debugging
if (gun._.opt.super) {
  const superGun = gun._.opt.super;
  console.log("Gun super instance:", superGun);
}

// Start server
server.listen(PORT, HOST, () => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   🏹 Yumi & Yari Gun Relay Server");
  console.log("   Shogun P2P Messaging Infrastructure");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("✅ Server listening on:", `http://${HOST}:${PORT}`);
  console.log("✅ Gun endpoint:", `http://localhost:${PORT}/gun`);
  console.log("✅ WebSocket endpoint:", `ws://localhost:${PORT}/gun`);
  console.log("\n📊 Status page:", `http://localhost:${PORT}/`);
  console.log("🎮 Demo page:", `http://localhost:${PORT}/demo`);
  console.log("\n💡 Configure Yumi/Yari clients with:");
  console.log(`   announce: ['http://localhost:${PORT}/gun']\n`);
  console.log("🏹 Yumi (弓): Plain P2P messaging");
  console.log("⚔️  Yari (槍): Encrypted P2P messaging");
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("Press Ctrl+C to stop\n");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down gracefully...");
  server.close(() => {
    console.log("✓ Server closed");
    process.exit(0);
  });

  // Force exit after 5 seconds if server doesn't close
  setTimeout(() => {
    console.log("⚠️  Forcing exit...");
    process.exit(1);
  }, 5000);
});

process.on("SIGTERM", () => {
  process.emit("SIGINT");
});

// Log errors
server.on("error", (err) => {
  console.error("❌ Server error:", err);
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try a different port:`);
    console.error(`  node relay/relay.js ${parseInt(PORT) + 1}`);
  }
  process.exit(1);
});

// Optional: Log peer connections (if Gun exposes this info)
// This is tricky because Gun doesn't expose connection events easily
// but we can try to monitor the internal state
let lastPeerCount = 0;
setInterval(() => {
  try {
    // This is implementation-specific and may not work with all Gun versions
    if (gun._.opt.peers) {
      const peerCount = Object.keys(gun._.opt.peers).length;
      if (peerCount !== lastPeerCount) {
        console.log(`🔗 Peer connections: ${peerCount}`);
        lastPeerCount = peerCount;
      }
    }
  } catch (e) {
    // Ignore errors in peer counting
  }
}, 10000);

export { server, gun };
