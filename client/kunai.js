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

// Transfer history storage
const transferHistory = [];
const TRANSFER_LOG_FILE = './transfer-history.json';

// ============================================================================
// Helper Functions
// ============================================================================

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function loadTransferHistory() {
  try {
    if (fs.existsSync(TRANSFER_LOG_FILE)) {
      const data = fs.readFileSync(TRANSFER_LOG_FILE, 'utf8');
      const history = JSON.parse(data);
      transferHistory.push(...history);
      console.log(`📋 Loaded ${history.length} transfer records`);
    }
  } catch (error) {
    console.log('⚠️ Could not load transfer history:', error.message);
  }
}

function saveTransferHistory() {
  try {
    fs.writeFileSync(TRANSFER_LOG_FILE, JSON.stringify(transferHistory, null, 2));
  } catch (error) {
    console.log('⚠️ Could not save transfer history:', error.message);
  }
}

function addTransferRecord(type, transferId, filename, size, status, timestamp = new Date().toISOString()) {
  const record = {
    type, // 'sent' or 'received'
    transferId,
    filename,
    size,
    status, // 'completed', 'failed', 'timeout'
    timestamp
  };
  transferHistory.push(record);
  
  // Keep only last 100 records
  if (transferHistory.length > 100) {
    transferHistory.splice(0, transferHistory.length - 100);
  }
  
  saveTransferHistory();
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

// Load transfer history
loadTransferHistory();

// ============================================================================
// Event Handlers
// ============================================================================

kunai.on('ready', () => {
  console.log('✅ Kunai ready!');
  console.log('Address:', kunai.address().slice(0, 24) + '...\n');
});

kunai.on('connections', (count) => {
  console.log(`🔗 Connections: ${count} peer(s)`);
  if (encrypted && kunai.yari) {
    const encryptedPeers = Object.keys(kunai.yari.peers).length;
    console.log(`🔐 Encrypted peers: ${encryptedPeers}`);
  }
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
  // Find the transfer info to record it
  const transfer = kunai.transfers?.get(transferId);
  if (transfer) {
    addTransferRecord('sent', transferId, transfer.file?.name || 'unknown', transfer.file?.size || 0, 'completed');
  }
});

kunai.on('file-offer', (offer) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Incoming Transfer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('From:', offer.from.slice(0, 16) + '...');
  console.log('File:', offer.filename);
  console.log('Size:', formatSize(offer.size));
  console.log('Code:', offer.transferId);
  console.log('Chunks:', offer.chunks);
  if (encrypted) {
    console.log('🔐 Encrypted: YES');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Auto-accepting transfer...\n');
});

kunai.on('receive-progress', (progress) => {
  process.stdout.write(`\r📥 Receiving: ${progress.percent}% (${progress.received}/${progress.total} chunks)`);
});

kunai.on('transfer-accepted', (transferId) => {
  console.log(`\n✅ Transfer ${transferId} accepted, starting download...`);
});

kunai.on('transfer-started', (transferId) => {
  console.log(`\n🚀 Transfer ${transferId} started!`);
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
    
    // Record successful receive
    addTransferRecord('received', result.transferId, result.filename, result.size, 'completed');
  } catch (err) {
    console.error('\n❌ Error saving file:', err.message);
    addTransferRecord('received', result.transferId, result.filename, result.size, 'failed');
  }
});

kunai.on('sender-confirmed', (transferId) => {
  console.log('🏁 Sender confirmed transfer complete');
});

kunai.on('error', (error) => {
  console.error('\n❌ Kunai Error:', error.message || error);
});

kunai.on('transfer-timeout', (transferId) => {
  console.log(`\n⏰ Transfer ${transferId} timed out`);
  // Record timeout
  const transfer = kunai.transfers?.get(transferId);
  if (transfer) {
    addTransferRecord('sent', transferId, transfer.file?.name || 'unknown', transfer.file?.size || 0, 'timeout');
  }
});

kunai.on('transfer-failed', (result) => {
  console.log(`\n❌ Transfer failed: ${result.filename}`);
  console.log(`   Reason: ${result.reason}`);
  if (result.missingChunks) {
    console.log(`   Missing chunks: ${result.missingChunks.join(', ')}`);
  }
  addTransferRecord('received', result.transferId, result.filename, 0, 'failed');
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
  console.log("  status             - Show active transfers and connections");
  console.log("  history            - Show transfer history");
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
    } else if (cmd === 'status') {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 Kunai Status");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Address:", kunai.address().slice(0, 24) + '...');
      console.log("Connections:", kunai.yumi.connections());
      if (encrypted && kunai.yari) {
        console.log("Encrypted peers:", Object.keys(kunai.yari.peers).length);
      }
      console.log("Channel:", channelArg || identifier);
      console.log("Mode:", encrypted ? '🔐 Encrypted (Yari)' : '🏹 Plain (Yumi)');
      console.log("Network:", localOnly ? '🏠 LAN Only' : '🌐 Internet + LAN');
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    } else if (cmd === 'history') {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📋 Transfer History");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      if (transferHistory.length === 0) {
        console.log("No transfers recorded yet.");
      } else {
        transferHistory.slice(-10).reverse().forEach((record, index) => {
          const statusIcon = record.status === 'completed' ? '✅' : 
                           record.status === 'failed' ? '❌' : '⏰';
          const typeIcon = record.type === 'sent' ? '📤' : '📥';
          const time = new Date(record.timestamp).toLocaleString();
          console.log(`${statusIcon} ${typeIcon} ${record.filename} (${formatSize(record.size)}) - ${record.transferId} - ${time}`);
        });
        if (transferHistory.length > 10) {
          console.log(`... and ${transferHistory.length - 10} more transfers`);
        }
      }
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
  kunai.destroy(() => {
    console.log("✓ Cleanup complete");
    process.exit(0);
  });
});

export default kunai;
