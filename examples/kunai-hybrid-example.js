#!/usr/bin/env node

/**
 * Kunai Hybrid Example - Demonstrates hybrid file transfer
 * 
 * This example shows how to use KunaiHybrid for file transfers
 * that work in both Node.js and Browser environments.
 * 
 * Usage:
 *   node examples/kunai-hybrid-example.js [options]
 *   node examples/kunai-hybrid-example.js --encrypted --relay-host=localhost
 */

import { Kunai } from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Parse command line arguments
const args = process.argv.slice(2);
const encrypted = args.includes('--encrypted') || args.includes('-e');
const localOnly = args.includes('--local') || args.includes('-l');
const relayHost = args.find(arg => arg.startsWith('--relay-host='))?.split('=')[1] || 'localhost';
const relayPort = parseInt(args.find(arg => arg.startsWith('--relay-port='))?.split('=')[1] || '4000');
const channel = args.find(arg => arg.startsWith('--channel='))?.split('=')[1] || 'hybrid-demo';

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('   🚀 Kunai Hybrid - Multi-Transport File Transfer');
console.log('   Works in both Node.js and Browser');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (encrypted) {
  console.log('   🔐 Mode: ENCRYPTED (Yari E2E)');
} else {
  console.log('   🏹 Mode: Plain (Yumi)');
}

if (localOnly) {
  console.log('   🏠 Network: LAN Only');
} else {
  console.log('   🌐 Network: Internet + LAN');
}

console.log(`   📡 Channel: ${channel}`);
console.log(`   🚀 Transit Relay: ${relayHost}:${relayPort}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Initialize Kunai Hybrid
const kunai = new Kunai(channel, {
  encrypted: encrypted,
  channel: channel,
  localOnly: localOnly,
  transitRelayHost: relayHost,
  transitRelayPort: relayPort,
  preferWebRTC: true,  // Try WebRTC first in browser
  preferTCP: true,     // Try TCP direct first in Node.js
  useTransitRelay: true, // Use relay as fallback
  directTimeout: 10000,
  relayTimeout: 30000
});

// Event handlers
kunai.on('ready', () => {
  console.log('✅ Kunai ready!');
  const status = kunai.getStatus();
  console.log(`📊 Connection method: ${status.method}`);
  console.log(`🌍 Environment: ${status.environment}`);
  console.log(`🔗 Connected: ${status.connected}`);
  console.log('');
});

kunai.on('connections', (count) => {
  console.log(`🔗 Connections: ${count} peer(s)`);
});

kunai.on('file-offer', (offer) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Incoming Transfer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('File:', offer.filename);
  console.log('Size:', formatSize(offer.size));
  console.log('Code:', offer.transferId);
  console.log('Chunks:', offer.chunks);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Auto-accepting transfer...\n');
});

kunai.on('file-received', (result) => {
  // Create received directory
  const receivedDir = './received';
  if (!fs.existsSync(receivedDir)) {
    fs.mkdirSync(receivedDir, { recursive: true });
  }

  const outputPath = path.join(receivedDir, result.filename);

  try {
    fs.writeFileSync(outputPath, Buffer.from(result.buffer));

    console.log('\n✅ File received successfully!');
    console.log('📁 Saved to:', outputPath);
    console.log('📊 Size:', formatSize(result.size), '\n');
  } catch (err) {
    console.error('\n❌ Error saving file:', err.message);
  }
});

kunai.on('transfer-complete', (transferId) => {
  console.log(`\n🏁 Transfer complete: ${transferId}\n`);
});

kunai.on('error', (error) => {
  console.error('\n❌ Kunai Hybrid Error:', error.message || error);
});

// Helper function
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Send file function
async function sendFile(filepath) {
  try {
    if (!fs.existsSync(filepath)) {
      console.log('❌ File not found:', filepath);
      return;
    }

    const stats = fs.statSync(filepath);
    if (!stats.isFile()) {
      console.log('❌ Path is not a file:', filepath);
      return;
    }

    const filename = path.basename(filepath);
    const buffer = fs.readFileSync(filepath);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 Sending File');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('File:', filename);
    console.log('Size:', formatSize(stats.size));

    const code = await kunai.sendFile(
      { name: filename, size: stats.size },
      buffer
    );

    console.log('\n🔑 Transfer code:', code);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error sending file:', error.message);
  }
}

// Connect to the network
console.log('🔄 Connecting...');
kunai.connect().then(() => {
  console.log('✅ Connected successfully!');
}).catch(error => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

// Interactive CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: encrypted ? '🔐🚀 > ' : '🚀 > '
});

setTimeout(() => {
  console.log("📝 Commands:");
  console.log("  send <filepath>    - Send a file");
  console.log("  status             - Show connection status");
  console.log("  methods            - Show available transfer methods");
  console.log("  quit               - Exit");
  console.log("\n💡 Current Settings:");
  console.log("  Channel:", channel);
  console.log("  Encryption:", encrypted ? '🔐 ENABLED' : '❌ Disabled');
  console.log("  Network:", localOnly ? '🏠 LAN Only' : '🌐 Internet + LAN');
  console.log("  Transit Relay:", `${relayHost}:${relayPort}`);
  console.log("\n💡 Start Transit Relay Server:");
  console.log("  node examples/transit-relay-server.js");
  console.log("");
  rl.prompt();
}, 3000);

rl.on('line', async (line) => {
  const parts = line.trim().split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  try {
    if (cmd === 'send') {
      const filepath = args.join(' ');
      if (!filepath) {
        console.log("Usage: send <filepath>");
      } else {
        await sendFile(filepath);
      }
    } else if (cmd === 'status') {
      const status = kunai.getStatus();
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 Kunai Hybrid Status");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Method:", status.method);
      console.log("Connected:", status.connected);
      console.log("Environment:", status.environment);
      console.log("Kunai:", status.kunai);
      if (status.transitClient) {
        console.log("Transit Client:", status.transitClient.transport);
        console.log("Transit Connected:", status.transitClient.connected);
        console.log("Transit Paired:", status.transitClient.paired);
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    } else if (cmd === 'methods') {
      const methods = kunai.getAvailableMethods();
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚀 Available Transfer Methods");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      methods.forEach((method, index) => {
        const priority = index + 1;
        const description = {
          'webrtc': 'WebRTC P2P (Browser)',
          'tcp-direct': 'TCP Direct (Node.js)',
          'transit-relay': 'Transit Relay (Fallback)'
        }[method] || method;
        console.log(`${priority}. ${method} - ${description}`);
      });
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
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

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down gracefully...");
  kunai.destroy();
  console.log("✓ Cleanup complete");
  process.exit(0);
});

export default kunai;
