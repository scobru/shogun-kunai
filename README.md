# Yumi (弓), Yari (槍) & Kunai (苦無) 🏹⚔️🥷

**Browser-to-browser P2P networking built on [GunDB](https://gun.eco/) via [Shogun Core](https://github.com/scobru/shogun-core).**

 * 🌐 **Direct browser-to-browser messaging** - No central server required
 * 🔐 **Optional end-to-end encryption** - Automatic encryption with Yari
 * 🥷 **Ephemeral file transfers** - Wormhole-style transfers with Kunai
 * 🚀 **No VPS, domain, or SSL cert needed** - Deploy by opening a browser tab
 * 🔄 **P2P over GunDB relays** - Decentralized message routing
 * 🔑 **Cryptographic identities** - Ed25519 signatures, NaCl encryption
 * 📦 **TypeScript** - Full type definitions, builds to CJS/ESM/UMD
 * 🔫 **Powered by Shogun Core** - Enhanced GunDB capabilities

## Three Tools, One Stack

| Tool | Icon | Purpose | Encryption |
|------|------|---------|------------|
| **Yumi** (弓 - Bow) | 🏹 | P2P messaging | Signed only |
| **Yari** (槍 - Spear) | ⚔️ | Encrypted messaging | E2E (Gun SEA) |
| **Kunai** (苦無 - Knife) | 🥷 | File transfer | Optional |

---

## 🚀 Quick Start

### Installation

**As a library:**
```bash
npm install shogun-yumi
```

**As CLI tools (Linux/macOS):**
```bash
git clone https://github.com/scobru/shogun-yumi.git kunai
cd kunai
chmod +x install.sh && ./install.sh
```

**Manual install (all platforms):**
```bash
npm install && npm run build && npm link
```

Global commands after CLI install: `kunai`, `yumi`, `yari`

### Usage Examples

<details>
<summary><b>📘 Yumi (弓) - Plain P2P Messaging</b></summary>

```javascript
import { Yumi } from 'shogun-yumi';

const yumi = new Yumi("my-room", {
  announce: ["https://relay.shogun-eco.xyz/gun"],
  heartbeat: 15000
});

yumi.on("ready", () => console.log("Address:", yumi.address()));
yumi.on("seen", (address) => console.log("Peer joined:", address));
yumi.on("message", (address, msg) => console.log("From", address, ":", msg));

// Send message
yumi.send({ text: "Hello everyone!" });

// RPC
yumi.register("ping", (address, args, callback) => {
  callback({ pong: true, time: Date.now() });
});

yumi.rpc(peerAddress, "ping", {}, (response) => {
  console.log("Response:", response);
});
```
</details>

<details>
<summary><b>⚔️ Yari (槍) - Encrypted Messaging</b></summary>

```javascript
import { Yari } from 'shogun-yumi';

const yari = new Yari("secure-room", {
  heartbeat: 15000
});

yari.on("ready", () => console.log("🔐 Ready! SEA pub:", yari.sea.pub));

// Keys auto-exchanged
yari.events.on("newPeer", (peers) => {
  console.log("🔑 Keys exchanged:", Object.keys(peers).length);
});

// Listen for decrypted messages
yari.on("decrypted", (address, pubkeys, message) => {
  console.log("🔓 From:", address, "Message:", message);
});

// Send encrypted (auto-encrypted for all peers)
await yari.send({ text: "Secret message!" });
```
</details>

<details>
<summary><b>🥷 Kunai (苦無) - File Transfer</b></summary>

```javascript
import { Kunai } from 'shogun-yumi';
import fs from 'fs';

const kunai = new Kunai('files', { encrypted: true });

kunai.on('ready', async () => {
  // Send file
  const buffer = fs.readFileSync('./doc.pdf');
  const code = await kunai.sendFile(
    { name: 'doc.pdf', size: buffer.length },
    buffer
  );
  console.log('🔑 Transfer code:', code); // "42-ninja-sakura"
});

kunai.on('file-received', (result) => {
  fs.writeFileSync(`./received/${result.filename}`, Buffer.from(result.data));
  console.log('✅ File saved:', result.filename);
});
```
</details>

<details>
<summary><b>🌐 Browser Usage (UMD)</b></summary>

```html
<!-- Dependencies -->
<script src="https://cdn.jsdelivr.net/npm/shogun-core@latest/dist/shogun-core.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl-fast.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bs58@4.0.1/index.js"></script>

<!-- Yumi or Yari -->
<script src="dist/yumi.umd.js"></script>

<script>
  const yumi = new Yumi.Yumi('my-room');
  yumi.on('ready', () => console.log('Ready!'));
</script>
```

💡 **Try the demos:** `apps/yumi.html`, `apps/yari.html`, `apps/kunai.html`
</details>

## 🖥️ CLI Tools

### Installation

**Linux/macOS (automated):**
```bash
git clone https://github.com/scobru/shogun-yumi.git kunai
cd kunai
chmod +x install.sh && ./install.sh
```

**Windows (PowerShell as Admin):**
```powershell
git clone https://github.com/scobru/shogun-yumi.git kunai
cd kunai
Set-ExecutionPolicy Bypass -Scope Process
.\install.ps1
```

**Manual (all platforms):**
```bash
npm install && npm run build && npm link
```

After installation, you'll have global commands: `kunai`, `yumi`, `yari`

### 🥷 Kunai CLI - File Transfer

**Start Kunai:**
```bash
kunai                           # Plain file transfer
kunai --encrypted               # Encrypted transfers
kunai --channel=team-alpha      # Custom channel
```

**Interactive Commands:**
```bash
🥷 > send <filepath>            # Send file, get transfer code
🥷 > receive                    # Wait for incoming file
🥷 > msg <text>                 # Send text message
🥷 > history                    # Show transfer history
🥷 > peers                      # List connected peers
🥷 > quit                       # Exit
```

**Example Workflow:**
```bash
# Terminal 1 (Sender)
$ kunai
🥷 > send document.pdf
📤 Transfer code: 42-ninja-sakura

# Terminal 2 (Receiver)
$ kunai
🥷 > receive
✅ File received: document.pdf (2.3 MB)
```

**Encrypted Transfer:**
```bash
# Both parties use same channel
$ kunai --encrypted --channel=secret-team
🔐🥷 > send confidential.zip
📤 Code: 67-samurai-tokyo
```

### 🏹 Yumi CLI - Plain Messaging

**Start Yumi:**
```bash
yumi                            # Join default room
yumi --room=my-team             # Custom room
```

**Interactive Commands:**
```bash
🏹 > msg <text>                 # Broadcast message
🏹 > send <peer> <text>         # Direct message to peer
🏹 > peers                      # List connected peers
🏹 > ping <peer>                # Ping specific peer
🏹 > rpc <peer> <method> <args> # Call RPC function
🏹 > info                       # Show your address & info
🏹 > quit                       # Exit
```

**RPC Functions Available:**
- `ping` - Get pong response
- `echo <args>` - Echo back arguments
- `info` - Get peer info (address, uptime, connections)

**Example:**
```bash
$ yumi --room=dev-team
🏹 > msg Hello team!
📤 Broadcast sent

🏹 > peers
👥 Connected peers (3):
  - 1FvZw8x... (seen 2s ago)
  - 2Km9pYn... (seen 5s ago)
  - 3JdQrTs... (seen 1s ago)

🏹 > ping 1FvZw8x
🏓 Pong from 1FvZw8x... (23ms)
```

### ⚔️ Yari CLI - Encrypted Messaging

**Start Yari:**
```bash
yari                            # Join encrypted room
yari --room=secret              # Custom encrypted room
```

**Interactive Commands:**
```bash
⚔️ > msg <text>                 # Broadcast encrypted message
⚔️ > send <peer> <text>         # Direct encrypted message
⚔️ > peers                      # List peers with key exchange status
⚔️ > keys                       # Show your SEA public key
⚔️ > ping <peer>                # Encrypted ping
⚔️ > quit                       # Exit
```

**Example:**
```bash
$ yari --room=secure-team
⚔️ Encrypted session ready!
🔑 SEA Public Key: xY9k2m...
🔑 Keys exchanged with 2 peer(s)

⚔️ > msg Secret project update
📤 Encrypted broadcast sent

⚔️ > peers
👥 Encrypted peers (2):
  ✅ 1FvZw8x... (keys exchanged)
  ✅ 2Km9pYn... (keys exchanged)
```

### CLI Options Summary

| Flag | Kunai | Yumi | Yari | Description |
|------|-------|------|------|-------------|
| `--encrypted` | ✅ | - | - | Enable E2E encryption |
| `--channel=<name>` | ✅ | - | - | Custom channel/room |
| `--room=<name>` | - | ✅ | ✅ | Custom room identifier |
| `--relay=<url>` | ✅ | ✅ | ✅ | Add custom Gun relay |
| `--help` | ✅ | ✅ | ✅ | Show help |

### Testing Locally

Run multiple instances in different terminals:

```bash
# Terminal 1
$ yumi --room=test
🏹 > msg Hello from terminal 1!

# Terminal 2
$ yumi --room=test
📨 Message from 1FvZw8x...: Hello from terminal 1!
🏹 > msg Hi back!

# Terminal 3 (file transfer)
$ kunai
🥷 > send test.txt
📤 Code: 23-ronin-kyoto

# Terminal 4 (receive)
$ kunai
🥷 > receive
✅ File received: test.txt
```

### Uninstall

```bash
# Linux/macOS
./uninstall.sh

# Windows (PowerShell as Admin)
.\uninstall.ps1

# Manual
npm unlink shogun-yumi
```

## 📚 API Reference

<details>
<summary><b>Yumi API</b></summary>

**Constructor:**
```typescript
new Yumi(identifier: string, options?: YumiOptions)
```

**Options:**
```typescript
{
  seed?: string;        // Identity persistence
  announce?: string[];  // Gun relay URLs
  heartbeat?: number;   // Heartbeat interval (ms)
  timeout?: number;     // Peer timeout (default: 300000)
  localStorage?: boolean;
  localOnly?: boolean;  // LAN only mode
}
```

**Methods:**
- `address()` - Get your public address
- `send(message)` - Broadcast to all peers
- `send(address, message)` - Direct message (NaCl encrypted)
- `register(name, fn)` - Register RPC function
- `rpc(address, name, args, callback)` - Call peer's RPC
- `connections()` - Get peer count
- `destroy(callback)` - Clean up

**Events:**
- `ready` - Connected
- `seen(address)` - Peer joined
- `left(address)` - Peer left
- `message(address, message, packet)` - Received message
- `connections(count)` - Peer count changed
- `rpc(...)` / `rpc-response(...)` - RPC events

</details>

<details>
<summary><b>Yari API</b></summary>

**Constructor:**
```typescript
new Yari(identifier: string, options?: YumiOptions)
```

Same options as Yumi. All messages auto-encrypted via Gun SEA.

**Additional Properties:**
- `sea` - Gun SEA key pair (`pub`, `priv`, `epub`, `epriv`)
- `peers` - Object mapping addresses to public keys
- `yumi` - Underlying Yumi instance

**Additional Events:**
- `decrypted(address, pubkeys, message, msgId)` - Decrypted message
- `yari.events.on('newPeer', peers => {})` - Keys exchanged

</details>

<details>
<summary><b>Kunai API</b></summary>

**Constructor:**
```typescript
new Kunai(identifier: string, options?: {
  ...YumiOptions,
  encrypted?: boolean;      // Use Yari
  chunkSize?: number;       // Default: 10000
  cleanupDelay?: number;    // Default: 5000
  transferTimeout?: number; // Default: 10000
})
```

**Methods:**
- `sendFile(file: {name, size, type?}, data: ArrayBuffer)` - Send file, returns code
- `send(message)` - Send text message
- `onMessage(callback)` - Listen for messages

**Events:**
- `file-received(result: {filename, size, data, fileId})`
- `transfer-complete(transferId)`
- All Yumi/Yari events

</details>

---

## 🔧 Configuration

**Custom Relays:**
```javascript
const yumi = new Yumi("room", {
  announce: [
    "https://relay.shogun-eco.xyz/gun",
    "https://gun.defucc.me/gun",
    // Your own relay
  ]
});
```

**Local-Only (LAN):**
```javascript
const yumi = new Yumi("lan-room", {
  localOnly: true,
  axe: true  // LAN discovery
});
```

**Debug Logging:**
```bash
DEBUG=yumi,yari,kunai node app.js
# Browser: localStorage.debug = "yumi,yari"
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│  Kunai  │  Yari   │   Yumi          │  ← API Layer
│  Files  │  E2E    │   Plain         │
├─────────┼─────────┴─────────────────┤
│ Chunks  │  Gun SEA Encryption       │  ← Features
├─────────┴───────────────────────────┤
│   Yumi Core (Ed25519 + NaCl)        │  ← Transport
├─────────────────────────────────────┤
│   Shogun Core / GunDB               │  ← Storage
└─────────────────────────────────────┘
```

**How it works:**
1. **Identity:** Ed25519 keypair → Base58Check address
2. **Discovery:** Peers announce on `gun.get(id).get('presence')`
3. **Messages:** Signed packets via Gun sync
4. **Encryption (Yari):** Automatic ECDH key exchange, Gun SEA E2E
5. **Files (Kunai):** Chunked upload → GunDB metadata → auto-cleanup

**Security:**
- Yumi: Signed but NOT encrypted (public)
- Yari: E2E encrypted via Gun SEA (private)
- Kunai: Optional encryption, ephemeral storage

---

## 🚀 Deployment

**Run your own relay:**
```bash
node relay/relay.js 8765
# Or with PM2: pm2 start relay/relay.js --name "gun-relay" -- 8765
```

**Browser server:** Just open `apps/*.html` - it's a P2P node!

---

## 🤝 Contributing

Built with:
- [Shogun Core](https://github.com/scobru/shogun-core) - GunDB + SEA + SHIP
- [GunDB](https://gun.eco) - Decentralized database
- [TweetNaCl](https://tweetnacl.js.org) - Cryptography
- TypeScript - Type safety

Inspired by [KUNAI by chr15m](https://github.com/chr15m/kunai)

**To contribute:**
1. Fork & clone
2. `npm install && npm run build`
3. Make changes in `src/`
4. Test & submit PR

---

## 📄 License

MIT License

---

**Yumi (弓):** Launches messages across the network 🏹  
**Yari (槍):** Protected encrypted messaging ⚔️  
**Kunai (苦無):** Fast ephemeral file transfers 🥷

