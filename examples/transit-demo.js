#!/usr/bin/env node

/**
 * Transit Demo - Complete example showing Transit Relay + Client
 * 
 * This demonstrates the full Transit Relay system:
 * 1. Starts a Transit Relay server
 * 2. Creates multiple clients that connect via the relay
 * 3. Shows file transfer between clients through the relay
 * 
 * Usage:
 *   node examples/transit-demo.js [port]
 *   node examples/transit-demo.js 4000
 */

import TransitRelay from '../dist/transit-relay.js';
import TransitClient from '../dist/transit-client.js';
import fs from 'fs';
import path from 'path';

const port = process.argv[2] ? parseInt(process.argv[2]) : 4000;
const relayHost = 'localhost';

console.log('🚀 Transit Demo - Complete Relay System');
console.log(`📡 Relay Port: ${port}`);
console.log(`🌐 WebSocket Port: ${port + 1}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ============================================================================
// 1. Start Transit Relay Server
// ============================================================================

const relay = new TransitRelay({
  port: port,
  host: '0.0.0.0',
  maxConnections: 1000,
  connectionTimeout: 30000
});

relay.on('ready', () => {
  console.log('✅ Transit Relay Server is ready!');
  console.log('💡 Clients can now connect to:');
  console.log(`   TCP: ${relayHost}:${port}`);
  console.log(`   WebSocket: ws://${relayHost}:${port + 1}`);
  console.log('');
  
  // Start demo after relay is ready
  setTimeout(() => startDemo(), 1000);
});

relay.on('connection', (connection) => {
  console.log(`🔗 New connection: ${connection.id} (code: ${connection.code})`);
});

relay.on('paired', (conn1, conn2) => {
  console.log(`🤝 Paired: ${conn1.id} ↔ ${conn2.id} (code: ${conn1.code})`);
});

relay.on('disconnection', (connection) => {
  console.log(`👋 Disconnected: ${connection.id}`);
});

relay.on('timeout', (code) => {
  console.log(`⏰ Timeout for code: ${code}`);
});

relay.on('error', (error) => {
  console.error('❌ Relay error:', error);
});

// Start the relay server
relay.start().catch(error => {
  console.error('❌ Failed to start relay server:', error);
  process.exit(1);
});

// ============================================================================
// 2. Demo with Multiple Clients
// ============================================================================

