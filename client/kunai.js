/**
 * Kunai (苦無) - Ephemeral File Transfer CLI
 * 
 * Fast, temporary P2P file transfers using Yumi/Yari for signaling.
 * Files are streamed directly without GunDB persistence.
 * 
 * Kunai = ninja throwing knife - quick, precise, ephemeral
 * 
 * Run this with: 
 *   node client/kunai.js [options]
 *   node client/kunai.js --encrypted --channel=my-room
 */

import { Kunai } from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ============================================================================
// Helper Functions
// ============================================================================

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function sendFileCommand(kunai, filepath) {
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

    // sendOffer is now async!
    const code = await kunai.sendOffer(
      { name: filename, size: stats.size },
      buffer
    );

    console.log('\n🔑 Transfer code:', code);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error sending file:', error.message);
  }
}

// ============================================================================
// Parse CLI Arguments
// ============================================================================

const args = process.argv.slice(2);
const encrypted = args.includes('--encrypted') || args.includes('-e');
const localOnly = args.includes('--local') || args.includes('-l');
const channelArg = args.find(arg => arg.startsWith('--channel='))?.split('=')[1];
const identifier = channelArg || args.find(arg => !arg.startsWith('-')) || 'kunai-transfer';

// ============================================================================
// Initialize Kunai
// ============================================================================

const kunai = new Kunai(identifier, {
  announce: localOnly ? [] : [
    "http://peer.wallie.io/gun",
    "https://relay.shogun-eco.xyz/gun",
    "https://v5g5jseqhgkp43lppgregcfbvi.srv.us/gun",
    "https://gun.defucc.me/gun",
    "https://a.talkflow.team/gun",
  ],
  heartbeat: 15000,
  radisk: false,
  localOnly: localOnly || false,
  encrypted: encrypted,
  channel: channelArg,
  ws: true,
  rtc: true,
  axe: true,
  wire: true,
  webrtc: true,
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("   🥷 Kunai (苦無) - Ephemeral File Transfer");
console.log("   Fast P2P transfers without persistence");
if (encrypted) {
  console.log("   🔐 Mode: ENCRYPTED (Yari E2E)");
} else {
  console.log("   🏹 Mode: Plain (Yumi)");
}
if (localOnly) {
  console.log("   🏠 Network: LAN Only (AXE multicast)");
} else {
  console.log("   🌐 Network: Internet + LAN");
}
if (channelArg) {
  console.log("   📡 Channel: " + channelArg);
}
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\nInitializing...\n");

// ============================================================================
// Event Handlers
// ============================================================================

kunai.on('ready', () => {
  console.log('✅ Kunai ready!');
  console.log('Address:', kunai.address().slice(0, 24) + '...\n');
});

kunai.on('offer-sent', (offer) => {
  console.log('📡 Transfer offer broadcasted');
});

kunai.on('transfer-started', (transferId) => {
  console.log('✅ Transfer started:', transferId);
});

kunai.on('send-progress', (progress) => {
  process.stdout.write(`\r📤 Sending: ${progress.percent}% (${progress.sent}/${progress.total} chunks)`);
});

kunai.on('transfer-complete', (transferId) => {
  console.log('\n\n🏁 Transfer complete!\n');
});

kunai.on('file-offer', (offer) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Incoming Transfer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('From:', offer.from.slice(0, 16) + '...');
  console.log('File:', offer.filename);
  console.log('Size:', formatSize(offer.size));
  console.log('Code:', offer.transferId);
  if (encrypted) {
    console.log('🔐 Encrypted: YES');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Auto-accepting transfer...\n');
});

kunai.on('receive-progress', (progress) => {
  process.stdout.write(`\r📥 Receiving: ${progress.percent}% (${progress.received}/${progress.total} chunks)`);
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

    console.log('\n\n✅ File received successfully!');
    console.log('📁 Saved to:', outputPath);
    console.log('📊 Size:', formatSize(result.size), '\n');
  } catch (err) {
    console.error('\n❌ Error saving file:', err.message);
  }
});

kunai.on('sender-confirmed', (transferId) => {
  console.log('🏁 Sender confirmed transfer complete');
});

// ============================================================================
// Interactive CLI
// ============================================================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: encrypted ? '🔐🥷 > ' : '🥷 > '
});

setTimeout(() => {
  console.log("📝 Commands:");
  console.log("  send <filepath>    - Send a file");
  console.log("  receive            - Listen for incoming transfers");
  console.log("  quit               - Exit");
  console.log("\n💡 Current Settings:");
  console.log("  Channel:", channelArg || identifier);
  console.log("  Encryption:", encrypted ? '🔐 ENABLED (Yari)' : '❌ Disabled (Yumi)');
  console.log("  Network:", localOnly ? '🏠 LAN Only (AXE)' : '🌐 Internet + LAN');
  console.log("\n💡 Restart with options:");
  console.log("  node client/kunai.js --encrypted");
  console.log("  node client/kunai.js --local");
  console.log("  node client/kunai.js --channel=my-team --encrypted --local");
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
        await sendFileCommand(kunai, filepath);
      }
    } else if (cmd === 'receive') {
      console.log("✅ Listening for transfers...");
      console.log("Transfers are auto-accepted when offered.");
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
  kunai.destroy(() => {
    console.log("✓ Cleanup complete");
    process.exit(0);
  });
});

export default kunai;
