#!/usr/bin/env node

/**
 * Yumi CLI - P2P Messaging
 * Global command: yumi
 * 
 * Usage:
 *   yumi                    # Start interactive CLI
 *   yumi --help             # Show help
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the actual client
const clientPath = join(__dirname, '../client/yumi.js');
const clientURL = pathToFileURL(clientPath).href;

// Show banner
console.log('🏹 Yumi (弓) - P2P Messaging');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load client
import(clientURL).catch(err => {
  console.error('❌ Failed to load Yumi:', err);
  console.error('\nMake sure you have built the project:');
  console.error('  npm run build');
  process.exit(1);
});

