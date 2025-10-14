#!/usr/bin/env node

/**
 * Transit Client Test - Simple client for testing Transit Relay
 * 
 * This is a simple client that connects to a Transit Relay server
 * and can send/receive messages. Useful for manual testing.
 * 
 * Usage:
 *   node examples/transit-client-test.js [code] [relay-host] [relay-port]
 *   node examples/transit-client-test.js test-code localhost 4000
 */

import TransitClient from '../dist/transit-client.js';
import readline from 'readline';

// Parse command line arguments
const args = process.argv.slice(2);
const transferCode = args[0] || 'test-code-' + Math.random().toString(36).slice(2, 8);
const relayHost = args[1] || 'localhost';
const relayPort = parseInt(args[2] || '4000');

console.log('🚀 Transit Client Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🔑 Transfer Code: ${transferCode}`);
console.log(`📡 Relay: ${relayHost}:${relayPort}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Create client
const client = new TransitClient({
  relayHost: relayHost,
  relayPort: relayPort,
  connectionTimeout: 10000
});

// Event handlers
client.on('connected', (connectionId) => {
  console.log(`✅ Connected to relay! Connection ID: ${connectionId}`);
  console.log('💡 Waiting for peer to connect with same code...');
  console.log('');
});

client.on('paired', (peerId) => {
  console.log(`🤝 Paired with peer: ${peerId}`);
  console.log('💬 You can now send messages! Type "help" for commands.');
  console.log('');
});

client.on('data', (data) => {
  try {
    const message = JSON.parse(data);
    console.log(`📥 Received: ${JSON.stringify(message, null, 2)}`);
  } catch (error) {
    console.log(`📥 Received raw data: ${data}`);
  }
});

client.on('disconnected', () => {
  console.log('👋 Disconnected from relay');
});

client.on('error', (error) => {
  console.error('❌ Client error:', error.message);
});

// Connect to relay
console.log('🔄 Connecting to relay...');
client.connect(transferCode).then(() => {
  console.log('✅ Connection established');
}).catch(error => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

// Interactive CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '📤 > '
});

setTimeout(() => {
  console.log('📝 Commands:');
  console.log('  help                    - Show this help');
  console.log('  status                  - Show connection status');
  console.log('  send <message>          - Send a text message');
  console.log('  file <filename>         - Send a file');
  console.log('  quit                    - Exit');
  console.log('');
  rl.prompt();
}, 1000);

rl.on('line', (line) => {
  const parts = line.trim().split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  try {
    if (cmd === 'help') {
      console.log('📝 Available Commands:');
      console.log('  help                    - Show this help');
      console.log('  status                  - Show connection status');
      console.log('  send <message>          - Send a text message');
      console.log('  file <filename>         - Send a file');
      console.log('  quit                    - Exit');
    } else if (cmd === 'status') {
      const status = client.getStatus();
      console.log('📊 Client Status:');
      console.log(`  Connected: ${status.connected}`);
      console.log(`  Paired: ${status.paired}`);
      console.log(`  Connection ID: ${status.connectionId}`);
      console.log(`  Code: ${status.code}`);
      console.log(`  Transport: ${status.transport}`);
    } else if (cmd === 'send') {
      const message = args.join(' ');
      if (!message) {
        console.log('Usage: send <message>');
      } else {
        const data = JSON.stringify({
          type: 'message',
          text: message,
          timestamp: new Date().toISOString(),
          from: 'client-test'
        });
        client.send(data);
        console.log(`📤 Sent: ${message}`);
      }
    } else if (cmd === 'file') {
      const filename = args[0];
      if (!filename) {
        console.log('Usage: file <filename>');
      } else {
        try {
          const fs = require('fs');
          const path = require('path');
          
          if (!fs.existsSync(filename)) {
            console.log(`❌ File not found: ${filename}`);
            return;
          }
          
          const fileBuffer = fs.readFileSync(filename);
          const basename = path.basename(filename);
          
          console.log(`📤 Sending file: ${basename} (${fileBuffer.length} bytes)`);
          
          // Send file metadata
          client.send(JSON.stringify({
            type: 'file-offer',
            transferId: transferCode,
            filename: basename,
            size: fileBuffer.length,
            chunks: Math.ceil(fileBuffer.length / 1024)
          }));
          
          // Send file data in chunks
          const chunkSize = 1024;
          const totalChunks = Math.ceil(fileBuffer.length / chunkSize);
          
          for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, fileBuffer.length);
            const chunk = fileBuffer.slice(start, end);
            
            client.send(JSON.stringify({
              type: 'file-chunk',
              transferId: transferCode,
              index: i,
              data: chunk.toString('base64'),
              total: totalChunks
            }));
          }
          
          // Send completion
          client.send(JSON.stringify({
            type: 'transfer-complete',
            transferId: transferCode
          }));
          
          console.log('✅ File sent successfully');
        } catch (error) {
          console.error('❌ Error sending file:', error.message);
        }
      }
    } else if (cmd === 'quit' || cmd === 'exit') {
      rl.close();
      process.emit('SIGINT');
      return;
    } else if (cmd) {
      console.log('Unknown command:', cmd);
      console.log('Type "help" for available commands');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  rl.prompt();
});

rl.on('close', () => {
  process.emit('SIGINT');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down client...');
  client.close();
  console.log('✅ Cleanup complete');
  process.exit(0);
});

// Show usage instructions
setTimeout(() => {
  console.log('\n💡 Usage Instructions:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Start a Transit Relay server:');
  console.log(`   node examples/transit-relay-server.js ${relayPort}`);
  console.log('');
  console.log('2. Start this client:');
  console.log(`   node examples/transit-client-test.js ${transferCode} ${relayHost} ${relayPort}`);
  console.log('');
  console.log('3. Start another client with the same code:');
  console.log(`   node examples/transit-client-test.js ${transferCode} ${relayHost} ${relayPort}`);
  console.log('');
  console.log('4. The clients will be paired and can send messages/files');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}, 2000);
