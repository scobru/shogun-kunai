#!/usr/bin/env node

/**
 * Kunai CLI - Ephemeral File Transfer
 * Global command: kunai
 * 
 * Usage:
 *   kunai                           # Start interactive CLI
 *   kunai --encrypted               # Start with encryption
 *   kunai --channel=my-room         # Use custom channel
 *   kunai --help                    # Show help
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the actual client
const clientPath = join(__dirname, '../client/kunai.js');
const clientURL = pathToFileURL(clientPath).href;

// Show banner
console.log('🥷 Kunai (苦無) - Ephemeral File Transfer');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Load client
import(clientURL).catch(err => {
  console.error('❌ Failed to load Kunai:', err);
  console.error('\nMake sure you have built the project:');
  console.error('  npm run build');
  process.exit(1);
});

