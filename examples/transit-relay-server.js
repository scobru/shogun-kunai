#!/usr/bin/env node

/**
 * Transit Relay Server - Standalone server for file transfer relay
 * 
 * This is a simple server that acts as a relay for file transfers
 * when direct P2P connections fail. It's similar to the "Transit"
 * component of Magic Wormhole.
 * 
 * Usage:
 *   node examples/transit-relay-server.js [port]
 *   node examples/transit-relay-server.js 4000
 */

import TransitRelay from '../dist/transit-relay.js';

const port = process.argv[2] ? parseInt(process.argv[2]) : 4000;

console.log('🚀 Starting Transit Relay Server...');
console.log(`📡 Port: ${port}`);
console.log(`🌐 WebSocket Port: ${port + 1}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const relay = new TransitRelay({
  port: port,
  host: '0.0.0.0',
  maxConnections: 1000,
  connectionTimeout: 30000
});

relay.on('ready', () => {
  console.log('✅ Transit Relay Server is ready!');
  console.log('💡 Clients can now connect to:');
  console.log(`   TCP: localhost:${port}`);
  console.log(`   WebSocket: ws://localhost:${port + 1}`);
  console.log('');
  console.log('📊 Server will show connection statistics every 30 seconds');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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

// Start the server
relay.start().catch(error => {
  console.error('❌ Failed to start relay server:', error);
  process.exit(1);
});

// Show statistics every 30 seconds
setInterval(() => {
  const stats = relay.getStats();
  console.log('📊 Statistics:', {
    connections: stats.totalConnections,
    pending: stats.pendingConnections,
    activePairs: stats.activePairs,
    uptime: Math.round(stats.uptime / 1000) + 's'
  });
}, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Transit Relay Server...');
  await relay.stop();
  console.log('✅ Shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Transit Relay Server...');
  await relay.stop();
  console.log('✅ Shutdown complete');
  process.exit(0);
});
