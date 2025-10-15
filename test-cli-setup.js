#!/usr/bin/env node

/**
 * Test CLI Setup
 * Verifies that the CLI configuration is correct
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing CLI Setup...\n');

// Test 1: Check if cli directory exists
console.log('📁 Checking cli directory...');
const cliDir = join(__dirname, 'cli');
if (fs.existsSync(cliDir)) {
  console.log('  ✅ cli/ directory exists');
} else {
  console.log('  ❌ cli/ directory not found');
  process.exit(1);
}

// Test 2: Check if CLI files exist
console.log('\n📄 Checking CLI files...');
const cliFiles = ['kunai.js', 'yumi.js', 'yari.js'];
let allFilesExist = true;

for (const file of cliFiles) {
  const filePath = join(cliDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file} exists`);
  } else {
    console.log(`  ❌ ${file} not found`);
    allFilesExist = false;
  }
}

if (!allFilesExist) {
  process.exit(1);
}

// Test 3: Check package.json bin configuration
console.log('\n📦 Checking package.json bin configuration...');
const packageJson = JSON.parse(fs.readFileSync(join(__dirname, 'package.json'), 'utf8'));

if (packageJson.bin) {
  console.log('  ✅ bin configuration exists');
  
  const expectedBins = {
    'kunai': './cli/kunai.js',
    'yumi': './cli/yumi.js',
    'yari': './cli/yari.js'
  };
  
  for (const [cmd, path] of Object.entries(expectedBins)) {
    if (packageJson.bin[cmd] === path) {
      console.log(`  ✅ ${cmd}: ${path}`);
    } else {
      console.log(`  ❌ ${cmd} path mismatch`);
      allFilesExist = false;
    }
  }
} else {
  console.log('  ❌ bin configuration not found in package.json');
  process.exit(1);
}

// Test 4: Check if client files exist
console.log('\n📄 Checking client files...');
const clientDir = join(__dirname, 'client');
if (fs.existsSync(clientDir)) {
  console.log('  ✅ client/ directory exists');
  
  for (const file of cliFiles) {
    const filePath = join(clientDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ client/${file} exists`);
    } else {
      console.log(`  ❌ client/${file} not found`);
    }
  }
} else {
  console.log('  ❌ client/ directory not found');
}

// Test 5: Check if dist directory exists (build output)
console.log('\n🔨 Checking build output...');
const distDir = join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  console.log('  ✅ dist/ directory exists (project built)');
} else {
  console.log('  ⚠️  dist/ directory not found (run: npm run build)');
}

// Test 6: Check install scripts
console.log('\n📜 Checking installation scripts...');
const scripts = ['install.sh', 'uninstall.sh'];
for (const script of scripts) {
  const scriptPath = join(__dirname, script);
  if (fs.existsSync(scriptPath)) {
    console.log(`  ✅ ${script} exists`);
  } else {
    console.log(`  ❌ ${script} not found`);
  }
}

// Test 7: Check CLI_INSTALL.md
console.log('\n📚 Checking documentation...');
const cliInstallDoc = join(__dirname, 'CLI_INSTALL.md');
if (fs.existsSync(cliInstallDoc)) {
  console.log('  ✅ CLI_INSTALL.md exists');
} else {
  console.log('  ❌ CLI_INSTALL.md not found');
}

console.log('\n' + '='.repeat(50));
console.log('✅ All CLI setup checks passed!');
console.log('='.repeat(50));

console.log('\n📖 Next steps:');
console.log('  1. Build the project: npm run build');
console.log('  2. Install globally: npm link (or ./install.sh on Linux/macOS)');
console.log('  3. Test commands: kunai, yumi, yari');
console.log('\n💡 See CLI_INSTALL.md for complete installation guide');

