# Contributing to Yumi/Yari/Kunai 🏹⚔️🥷

Thank you for your interest in contributing! This guide will help you get started.

## 🎯 Philosophy

This project combines:
- **Simplicity**: Easy-to-use P2P messaging without complex setup
- **Security**: Optional E2E encryption with Yari
- **Decentralization**: Built on GunDB, no central server required
- **Developer Experience**: TypeScript, multiple formats, great tooling

## 🛠️ Development Setup

### Prerequisites

- Node.js 16+ (LTS recommended)
- npm or yarn
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/shogun-yumi.git
cd kunai

# Install dependencies
npm install

# Build the project
npm run build

# Run tests (if available)
npm test

# Try the CLI examples
node client/yumi.js
node client/yari.js
node client/kunai.js
```

### Project Structure

```
kunai/
├── src/              # TypeScript source code
│   ├── yumi.ts      # Plain P2P messaging
│   ├── yari.ts      # Encrypted wrapper
│   ├── kunai.ts     # File transfer
│   ├── types.ts     # Type definitions
│   └── utils.ts     # Utility functions
├── client/          # Node.js CLI examples
│   ├── yumi.js      # Plain messaging CLI
│   ├── yari.js      # Encrypted messaging CLI
│   └── kunai.js     # File transfer CLI
├── apps/            # Browser demo apps
├── dist/            # Compiled builds (auto-generated)
└── relay/           # Gun relay server
```

## 📐 Architecture

### Core Components

1. **Yumi (弓 - Bow)**
   - Base P2P messaging layer
   - Uses GunDB for relay and storage
   - NaCl signatures for authentication
   - No encryption (messages are signed but readable)

2. **Yari (槍 - Spear)**
   - Encrypted wrapper around Yumi
   - Automatic Gun SEA E2E encryption
   - Auto key exchange via RPC
   - Message deduplication

3. **Kunai (苦無 - Throwing Knife)**
   - Ephemeral file transfer
   - GunDB for signaling only
   - Chunked streaming
   - Auto-cleanup after transfer

### Data Flow

```
┌─────────┐                  ┌─────────────┐                  ┌─────────┐
│ Peer A  │──sign/encrypt──▶ │  Gun Relay  │──Gun sync──────▶ │ Peer B  │
└─────────┘                  └─────────────┘                  └─────────┘
                                                                    │
                                                              verify/decrypt
                                                                    │
                                                                emit event
```

## 🔧 Development Guidelines

### Code Style

- **TypeScript**: Use strict type checking
- **Naming**: Use descriptive names, follow existing patterns
- **Comments**: Add JSDoc comments for public APIs
- **Format**: Use 2-space indentation (already configured)

### TypeScript Guidelines

```typescript
// ✅ Good: Clear types, JSDoc comments
/**
 * Send encrypted message to peer(s)
 * @param address Optional peer address for direct message
 * @param message Message data (any JSON-serializable object)
 */
async send(address?: string | any, message?: any): Promise<void> {
  // Implementation
}

// ❌ Bad: No types, no comments
function send(a, b) {
  // Implementation
}
```

### Event Naming Conventions

- Use lowercase with dashes: `'file-received'`, `'transfer-complete'`
- Be descriptive: `'transfer-started'` not just `'start'`
- Follow existing patterns in Yumi/Yari

### Error Handling

```typescript
// ✅ Good: Descriptive errors, proper cleanup
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('❌ Operation failed:', error.message);
  this.cleanup();
  throw new Error(`Failed to complete operation: ${error.message}`);
}

// ❌ Bad: Silent failures
try {
  await riskyOperation();
} catch (e) {
  // Nothing
}
```

## 🧪 Testing

### Manual Testing

1. **Start two terminals**:
   ```bash
   # Terminal 1
   node client/yumi.js
   
   # Terminal 2
   node client/yumi.js
   ```

2. **Verify connection**:
   - Both should show "Connections: 1"
   - Both should see each other's address

3. **Test messaging**:
   ```
   🏹 > send Hello from peer 1
   ```

4. **Test encrypted (Yari)**:
   ```bash
   node client/yari.js
   ```
   - Wait for "Keys exchanged"
   - Send encrypted message

5. **Test file transfer (Kunai)**:
   ```bash
   node client/kunai.js
   🥷 > send test.txt
   ```

### Testing LocalOnly Mode

```bash
# Terminal 1
node client/kunai.js --local

# Terminal 2 (on same LAN)
node client/kunai.js --local

# Should connect via AXE multicast (no external relays)
```

### Testing Encryption

```bash
# Terminal 1
node client/kunai.js --encrypted

