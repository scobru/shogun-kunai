# Yumi (弓), Yari (槍) & Kunai (苦無) 🏹⚔️🥷

**Browser-to-browser P2P networking built on [GunDB](https://gun.eco/) via [Shogun Core](https://github.com/scobru/shogun-core).**

 * 🌐 **Easily send messages directly between browsers** - No central server required
 * 🖥️ **Write servers that run in a browser tab** - Backend services without infrastructure
 * 🔐 **Optional end-to-end encryption** - Automatic encryption with Yari
 * 🥷 **Ephemeral file transfers** - Wormhole-style transfers with Kunai (no persistence)
 * 🚀 **No VPS, domain, or SSL cert needed** - Deploy by opening a browser tab
 * 🔄 **P2P over GunDB relays** - Decentralized message routing via Gun network
 * 🔑 **Public key addressing** - Cryptographic identities using NaCl/TweetNaCl
 * 📦 **TypeScript & Multiple Formats** - Written in TypeScript, builds to CJS/ESM/UMD
 * 🔫 **Powered by Shogun Core** - Built on Shogun Core for enhanced GunDB capabilities

## Three Tools, One Stack

### Yumi (弓 - Bow) 🏹
Core P2P messaging library using GunDB for peer discovery and message routing. Messages are **signed but not encrypted** by default. Like a bow launching arrows across the decentralized network.

### Yari (槍 - Spear) ⚔️
Encrypted wrapper around Yumi that adds **automatic end-to-end encryption** using Gun SEA via Shogun Core. All messages are encrypted before transmission. Direct, precise, and protected like a spear. Public keys are automatically exchanged when peers connect.

### Kunai (苦無 - Throwing Knife) 🥷
Ephemeral file transfer using Yumi for signaling. Files are streamed directly **without GunDB persistence**. Fast, temporary transfers like a ninja's throwing knife - quick, precise, and leaves no trace.

---

## 📁 Project Organization

This repository is organized for different use cases:

- **`src/`** - TypeScript source code for Yumi & Yari libraries
- **`dist/`** - Compiled builds (CJS, ESM, UMD) - auto-generated
- **`client/`** - Interactive Node.js CLI examples with readline
  - `yumi.js` - Plain P2P messaging CLI
  - `yari.js` - Encrypted P2P messaging CLI
  - `kunai.js` - Ephemeral file transfer CLI
- **`apps/`** - Beautiful browser demo applications (HTML + UMD)
  - `yumi.html` - Plain P2P chat demo
  - `yari.html` - Encrypted P2P chat demo
  - `kunai.html` - File transfer demo
- **`relay/`** - Gun relay server for peer discovery and message routing

Whether you're building a web app, Node.js service, or just exploring P2P, we've got you covered!

---

## Quick Start

> **✨ TypeScript!** Written in **TypeScript** and compiled to multiple formats (CommonJS, ES Modules, UMD). Works seamlessly in Node.js, browsers, and bundlers with full type definitions!

### Installation

Using npm (recommended):

```bash
npm install shogun-yumi
```

Or with yarn:

```bash
yarn add shogun-yumi
```

The package includes all necessary dependencies (Shogun Core, TweetNaCl, bs58, etc.)

### Node.js Usage

**CommonJS:**
```javascript
const { Yumi, Yari } = require('shogun-yumi');

// Yumi (弓): Plain P2P messaging
const yumi = new Yumi('my-room');

// Yari (槍): Encrypted P2P messaging
const yari = new Yari('secret-room');
```

**ES Modules:**
```javascript
import { Yumi, Yari } from 'shogun-yumi';

// Plain messaging
const yumi = new Yumi('my-room');

// Encrypted messaging
const yari = new Yari('secret-room');
```

**TypeScript:**
```typescript
import { Yumi, Yari, YumiOptions } from 'shogun-yumi';

const options: YumiOptions = {
  announce: ["https://relay.shogun-eco.xyz/gun"],
  heartbeat: 15000
};

const yumi = new Yumi('my-room', options);
const yari = new Yari('secret-room', options);
```

### Browser Usage

Include dependencies via CDN and use the UMD build:

```html
<!-- Shogun Core (includes Gun + SEA) -->
<script src="https://cdn.jsdelivr.net/npm/shogun-core@latest/dist/shogun-core.umd.js"></script>

<!-- TweetNaCl for crypto -->
<script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl-fast.min.js"></script>

<!-- bs58 for address encoding (inline or CDN) -->
<script src="https://cdn.jsdelivr.net/npm/bs58@4.0.1/index.js"></script>

<!-- Yumi UMD build (plain P2P) - includes debug and events polyfills -->
<script src="dist/yumi.umd.js"></script>

<!-- Or Yari UMD build (encrypted P2P) - includes debug and events polyfills -->
<script src="dist/yari.umd.js"></script>

<script>
  // Available as globals: Yumi and Yari
  const yumi = new Yumi.Yumi('my-room');
  // or for encrypted:
  const yari = new Yari.Yari('secret-room');
</script>
```

**💡 Tip:** Check out the ready-to-use demos in `apps/yumi.html` and `apps/yari.html`!

**Note:** The UMD builds include Node.js polyfills for `debug` and `events`, making them fully self-contained for browser use.

---

## Yumi (弓) Usage

### Basic P2P Chat Room

```javascript
import { Yumi } from 'shogun-yumi';
// Or: const { Yumi } = require('shogun-yumi');

// Create a room - all peers with same identifier connect
const yumi = new Yumi("my-chat-room", {
  announce: [
    "http://peer.wallie.io/gun",
    "https://relay.shogun-eco.xyz/gun",
    "https://gun.defucc.me/gun"
  ],
  heartbeat: 15000
});

// Ready event
yumi.on("ready", () => {
  console.log("Connected! My address:", yumi.address());
});

// See new peers
yumi.on("seen", (address) => {
  console.log("Peer joined:", address);
});

// Receive messages
yumi.on("message", (address, message) => {
  console.log("Message from", address, ":", message);
});

// Send broadcast message
yumi.send({ text: "Hello everyone!" });

// Track connections
yumi.on("connections", (count) => {
  console.log("Connected peers:", count);
});
```

### RPC (Remote Procedure Calls)

```javascript
// Register an API function
yumi.register("ping", (address, args, callback) => {
  console.log("Ping from:", address);
  callback({ pong: true, time: Date.now() });
});

// Call a peer's RPC function
yumi.on("seen", (address) => {
  yumi.rpc(address, "ping", { hello: "world" }, (response) => {
    console.log("RPC response:", response);
  });
});
```

### Persistent Identity

```javascript
// Save seed to maintain same address across sessions
localStorage["my-yumi-seed"] = yumi.seed;

// Restore identity next session
const yumi = new Yumi("my-room", {
  seed: localStorage["my-yumi-seed"]
});
```

---

## Yari (槍) Usage (Encrypted) ⚔️🔐

### Encrypted P2P Chat

```javascript
import { Yari } from 'shogun-yumi';
// Or: const { Yari } = require('shogun-yumi');

// Create encrypted room
const yari = new Yari("encrypted-room", {
  announce: [
    "http://peer.wallie.io/gun",
    "https://relay.shogun-eco.xyz/gun"
  ],
  heartbeat: 15000
});

// Ready event
yari.on("ready", () => {
  console.log("⚔️  Encrypted session ready!");
  console.log("Address:", yari.address);
  console.log("SEA public key:", yari.sea.pub);
});

// Keys are automatically exchanged
yari.events.on("newPeer", (peers) => {
  console.log("🔑 Keys exchanged with", Object.keys(peers).length, "peer(s)");
});

// Listen for DECRYPTED messages
yari.on("decrypted", (address, pubkeys, message) => {
  console.log("🔓 Decrypted from:", address);
  console.log("Message:", message);
});

// Send encrypted message (auto-encrypted for all peers)
yari.send({ text: "This is encrypted!", secret: "data" });

// Send to specific peer
yari.send(peerAddress, { text: "Direct encrypted message" });
```

### Encrypted RPC

```javascript
// Register encrypted RPC function
yari.register("secret-ping", (address, args, callback) => {
  console.log("⚔️  Encrypted ping from:", address);
  callback({ 
    pong: true, 
    encrypted: true,
    yourSecret: args.secret 
  });
});

// Call encrypted RPC
yari.rpc(peerAddress, "secret-ping", { secret: "data" }, (response) => {
  console.log("⚔️  Encrypted response:", response);
});
```

---

## Kunai (苦無) Usage (Ephemeral File Transfer) 🥷

### Quick File Transfer

**Node.js CLI:**
```bash
# Terminal 1 (Sender)
node client/kunai.js

🥷 > send myfile.pdf
# Outputs: Transfer code: 42-ninja-sakura

# Terminal 2 (Receiver)  
node client/kunai.js

🥷 > receive
# Auto-accepts when file is offered
# File downloads automatically
```

**Browser:**
```html
<!-- Open apps/kunai.html in browser -->
<!-- Select file, click Send -->
<!-- Share the code: 42-ninja-sakura -->
<!-- Other peer enters code and receives -->
```

### How It Works

1. **Sender** selects file → generates one-time code (e.g., `42-ninja-sakura`)
2. **Signaling via GunDB** → metadata exchange (file name, size, chunks)
3. **Direct streaming** → file chunks sent without GunDB persistence
4. **Auto-cleanup** → chunks deleted after 5 seconds
5. **Receiver** assembles chunks → downloads file

### Key Features

✅ **No Persistence** - Files don't stay in GunDB  
✅ **One-Time Codes** - Wormhole-style human-readable codes  
✅ **Auto-Cleanup** - Chunks self-destruct after transfer  
✅ **Progress Tracking** - Real-time transfer progress  
✅ **Browser & Node.js** - Works everywhere  
✅ **Optional E2E Encryption** - Use Yari for encrypted transfers  
✅ **Custom Channels** - Private transfer rooms for teams  

### Example: Encrypted File Transfer

```javascript
import { Kunai } from 'shogun-yumi';

// Create encrypted Kunai (uses Yari E2E)
const kunai = new Kunai('secure-transfer', {
  encrypted: true,              // ← Enable encryption
  channel: 'team-secret-room'   // ← Custom channel
});

// Send encrypted file
kunai.on('ready', () => {
  const file = fs.readFileSync('./secret.pdf');
  const code = kunai.sendOffer(
    { name: 'secret.pdf', size: file.length },
    file
  );
  console.log('🔐 Encrypted transfer code:', code);
  // Output: 67-samurai-tokyo
});

// Receive encrypted file (auto-accepts and decrypts)
kunai.on('file-received', (result) => {
  console.log('🔓 Decrypted file:', result.filename);
  fs.writeFileSync('./received/' + result.filename, result.buffer);
});
```

**CLI Usage:**
```bash
# Encrypted transfer
node client/kunai.js --encrypted --channel=team-alpha
🔐🥷 > send confidential.pdf
```

---

## Live Demos

### Browser Apps (HTML)

Open these HTML files in your browser to try live P2P:

- **`apps/yumi.html`** - Yumi (弓) Plain P2P chat with beautiful UI
- **`apps/yari.html`** - Yari (槍) Encrypted P2P chat ⚔️🔐 with encryption indicators
- **`apps/kunai.html`** - Kunai (苦無) Ephemeral file transfer 🥷 with auto-cleanup

**Note:** These demos use the compiled UMD builds from `dist/`. Make sure to run `npm run build` first if you've modified the source code.

### Node.js CLI Examples

Interactive command-line examples for P2P messaging:

```bash
# Install dependencies first
npm install

# Build the project
npm run build

# Yumi (弓): Plain P2P CLI
node client/yumi.js

# Yari (槍): Encrypted P2P CLI
node client/yari.js

# Kunai (苦無): Ephemeral File Transfer CLI
node client/kunai.js
```

Run multiple instances in different terminals to see them connect!

### CLI Interactive Features

The Node.js examples in `client/` provide interactive command-line interfaces:

**Yumi CLI (`client/yumi.js`):**
```bash
🏹 > send Hello World!      # Broadcast message
🏹 > peers                   # List connected peers  
🏹 > ping <address>         # Ping a specific peer
🏹 > info <address>         # Get peer information
🏹 > quit                    # Exit gracefully
```

**Yari CLI (`client/yari.js`):**
```bash
⚔️  > send Secret message    # Broadcast encrypted message
⚔️  > peers                  # List peers with exchanged keys
⚔️  > ping <address>        # Encrypted ping/pong
⚔️  > quit                   # Exit gracefully
```

**Kunai CLI (`client/kunai.js`):**
```bash
🥷 > send myfile.pdf         # Send file (generates code)
🥷 > receive                 # Listen for incoming transfers
🥷 > quit                    # Exit gracefully
```

These CLIs are perfect for:
- Testing P2P connectivity
- Building command-line tools
- Server-side messaging
- DevOps automation
- Linux/Unix integration
- **Ephemeral file sharing** (Kunai)

See [DEMOS.md](./DEMOS.md) for more detailed demo documentation.

---

## API Reference

### Yumi (弓)

#### Constructor
```javascript
new Yumi(identifier, options)
```

**Parameters:**
- `identifier` (string): Room/swarm identifier. Use same ID for all peers that should connect.
- `options` (object):
  - `seed` (string): Seed for identity persistence (generates same address)
  - `announce` (array): Gun relay server URLs
  - `heartbeat` (number): Heartbeat interval in ms (default: 30000)
  - `timeout` (number): Peer timeout in ms (default: 300000)
  - `gun` (object): Existing Gun instance (optional)

#### Methods

- **`address()`** - Get your public address
- **`send(message)`** - Broadcast message to all peers
- **`send(address, message)`** - Send message to specific peer (encrypted)
- **`register(name, fn)`** - Register RPC function
- **`rpc(address, name, args, callback)`** - Call peer's RPC function
- **`heartbeat(interval)`** - Start heartbeat timer
- **`destroy(callback)`** - Clean up and disconnect
- **`connections()`** - Get number of connected peers

#### Events

- **`ready`** - Connected and ready
- **`seen(address)`** - New peer joined
- **`left(address)`** - Peer disconnected
- **`message(address, message, packet)`** - Received message
- **`connections(count)`** - Peer count changed
- **`ping(address)`** - Received ping
- **`rpc(address, call, args, nonce)`** - Received RPC call
- **`rpc-response(address, nonce, response)`** - Received RPC response

### Yari (槍)

#### Constructor
```javascript
new Yari(identifier, options)
```

Same parameters as Yumi, plus:
- `seaPair` (object): Existing Gun SEA key pair (optional)

#### Methods

Same as Yumi, plus:
- **`SEA(pair)`** - Set or generate SEA key pair

#### Properties

- **`sea`** - Gun SEA key pair (`pub`, `priv`, `epub`, `epriv`)
- **`peers`** - Object mapping addresses to their public keys
- **`yumi`** - Underlying Yumi instance

#### Events

All Yumi events, plus:
- **`decrypted(address, pubkeys, message)`** - Received and decrypted message

Use `yari.events.on()` for Yari-specific events:
- **`newPeer(peers)`** - Keys exchanged with new peer

---

## TypeScript & Build System

This library is written in **TypeScript** and compiled to multiple formats for maximum compatibility.

### Project Structure

```
shogun-yumi/
├── src/                    # TypeScript source
│   ├── yumi.ts            # Yumi (弓) core - plain P2P
│   ├── yari.ts            # Yari (槍) encryption layer
│   ├── types.ts           # Type definitions
│   ├── utils.ts           # Utility functions
│   └── index.ts           # Main exports
├── dist/                   # Compiled output
│   ├── yumi.cjs.js        # CommonJS (Node.js)
│   ├── yumi.esm.js        # ES Modules (bundlers)
│   ├── yumi.umd.js        # UMD (browser)
│   ├── yari.cjs.js        # Encrypted version (CommonJS)
│   ├── yari.esm.js        # Encrypted version (ESM)
│   ├── yari.umd.js        # Encrypted version (UMD)
│   └── *.d.ts             # TypeScript definitions
├── client/                 # Node.js CLI examples
│   ├── yumi.js            # Yumi interactive CLI
│   └── yari.js            # Yari encrypted CLI
├── apps/                   # Browser demo apps
│   ├── yumi.html          # Yumi UMD demo
│   └── yari.html          # Yari UMD demo
├── relay/                  # Gun relay server
│   └── relay.js           # Relay server for peer discovery
└── package.json
```

### Output Formats

| Format | File | Use Case |
|--------|------|----------|
| **CommonJS** | `dist/*.cjs.js` | Node.js `require()` |
| **ES Modules** | `dist/*.esm.js` | Modern bundlers (Webpack, Vite) |
| **UMD** | `dist/*.umd.js` | Browser `<script>` tags |
| **Types** | `dist/*.d.ts` | TypeScript support |

### Building from Source

```bash
# Install dependencies
npm install

# Build all formats
npm run build

# Development (watch mode)
npm run dev
```

See [TYPESCRIPT_BUILD.md](./TYPESCRIPT_BUILD.md) for detailed build documentation.

---

## Configuration

> **Note:** Yumi & Yari use [Shogun Core](https://github.com/scobru/shogun-core) for GunDB initialization, providing enhanced configuration options and better defaults.

### Custom Gun Relays

```javascript
const yumi = new Yumi("my-room", {
  announce: [
    "http://peer.wallie.io/gun",
    "https://relay.shogun-eco.xyz/gun",
    "https://gun.defucc.me/gun",
    "https://a.talkflow.team/gun",
    // Add your own Gun relay here
  ]
});
```

### Heartbeat & Timeouts

```javascript
const yumi = new Yumi("my-room", {
  heartbeat: 10000,  // Heartbeat every 10 seconds
  timeout: 60000     // Consider peer dead after 60 seconds
});
```

### Debug Logging

In Node.js:
```bash
DEBUG=yumi node example_yumi.js
DEBUG=yari node example_yari.js
```

In browser console:
```javascript
localStorage.debug = "yumi,yari";
```

---

## How It Works

1. **Initialization**: Yumi uses Shogun Core to initialize GunDB with optimal configuration
2. **Identity**: Each peer generates an Ed25519 key pair (NaCl) for signing messages
3. **Addressing**: Address = Base58Check(RIPEMD160(SHA512(publicKey)))
4. **Discovery**: Peers announce presence on Gun relay at `gun.get('yumi-ROOM').get('presence')`
5. **Messages**: Signed packets stored at `gun.get('yumi-ROOM').get('messages')`
6. **Encryption** (Yari): Automatic ECDH key exchange using Shogun Core's SEA integration

### Message Flow

```
[Peer A] ──sign with Ed25519──> [Gun Relay] ──Gun sync──> [Peer B]
                                                              │
                                                        verify signature
                                                              │
                                                        decrypt (if Yari)
                                                              │
                                                          emit 'message'
```

---

## Security Notes

⚠️ **Yumi (弓 - Plain)**:
- Messages are **signed** but **NOT encrypted**
- Anyone listening to the Gun relay can read messages
- Use Yari for sensitive data

✅ **Yari (槍 - Encrypted)**:
- End-to-end encryption using Gun SEA via Shogun Core
- Automatic ECDH key exchange
- Messages encrypted before transmission
- Only peers with exchanged keys can decrypt

🔒 **Both**:
- This is experimental software
- Peer discovery means exposing your IP to Gun relays
- Be cautious with sensitive data

---

## Deployment

### Gun Relay Server

Run your own Gun relay server to help peers discover each other:

```bash
# Start relay on default port 8765
node relay/relay.js

# Or specify a custom port
node relay/relay.js 3000
```

The relay server provides:
- HTTP status page at `http://localhost:8765/`
- Gun endpoint at `http://localhost:8765/gun`
- WebSocket support for real-time sync
- Peer discovery and message routing

Keep it running with PM2:
```bash
npm install -g pm2
pm2 start relay/relay.js --name "gun-relay" -- 8765
pm2 save
pm2 startup
```

### Browser Tab Server

Simply open `apps/yumi.html` or `apps/yari.html` in a browser - it's now a P2P node! Share the URL hash to let others connect.

### Node.js CLI Server

```bash
# Plain P2P messaging
node client/yumi.js

# Encrypted P2P messaging
node client/yari.js
```

Keep the process running with PM2:
```bash
npm install -g pm2
pm2 start client/yumi.js --name "yumi-node"
# or for encrypted:
pm2 start client/yari.js --name "yari-node"
pm2 save
pm2 startup
```

---

## Comparison: Yumi vs Yari vs Kunai

| Feature | Yumi (弓) | Yari (槍) | Kunai (苦無) |
|---------|-----------|-----------|--------------|
| Meaning | Bow | Spear | Throwing Knife |
| Transport | GunDB | GunDB | GunDB (signaling only) |
| Signing | ✅ Ed25519 | ✅ Ed25519 | ✅ Ed25519 |
| Encryption | ❌ No | ✅ Gun SEA | ✅ Optional (via Yari) |
| Persistence | ✅ Yes | ✅ Yes | ❌ Ephemeral |
| Use Case | Chat, presence | Private messaging | File transfer |
| Overhead | Low | Medium | Low (streaming) |
| Key Exchange | Manual | Automatic | Automatic (if encrypted) |
| Cleanup | Manual | Manual | ✅ Automatic |
| Custom Channels | ✅ Yes | ✅ Yes | ✅ Yes |
| Icon | 🏹 | ⚔️ | 🥷 |

---

## Dependencies

- **shogun-core** - Unified interface for GunDB with SEA encryption, SHIP protocol, and Web3 integrations
- **tweetnacl** - Crypto primitives (Ed25519, NaCl box) for signing and address generation
- **bs58** / **bs58check** - Base58 encoding for addresses

All dependencies are included when you `npm install bugout-gun`.

### What is Shogun Core?

[Shogun Core](https://github.com/scobru/shogun-core) provides:
- 🔫 **GunDB Integration** - Decentralized database with relay network
- 🔐 **SEA Encryption** - Gun's Security, Encryption, Authorization library
- 🚢 **SHIP Protocol** - Standardized data structures for decentralized apps
- 🌐 **Web3 Support** - Ethereum, IPFS, and blockchain integrations

Yumi & Yari leverage Shogun Core for simplified GunDB setup and enhanced cryptographic capabilities.

---

## TypeScript Types

The library includes complete TypeScript type definitions. Available types:

```typescript
import {
  Yumi,
  Yari,
  YumiOptions,
  PeerInfo,
  MessagePacket,
  SignedPacket,
  EncryptedPacket,
  SEAKeyPair,
  YariPeerInfo,
  RPCCallback,
  APIFunction,
  // Legacy aliases:
  BugoutGun,
  Bugoff,
  BugoutOptions
} from 'shogun-yumi';
```

See `dist/types.d.ts` for all available types.

---

## Contributing

This library combines the best of:
- Original Bugout's elegant API (chr15m)
- Shogun Core's unified GunDB interface
- GunDB's decentralized infrastructure  
- Gun SEA's encryption capabilities via Shogun Core
- TypeScript for type safety and developer experience
- Japanese aesthetics: Yumi (弓 - Bow) & Yari (槍 - Spear)

**Development Workflow:**

1. Clone the repository
2. Install dependencies: `npm install`
3. Make changes in `src/`
4. Build: `npm run build`
5. Test your changes
6. Submit a pull request

**Areas for improvement:**
- Better peer timeout handling
- Message deduplication optimization
- Alternative relay discovery mechanisms
- Mobile browser support testing
- Additional TypeScript examples
- API documentation generation

---

## FAQ & Tips

### Which format should I use?

- **Node.js projects**: Use the automatic import/require - the package.json will select the right format
- **Modern bundlers** (Webpack, Vite, Rollup): Automatically uses ESM format for tree-shaking
- **Browser with script tag**: Use UMD files from `dist/*.umd.js`
- **TypeScript projects**: All formats include `.d.ts` type definitions

### How do I persist my identity?

```javascript
// Save seed to maintain same address across sessions
localStorage.setItem('my-yumi-seed', yumi.seed);

// Restore identity next time
const yumi = new Yumi("my-room", {
  seed: localStorage.getItem('my-yumi-seed')
});
```

### Which tool should I use?

- Use **Yumi (弓)** for: Public channels, presence systems, collaborative apps, real-time updates
- Use **Yari (槍)** for: Private messaging, encrypted data sync, sensitive information, secure communications
- Use **Kunai (苦無)** for: Quick file transfers, sharing documents, temporary data exchange (no persistence)

### Do I need to run my own Gun relay?

No! The library uses public Gun relays by default. However, you can add your own relays in the `announce` option for better performance and reliability.

### Can I use this in React/Vue/Svelte?

Yes! The library works in any JavaScript framework. Import it like any npm package:

```javascript
import { Yumi, Yari } from 'shogun-yumi';
```

Just make sure to clean up connections when components unmount:

```javascript
// In cleanup (useEffect return, onUnmounted, etc.)
yumi.destroy();
// or
yari.destroy();
```

---

## License

MIT - See LICENSE file

---

## Credits

Inspired by [Bugout by chr15m](https://github.com/chr15m/bugout) - reimagined for the Gun ecosystem with TypeScript, Shogun Core integration, and Japanese naming.

Built on top of [Shogun Core](https://github.com/scobru/shogun-core) for enhanced GunDB and SEA capabilities.

**Yumi (弓 - Bow)**: Launches messages across the decentralized network 🏹  
**Yari (槍 - Spear)**: Direct, precise, and protected encrypted messaging ⚔️  
**Kunai (苦無 - Throwing Knife)**: Fast, ephemeral file transfers without persistence 🥷

### Version History

- **v1.0.0** - Complete rewrite with Japanese naming (Yumi & Yari)
  - TypeScript implementation
  - Multi-format builds (CJS/ESM/UMD)
  - Complete type definitions
  - Modern build system with Rollup
  - Shogun Core integration for GunDB and SEA
  - Gun SEA integration for Yari (encrypted)
  - npm package: `shogun-yumi`
  - ES Modules (no more CommonJS require)

---

## Shogun Core Benefits

By integrating [Shogun Core](https://github.com/scobru/shogun-core), Yumi & Yari gain:

### 🎯 **Simplified Configuration**
- Pre-configured Gun relays with optimal settings
- Automatic localStorage and RAD setup
- No need to manually manage Gun instances

### 🔐 **Enhanced Security**
- Direct access to Gun SEA for encryption (Yari)
- Consistent cryptographic operations
- Better key management

### 🚢 **SHIP Protocol Ready**
- Compatible with Shogun ecosystem apps
- Standardized data structures
- Future-proof for decentralized app development

### 🌐 **Web3 Integration** (Future)
- Ethereum wallet integration potential
- IPFS storage capabilities
- Cross-chain communication possibilities

---

## Additional Resources

- 📖 [TypeScript Build Documentation](./TYPESCRIPT_BUILD.md)
- 🥷 [Kunai File Transfer Guide](./KUNAI.md)
- 🎮 [Demo Files](./DEMOS.md)
- 🔧 [Source Code](./src/)
- 🖥️ [CLI Examples](./client/)
- 🌐 [Browser Apps](./apps/)
- 🔌 [Relay Server](./relay/)
- 📦 [npm Package](https://www.npmjs.com/package/shogun-yumi) (when published)
- 🔫 [Shogun Core](https://github.com/scobru/shogun-core)
- 🏹 [Original Bugout](https://github.com/chr15m/bugout)

---

> Infected with the [FAMGA](https://duckduckgo.com/?q=FAMGA) virus everybody's eating brains. Time to grab yr bugout box & hit the forest.

