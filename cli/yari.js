#!/usr/bin/env node

/**
 * Yari CLI - Encrypted P2P Messaging
 * Global command: yari
 * 
 * Usage:
 *   yari                    # Start interactive CLI
 *   yari --help             # Show help
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the actual client
const clientPath = join(__dirname, '../client/yari.js');
const clientURL = pathToFileURL(clientPath).href;

// Show banner
console.log('⚔️  Yari (槍) - Encrypted P2P Messaging');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load client
import(clientURL).catch(err => {
  console.error('❌ Failed to load Yari:', err);
  console.error('\nMake sure you have built the project:');
  console.error('  npm run build');
  process.exit(1);
});