# Terminal 2
node client/kunai.js --encrypted

# Should exchange keys and use Yari E2E
```

## 🎨 Adding Features

### Adding a New Event

1. **Define the event in the emitter**:
   ```typescript
   this.emit('new-feature', data);
   ```

2. **Document it in README**:
   ```markdown
   - **`new-feature(data)`** - Description of when it fires
   ```

3. **Add example usage**:
   ```typescript
   kunai.on('new-feature', (data) => {
     console.log('Feature triggered:', data);
   });
   ```

### Adding a New CLI Command

1. **Add to readline handler**:
   ```javascript
   } else if (cmd === 'newcmd') {
     const arg = args[0];
     // Implementation
     console.log('✓ Command executed');
   ```

2. **Add to help text**:
   ```javascript
   console.log("  newcmd <arg>       - Description");
   ```

3. **Test thoroughly**

### Adding a New Option

1. **Add to types**:
   ```typescript
   export interface YumiOptions {
     // ... existing options
     newOption?: boolean;
   }
   ```

2. **Handle in constructor**:
   ```typescript
   if (opts.newOption) {
     // Implementation
     console.log('✅ New option enabled');
   }
   ```

3. **Document in README**

## 🐛 Bug Reports

When filing a bug report, include:

1. **Description**: What happened vs what you expected
2. **Steps to reproduce**: Exact commands to trigger the bug
3. **Environment**: 
   - OS (Windows/Linux/macOS)
   - Node.js version
   - npm/yarn version
4. **Logs**: Copy full error output
5. **Configuration**: Command-line options used

### Example Bug Report

```markdown
**Bug**: File transfer fails with missing chunks

**Steps**:
1. `node client/kunai.js`
2. `send large-file.pdf` (50MB)
3. File receives only 90% of chunks

**Environment**:
- Windows 11
- Node.js v18.17.0
- Command: `node client/kunai.js --encrypted`

**Logs**:
```
❌ Missing 124 chunks for large-file.pdf after 5 sweeps
```
```

## 🚀 Pull Request Process

1. **Fork & Clone**
   ```bash
   git clone https://github.com/yourusername/shogun-yumi.git
   cd kunai
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Changes**
   - Write code
   - Add/update tests
   - Update documentation

4. **Build & Test**
   ```bash
   npm run build
   npm test  # If tests exist
   node client/yumi.js  # Manual testing
   ```

5. **Commit**
   ```bash
   git add .
   git commit -m "feat: Add amazing feature"
   ```

   Use conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation only
   - `refactor:` Code refactoring
   - `perf:` Performance improvement
   - `test:` Adding tests
   - `chore:` Maintenance

6. **Push & PR**
   ```bash
   git push origin feature/amazing-feature
   ```
   Then open a PR on GitHub

7. **Review Process**
   - Maintainers will review
   - Address feedback
   - Once approved, will be merged

## 📚 Documentation

### Updating README

When adding features:
1. Add to appropriate section
2. Include code examples
3. Update API reference
4. Add to comparison table if relevant

### Adding JSDoc Comments

```typescript
/**
 * Send file via GunDB
 * 
 * @param file File metadata (name, size)
 * @param data File data as ArrayBuffer or Uint8Array
 * @returns Promise resolving to transfer ID (e.g., "42-ninja-sakura")
 * 
 * @example
 * ```typescript
 * const buffer = fs.readFileSync('./file.pdf');
 * const code = await kunai.sendFile(
 *   { name: 'file.pdf', size: buffer.length },
 *   buffer
 * );
 * console.log('Transfer code:', code); // "42-ninja-sakura"
 * ```
 */
async sendFile(
  file: File | { name: string; size: number },
  data?: ArrayBuffer | Uint8Array
): Promise<string> {
  // Implementation
}
```

## 🔐 Security

### Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email: security@shogun-eco.xyz (if available)
2. Or use GitHub Security Advisories
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Security Guidelines

- Never log sensitive data (keys, passwords)
- Validate all user input
- Use Gun SEA for encryption (via Yari)
- Keep dependencies updated

## 🌐 Community

- **Questions**: Open a GitHub Discussion
- **Chat**: Join Discord/Telegram (if available)
- **Updates**: Follow on Twitter (if available)

## 📜 License

By contributing, you agree that your contributions will be licensed under the same MIT License that covers the project.

---

## 🙏 Recognition

Contributors will be:
- Added to CONTRIBUTORS.md
- Mentioned in release notes
- Forever remembered in git history 🎖️

Thank you for making Yumi/Yari/Kunai better! 🏹⚔️🥷

