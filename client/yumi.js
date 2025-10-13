/**
 * Yumi (弓) Example - Plain P2P Messaging
 * Run this with: node client/yumi.js
 * 
 * You can run multiple instances to see them connect to each other.
 */

import { Yumi } from "../dist/yumi.js";

// Create a new Yumi instance
// If you want to test with multiple instances, comment out the identifier
// to get a random room, or use the same identifier to join the same room
const yumi = new Yumi("yumi", {
  // You can specify Gun relay peers here
  announce: [
    "http://peer.wallie.io/gun",
    "https://relay.shogun-eco.xyz/gun",
    "https://v5g5jseqhgkp43lppgregcfbvi.srv.us/gun",
    "https://gun.defucc.me/gun",
    "https://a.talkflow.team/gun",
  ],
  heartbeat: 10000 // heartbeat every 10 seconds
});

// Listen to events
yumi.on("ready", () => {
  console.log("\n✓ Yumi (弓) ready!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Address:", yumi.address());
  console.log("Seed:", yumi.seed);
  console.log("Identifier:", yumi.identifier);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Send a test message after ready
  setTimeout(() => {
    console.log("📤 Sending test broadcast message...");
    yumi.send({type: "hello", text: "Hello from " + yumi.address().slice(0, 8)});
  }, 2000);
});

yumi.on("connections", (count) => {
  console.log("🔗 Connections:", count);
});

yumi.on("seen", (address) => {
  console.log("👀 Peer seen:", address);
});

yumi.on("left", (address) => {
  console.log("👋 Peer left:", address);
});

yumi.on("timeout", (address) => {
  console.log("⏱️  Peer timeout:", address);
});

yumi.on("ping", (address) => {
  console.log("🏓 Ping from:", address.slice(0, 12) + "...");
});

yumi.on("message", (address, message, packet) => {
  console.log("\n📨 Message from:", address.slice(0, 12) + "...");
  console.log("   Content:", message);
  console.log("");
});

yumi.on("rpc", (address, call, args, nonce) => {
  console.log("📞 RPC call:", call, "from:", address.slice(0, 12) + "...");
});

yumi.on("rpc-response", (address, nonce, response) => {
  console.log("📞 RPC response from:", address.slice(0, 12) + "...");
  console.log("   Response:", response);
});

// Register some RPC functions
yumi.register("ping", (address, args, callback) => {
  console.log("\n🏓 Ping RPC called by:", address.slice(0, 12) + "...");
  callback({pong: true, time: Date.now(), args: args});
}, "Respond to ping with pong");

yumi.register("echo", (address, args, callback) => {
  console.log("\n🔊 Echo RPC called by:", address.slice(0, 12) + "...");
  console.log("   Args:", args);
  callback({echo: args, from: address});
}, "Echo back the arguments");

yumi.register("info", (address, args, callback) => {
  callback({
    address: yumi.address(),
    identifier: yumi.identifier,
    peers: Object.keys(yumi.peers).length,
    uptime: process.uptime()
  });
}, "Get info about this node");

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down gracefully...");
  yumi.destroy(() => {
    console.log("✓ Cleanup complete");
    process.exit(0);
  });
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("   🏹 Yumi (弓) Example - Plain P2P");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\nInitializing...\n");

// Interactive CLI
import readline from 'readline';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '🏹 > '
});

setTimeout(() => {
  console.log("\n📝 Commands:");
  console.log("  send <message>     - Broadcast a message");
  console.log("  peers              - List connected peers");
  console.log("  ping <address>     - Ping a peer");
  console.log("  info <address>     - Get info from a peer");
  console.log("  quit               - Exit");
  console.log("");
  rl.prompt();
}, 3000);

rl.on('line', (line) => {
  const parts = line.trim().split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  try {
    if (cmd === 'send') {
      const message = args.join(' ');
      yumi.send({type: "chat", text: message, from: yumi.address().slice(0, 8)});
      console.log("✓ Message sent");
    } else if (cmd === 'peers') {
      const peers = Object.keys(yumi.peers);
      console.log("Connected peers:", peers.length);
      peers.forEach((p) => {
        console.log("  -", p);
      });
    } else if (cmd === 'ping') {
      let address = args[0];
      if (!address && Object.keys(yumi.peers).length > 0) {
        address = Object.keys(yumi.peers)[0];
      }
      if (address) {
        console.log("Pinging", address.slice(0, 12) + "...");
        yumi.rpc(address, "ping", {hello: true}, (response) => {
          console.log("✓ Pong received:", response);
        });
      } else {
        console.log("No peers connected. Specify an address.");
      }
    } else if (cmd === 'info') {
      let address = args[0];
      if (!address && Object.keys(yumi.peers).length > 0) {
        address = Object.keys(yumi.peers)[0];
      }
      if (address) {
        console.log("Getting info from", address.slice(0, 12) + "...");
        yumi.rpc(address, "info", {}, (response) => {
          console.log("✓ Info received:", response);
        });
      } else {
        console.log("No peers connected. Specify an address.");
      }
    } else if (cmd === 'quit' || cmd === 'exit') {
      rl.close();
      process.emit('SIGINT');
      return;
    } else if (cmd) {
      console.log("Unknown command:", cmd);
    }
  } catch(e) {
    console.error("Error:", e.message);
  }

  rl.prompt();
});

rl.on('close', () => {
  process.emit('SIGINT');
});

export default yumi;

