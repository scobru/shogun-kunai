/**
 * Yari (槍) Example - Encrypted P2P Chat
 * 
 * This demonstrates Yari's automatic end-to-end encryption.
 * All messages are encrypted with Gun SEA (via Shogun Core) before transmission.
 * 
 * Run multiple instances to see encrypted P2P communication:
 *   node client/yari.js
 */

import { Yari } from '../dist/yari.js';

// Create encrypted Yari instance
const yari = new Yari('yari', {
  announce: [
    "http://peer.wallie.io/gun",
    "https://relay.shogun-eco.xyz/gun",
    "https://v5g5jseqhgkp43lppgregcfbvi.srv.us/gun",
    "https://gun.defucc.me/gun",
    "https://a.talkflow.team/gun",
  ],
  heartbeat: 10000
});

// Listen to events
yari.on("ready", () => {
  console.log("\n✓ Yari (槍) ready! (Encrypted mode ⚔️🔐)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Address:", yari.address);
  console.log("Seed:", yari.yumi.seed);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});

yari.on("connections", (count) => {
  console.log("🔗 Connections:", count);
});

yari.on("seen", (address) => {
  console.log("👀 Peer seen:", address.slice(0, 12) + "...");
});

yari.on("left", (address) => {
  console.log("👋 Peer left:", address.slice(0, 12) + "...");
});

// Listen for DECRYPTED messages (not 'message')
yari.on("decrypted", (address, pubkeys, message) => {
  console.log("\n🔓 Decrypted message from:", address.slice(0, 12) + "...");
  console.log("   SEA pub:", pubkeys.pub.slice(0, 20) + "...");
  console.log("   Content:", message);
  console.log("");
});

// Send encrypted test message after peers connect
yari.events.on('newPeer', (peers) => {
  const peerCount = Object.keys(peers).length;
  console.log(`\n🔑 ${peerCount} peer(s) registered. Ready for encrypted messaging!\n`);
  
  // Send a test encrypted message
  setTimeout(() => {
    console.log("📤 Sending encrypted broadcast...");
    yari.send({
      type: "encrypted-hello",
      text: "Hello from " + yari.address.slice(0, 8),
      timestamp: Date.now()
    });
  }, 1000);
});

// Register encrypted RPC functions
yari.register("ping", (address, args, callback) => {
  console.log("\n🏓 Encrypted ping from:", address.slice(0, 12) + "...");
  callback({
    pong: true,
    time: Date.now(),
    encrypted: true,
    args: args
  });
});

yari.register("echo", (address, args, callback) => {
  console.log("\n🔊 Encrypted echo from:", address.slice(0, 12) + "...");
  callback({
    echo: args,
    from: yari.address,
    encrypted: true
  });
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down gracefully...");
  yari.destroy(() => {
    console.log("✓ Cleanup complete");
    process.exit(0);
  });
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("   ⚔️  Yari (槍) Example - Encrypted P2P");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\nInitializing encrypted session...\n");

// Interactive CLI
import readline from 'readline';
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '⚔️  > '
});

setTimeout(() => {
  console.log("\n📝 Commands:");
  console.log("  send <message>     - Send encrypted broadcast");
  console.log("  peers              - List connected peers");
  console.log("  ping <address>     - Encrypted ping to peer");
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
      yari.send({
        type: "chat",
        text: message,
        from: yari.address.slice(0, 8),
        timestamp: Date.now()
      });
      console.log("✓ Encrypted message sent");
    } else if (cmd === 'peers') {
      const peers = Object.keys(yari.peers);
      console.log("🔑 Peers with exchanged keys:", peers.length);
      peers.forEach(p => {
        console.log("  -", p);
        console.log("    pub:", yari.peers[p].pub.slice(0, 30) + "...");
      });
    } else if (cmd === 'ping') {
      let address = args[0];
      if (!address && Object.keys(yari.peers).length > 0) {
        address = Object.keys(yari.peers)[0];
      }
      if (address) {
        console.log("🏓 Sending encrypted ping to", address.slice(0, 12) + "...");
        yari.rpc(address, "ping", {hello: true, encrypted: true}, (response) => {
          console.log("✓ Encrypted pong received:", response);
        });
      } else {
        console.log("No peers available. Specify an address.");
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

export default yari;