async function startDemo() {
  console.log('🎬 Starting Transit Demo...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Create test file
    const testFile = createTestFile();
    
    // Create sender client
    const sender = await createSenderClient(testFile);
    
    // Create receiver client
    const receiver = await createReceiverClient();
    
    // Wait a bit for connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start file transfer
    await performFileTransfer(sender, receiver, testFile);
    
    // Cleanup after demo
    setTimeout(() => {
      console.log('\n🏁 Demo completed! Cleaning up...');
      sender.close();
      receiver.close();
      relay.stop().then(() => {
        console.log('✅ Cleanup complete');
        process.exit(0);
      });
    }, 5000);
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// 3. Helper Functions
// ============================================================================

function createTestFile() {
  const testContent = `🚀 Transit Demo Test File
Generated at: ${new Date().toISOString()}
Content: This is a test file for the Transit Relay demo.
Size: ${Math.random() * 1000} bytes of random data.
End of file.`;
  
  const testDir = './test-files';
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testFilePath = path.join(testDir, 'transit-demo-test.txt');
  fs.writeFileSync(testFilePath, testContent);
  
  console.log(`📄 Created test file: ${testFilePath}`);
  return testFilePath;
}

async function createSenderClient(testFilePath) {
  console.log('📤 Creating sender client...');
  
  const sender = new TransitClient({
    relayHost: relayHost,
    relayPort: port,
    connectionTimeout: 10000
  });
  
  const transferCode = generateTransferCode();
  console.log(`🔑 Transfer code: ${transferCode}`);
  
  await sender.connect(transferCode);
  console.log('✅ Sender connected to relay');
  
  // Store transfer code for receiver
  global.transferCode = transferCode;
  
  return sender;
}

async function createReceiverClient() {
  console.log('📥 Creating receiver client...');
  
  const receiver = new TransitClient({
    relayHost: relayHost,
    relayPort: port,
    connectionTimeout: 10000
  });
  
  // Wait for transfer code to be available
  while (!global.transferCode) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  await receiver.connect(global.transferCode);
  console.log('✅ Receiver connected to relay');
  
  return receiver;
}

async function performFileTransfer(sender, receiver, testFilePath) {
  console.log('\n🔄 Starting file transfer...');
  
  // Read test file
  const fileBuffer = fs.readFileSync(testFilePath);
  const filename = path.basename(testFilePath);
  
  console.log(`📤 Sending file: ${filename} (${fileBuffer.length} bytes)`);
  
  // Send file metadata
  sender.send(JSON.stringify({
    type: 'file-offer',
    transferId: global.transferCode,
    filename: filename,
    size: fileBuffer.length,
    chunks: Math.ceil(fileBuffer.length / 1024) // 1KB chunks
  }));
  
  // Send file data in chunks
  const chunkSize = 1024;
  const totalChunks = Math.ceil(fileBuffer.length / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileBuffer.length);
    const chunk = fileBuffer.slice(start, end);
    
    sender.send(JSON.stringify({
      type: 'file-chunk',
      transferId: global.transferCode,
      index: i,
      data: chunk.toString('base64'),
      total: totalChunks
    }));
    
    // Small delay between chunks
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Send completion message
  sender.send(JSON.stringify({
    type: 'transfer-complete',
    transferId: global.transferCode
  }));
  
  console.log('✅ File transfer initiated');
}

function generateTransferCode() {
  const words = [
    'alpha', 'bravo', 'charlie', 'delta', 'echo', 'ninja',
    'samurai', 'shogun', 'katana', 'sakura', 'tokyo', 'kyoto'
  ];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 100);
  return `${num}-${word1}-${word2}`;
}

// ============================================================================
// 4. Statistics and Monitoring
// ============================================================================

// Show statistics every 10 seconds
setInterval(() => {
  const stats = relay.getStats();
  console.log('📊 Relay Statistics:', {
    connections: stats.totalConnections,
    pending: stats.pendingConnections,
    activePairs: stats.activePairs,
    uptime: Math.round(stats.uptime / 1000) + 's'
  });
}, 10000);

// ============================================================================
// 5. Graceful Shutdown
// ============================================================================

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Transit Demo...');
  await relay.stop();
  console.log('✅ Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Transit Demo...');
  await relay.stop();
  console.log('✅ Shutdown complete');
  process.exit(0);
});

// ============================================================================
// 6. Usage Instructions
// ============================================================================

setTimeout(() => {
  console.log('\n💡 Usage Instructions:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. This demo starts a Transit Relay server');
  console.log('2. Creates two clients (sender and receiver)');
  console.log('3. Transfers a test file through the relay');
  console.log('4. Shows connection statistics');
  console.log('');
  console.log('🔧 Manual Testing:');
  console.log(`   # Terminal 1: Start relay`);
  console.log(`   node examples/transit-relay-server.js ${port}`);
  console.log('');
  console.log(`   # Terminal 2: Start client 1`);
  console.log(`   node -e "import('./dist/transit-client.js').then(m => {`);
  console.log(`     const client = new m.default({relayHost:'${relayHost}',relayPort:${port}});`);
  console.log(`     client.connect('test-code').then(() => console.log('Connected!'));`);
  console.log(`   })"`);
  console.log('');
  console.log(`   # Terminal 3: Start client 2 (same code)`);
  console.log(`   node -e "import('./dist/transit-client.js').then(m => {`);
  console.log(`     const client = new m.default({relayHost:'${relayHost}',relayPort:${port}});`);
  console.log(`     client.connect('test-code').then(() => console.log('Connected!'));`);
  console.log(`   })"`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}, 2000);
