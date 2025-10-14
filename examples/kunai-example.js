/**
 * Kunai (苦無) Example - Ephemeral File Transfer
 * 
 * This demonstrates how to use Kunai for quick file transfers
 * without GunDB persistence.
 * 
 * Run two instances:
 *   Terminal 1: node examples/kunai-example.js send test.txt
 *   Terminal 2: node examples/kunai-example.js receive
 */

// Use Kunai from CommonJS build (better for Node.js)
import { Kunai } from '../dist/index.js';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Helper Functions
// ============================================================================

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function sendFile(kunai, filepath) {
  try {
    if (!fs.existsSync(filepath)) {
      throw new Error('File not found: ' + filepath);
    }

    const stats = fs.statSync(filepath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file: ' + filepath);
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
    console.log('\nOn the other computer, run:');
    console.log(`  node examples/kunai-example.js receive`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error sending file:', error.message);
    throw error;
  }
}

// ============================================================================
// CLI
// ============================================================================

const mode = process.argv[2];
const filepath = process.argv[3];
const encrypted = process.argv.includes('--encrypted') || process.argv.includes('-e');
const channel = process.argv.find(arg => arg.startsWith('--channel='))?.split('=')[1];

const kunai = new Kunai(channel || 'kunai-example', {
  announce: [
    "http://peer.wallie.io/gun",
    "https://relay.shogun-eco.xyz/gun",
    "https://gun.defucc.me/gun"
  ],
  heartbeat: 15000,
  radisk: false,
  encrypted: encrypted,  // Enable E2E encryption with Yari
  channel: channel       // Custom channel
});

kunai.on('ready', () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🥷 Kunai Example Ready!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Address:', kunai.address().slice(0, 24) + '...');
  console.log('Channel:', channel || 'kunai-example');
  console.log('Mode:', encrypted ? '🔐 Encrypted (Yari)' : '🏹 Plain (Yumi)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (mode === 'send' && filepath) {
    sendFile(kunai, filepath);
  } else if (mode === 'receive') {
    console.log('🥷 Waiting for file transfers...');
    console.log('Files will be auto-accepted and saved to ./received/\n');
  }
});

kunai.on('offer-sent', (offer) => {
  console.log('📡 Offer broadcasted');
});

kunai.on('transfer-started', (transferId) => {
  console.log('✅ Transfer started:', transferId);
});

kunai.on('send-progress', (progress) => {
  process.stdout.write(`\r📦 Sending: ${progress.percent}% (${progress.sent}/${progress.total})`);
});

kunai.on('transfer-complete', (transferId) => {
  console.log('\n\n🏁 Transfer complete!\n');
});

kunai.on('file-offer', (offer) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 File Offer Received');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('From:', offer.from.slice(0, 16) + '...');
  console.log('File:', offer.filename);
  console.log('Size:', formatSize(offer.size));
  console.log('Code:', offer.transferId);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Auto-accepting transfer...\n');
});

kunai.on('receive-progress', (progress) => {
  process.stdout.write(`\r📥 Receiving: ${progress.percent}% (${progress.received}/${progress.total})`);
  
  // Debug: check if we're complete
  if (progress.received === progress.total) {
    console.log('\n📦 All chunks received, assembling file...');
  }
});

kunai.on('file-received', (result) => {
  console.log('🎉 file-received event triggered!');
  console.log('Result:', result);
  // Create received directory if it doesn't exist
  const receivedDir = './received';
  if (!fs.existsSync(receivedDir)) {
    fs.mkdirSync(receivedDir, { recursive: true });
  }
  
  const outputPath = `${receivedDir}/${result.filename}`;
  
  try {
    fs.writeFileSync(outputPath, Buffer.from(result.buffer));
    
    console.log('\n\n✅ File received successfully!');
    console.log('📁 Saved to:', outputPath);
    console.log('📊 Size:', formatSize(result.size), '\n');
  } catch (err) {
    console.error('\n❌ Error saving file:', err.message);
  }
});

// Show usage if no args
if (!mode) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🥷 Kunai (苦無) - Ephemeral File Transfer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Usage:');
  console.log('  node examples/kunai-example.js send <filepath> [options]');
  console.log('  node examples/kunai-example.js receive [options]\n');
  console.log('Options:');
  console.log('  --encrypted, -e          Enable E2E encryption (Yari)');
  console.log('  --channel=<name>         Use custom channel\n');
  console.log('Examples:');
  console.log('  # Plain transfer:');
  console.log('  Terminal 1: node examples/kunai-example.js send examples/test-file.txt');
  console.log('  Terminal 2: node examples/kunai-example.js receive\n');
  console.log('  # Encrypted transfer:');
  console.log('  Terminal 1: node examples/kunai-example.js send secret.pdf --encrypted');
  console.log('  Terminal 2: node examples/kunai-example.js receive --encrypted\n');
  console.log('  # Custom channel:');
  console.log('  Terminal 1: node examples/kunai-example.js send file.zip --channel=my-private-room');
  console.log('  Terminal 2: node examples/kunai-example.js receive --channel=my-private-room\n');
  console.log('  # Encrypted + Custom channel:');
  console.log('  Terminal 1: node examples/kunai-example.js send data.json -e --channel=secure-team');
  console.log('  Terminal 2: node examples/kunai-example.js receive -e --channel=secure-team\n');
  process.exit(0);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  kunai.destroy(() => {
    process.exit(0);
  });
});

export default kunai;

