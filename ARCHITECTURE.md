# Architecture Documentation 🏛️

## Overview

Yumi/Yari/Kunai is a layered P2P communication stack built on GunDB:

```
┌─────────────────────────────────────────┐
│        Applications (CLI, Browser)       │
├─────────────────────────────────────────┤
│  Kunai (苦無)  │  Yari (槍)  │ Yumi (弓) │  ← API Layer
│  File Transfer │  Encrypted  │   Plain   │
├─────────────────┼─────────────┴───────────┤
│  Signaling Only │   Gun SEA E2E Crypto    │  ← Features
├─────────────────┴─────────────────────────┤
│          Yumi Core (P2P Layer)            │  ← Transport
│    NaCl Signatures + GunDB Messaging      │
├───────────────────────────────────────────┤
│         Shogun Core / GunDB               │  ← Storage/Relay
│  Decentralized Database + Relay Network   │
└───────────────────────────────────────────┘
```

## Core Components

### 1. Yumi (弓 - Bow) - Base P2P Layer

**Purpose**: Foundation for all P2P communication

**Key Features**:
- Ed25519 signatures via TweetNaCl
- Base58Check address encoding
- GunDB for message routing
- Presence announcement
- Peer discovery
- RPC system

**Architecture**:

```typescript
class Yumi extends EventEmitter {
  // Identity
  private keyPair: nacl.SignKeyPair;      // Ed25519 for signing
  private keyPairEncrypt: nacl.BoxKeyPair; // Ephemeral NaCl box
  private seed: string;                    // Base58Check encoded seed
  
  // Networking
  private gun: GunDB;                      // Database instance
  private channel: Gun.Chain;              // Channel node
  private peers: Record<address, PeerInfo>;
  
  // Messaging
  send(message | address, message?)        // Broadcast or direct
  on('message', callback)                  // Receive messages
  
  // RPC
  register(name, fn)                       // Register API function
  rpc(address, name, args, callback)       // Call peer function
}
```

**Message Flow**:

1. **Outgoing**:
   ```
   Message → JSON.stringify → Sign with Ed25519
   → Base64 encode → Store in Gun → Sync to peers
   ```

2. **Incoming**:
   ```
   Gun sync → Base64 decode → Verify signature
   → Parse JSON → Emit 'message' event
   ```

**Presence System**:

```javascript
// Periodic announcement
setInterval(() => {
  gun.get(identifier).get('presence').get(myAddress).put({
    pk: publicKey,
    ek: encryptionKey,
    t: timestamp
  });
}, heartbeatInterval);
```

### 2. Yari (槍 - Spear) - Encryption Layer

**Purpose**: Add end-to-end encryption to Yumi

**Key Features**:
- Gun SEA (via Shogun Core) for E2E encryption
- Automatic key exchange via RPC
- ECDH key agreement
- Message deduplication
- Transparent encryption/decryption

**Architecture**:

```typescript
class Yari {
  private yumi: Yumi;                      // Underlying transport
  private sea: SEAKeyPair;                 // Gun SEA keys
  private peers: Record<address, PublicKeys>;
  
  // Automatic key exchange
  on('seen', (peer) => {
    rpc(peer, 'peer', { pub, epub }, callback);
  });
  
  // Transparent encryption
  async send(message) {
    for (peer of peers) {
      const secret = await SEA.secret(peer.epub, this.sea);
      const encrypted = await SEA.encrypt(message, secret);
      yumi.send(peer, encrypted);
    }
  }
  
  // Transparent decryption
  private async decrypt(from, encrypted) {
    const secret = await SEA.secret(peers[from].epub, this.sea);
    return await SEA.decrypt(encrypted, secret);
  }
}
```

**Key Exchange Protocol**:

```
Peer A                              Peer B
  │                                    │
  │────── Yumi 'seen' event ──────────▶│
  │                                    │
  │─── RPC 'peer' {pub, epub} ────────▶│
  │                                    │
  │◀── Response {success: true} ───────│
  │                                    │
  │◀──── RPC 'peer' {pub, epub} ───────│
  │                                    │
  │──── Response {success: true} ─────▶│
  │                                    │
  │  ✅ Both peers now have each      │
  │     other's public keys            │
  │                                    │
  │─── Encrypted messages via SEA ────▶│
```

**Message Deduplication**:

```typescript
private processedMessages: Set<string> = new Set();

yumi.on('message', (address, message, msgId) => {
  const id = msgId || generateId();
  
  if (this.processedMessages.has(id)) {
    return; // Already processed
  }
  
  this.processedMessages.add(id);
  // ... decrypt and emit
});
```

### 3. Kunai (苦無 - Throwing Knife) - File Transfer

**Purpose**: Ephemeral file transfer without persistence

**Key Features**:
- GunDB for file metadata and chunks
- Chunked streaming (10KB chunks)
- Auto-cleanup after transfer
- Progress tracking
- Optional encryption via Yari
- Transfer codes (e.g., "42-ninja-sakura")

**Architecture**:

```typescript
class Kunai extends EventEmitter {
  private yumi: Yumi;                // Or Yari if encrypted
  private yari: Yari | null;
  
  // File sending
  async sendFile(file, data) {
    const fileId = generateCode();   // "42-ninja-sakura"
    const chunks = chunkData(data);
    
    // Store metadata
    gun.get('files').get(fileId).put({
      name, size, totalChunks, sender, timestamp
    });
    
    // Store chunks with delay to prevent overflow
    for (chunk of chunks) {
      gun.get('chunks').get(fileId).set({
        index, data, timestamp
      });
      await delay(5); // Prevent GunDB stack overflow
    }
  }
  
  // File receiving
  private setupGunDBFileListeners() {
    gun.get('files').map().on((metadata, fileId) => {
      // Listen for chunks
      gun.get('chunks').get(fileId).map().on((chunk) => {
        receivedChunks[chunk.index] = chunk.data;
        
        if (allChunksReceived) {
          reassembleFile();
          emit('file-received');
        }
      });
    });
  }
}
```

**File Transfer Flow**:

```
Sender                              Receiver
  │                                    │
  │── Store metadata in Gun ──────────▶│
  │   (name, size, chunks)             │
  │                                    │
  │── Stream chunks with delay ───────▶│
  │   chunk[0], chunk[1], ...          │◀─ Collect chunks
  │                                    │
  │                                    │─ Detect all chunks
  │                                    │─ Reassemble file
  │                                    │─ Emit 'file-received'
  │                                    │
  │◀─── Confirmation (optional) ───────│
```

**Chunking Strategy**:

```typescript
const CHUNK_SIZE = 10000;  // 10KB chunks
const BATCH_DELAY = 5;     // 5ms between chunks

// Why?
// 1. GunDB has stack overflow issues with large puts
// 2. Small delay allows event loop to clear
// 3. 10KB is good balance (not too small, not too big)

for (let i = 0; i < totalChunks; i++) {
  const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  
  gun.get('chunks').get(fileId).set({
    index: i,
    data: base64Encode(chunk),
    timestamp: Date.now()
  });
  
  await sleep(BATCH_DELAY); // Critical for stability
}
```

**Missing Chunk Recovery**:

```typescript
// Multi-pass sweep to recover missing chunks
for (let sweep = 0; sweep < 5; sweep++) {
  gun.get('chunks').get(fileId).map().once((chunk) => {
    if (!receivedChunks[chunk.index]) {
      receivedChunks[chunk.index] = chunk.data;
    }
  });
  
  await delay(2000); // Give GunDB time to sync
  
  if (allChunksPresent) break;
}
```

## Data Structures

### Address Format

```
Seed: 490a[32 random bytes] → Base58Check
      ↓
  Ed25519 keypair from seed
      ↓
  Address: 55[RIPEMD160(SHA512(pubkey))] → Base58Check
```

Example:
```
Seed: 7qGBpMQ8Y7K4tZMqAhNxwuCpPWCvCvH9qGSKDzwKRPxKb...
Address: BN3VZp4Z8WLNFaT8MG9RpU3... (first 24 chars shown)
```

### Message Packet

```typescript
interface SignedPacket {
  s: string;  // Signature (hex)
  p: string;  // Payload (JSON string)
}

interface Payload {
  t: number;      // Timestamp
  i: string;      // Identifier (channel)
  pk: string;     // Public key (Base58)
  ek: string;     // Encryption key (Base58)
  n: string;      // Nonce (hex)
  y: string;      // Type: 'm'essage, 'r'pc, 'p'ing, 'x' (leave)
  v?: string;     // Message value (JSON)
  c?: string;     // RPC call name
  a?: string;     // RPC arguments (JSON)
  rn?: string;    // RPC nonce
  rr?: string;    // RPC response
}
```

### Encrypted Packet (Yari)

```typescript
interface EncryptedPacket {
  n: string;   // Nonce for NaCl box
  ek: string;  // Sender's encryption key
  e: string;   // Encrypted payload (hex)
}

// Inside encrypted payload (after Gun SEA encryption):
{
  type: "chat",
  text: "Secret message",
  timestamp: 1234567890
}
```

### File Metadata (Kunai)

```typescript
interface FileMetadata {
  name: string;         // "document.pdf"
  type: string;         // "application/pdf"
  size: number;         // 1048576 (bytes)
  totalChunks: number;  // 105 (for 10KB chunks)
  timestamp: number;    // Date.now()
  sender: string;       // Base58 address
}

// Stored at: gun.get('files').get(fileId)
```

### File Chunk (Kunai)

```typescript
interface FileChunk {
  index: number;      // 0, 1, 2, ... (chunk position)
  data: string;       // Base64 encoded chunk
  timestamp: number;  // Date.now()
  fileId: string;     // "42-ninja-sakura"
}

// Stored at: gun.get('chunks').get(fileId).set(chunk)
```

## Configuration Options

### YumiOptions

```typescript
interface YumiOptions {
  seed?: string;           // Identity persistence
  announce?: string[];     // Gun relay URLs
  timeout?: number;        // Peer timeout (default: 5 min)
  heartbeat?: number;      // Heartbeat interval (ms)
  gun?: any;              // Existing Gun instance
  localStorage?: boolean;  // Enable localStorage
  radisk?: boolean;        // Enable RAD (Radix storage)
  wire?: boolean;          // Enable Gun wire protocol
  axe?: boolean;           // Enable AXE (LAN discovery)
  webrtc?: boolean;        // Enable WebRTC
  ws?: boolean;            // Enable WebSocket
  localOnly?: boolean;     // LAN only (no external relays)
}
```

### Option Combinations

| Use Case | Options | Result |
|----------|---------|--------|
| Internet + LAN | `{}` (default) | Uses public relays + all transports |
| LAN only | `{ localOnly: true, axe: true }` | No relays, AXE multicast only |
| Encrypted | `{ encrypted: true }` | Uses Yari (Gun SEA E2E) |
| Private room | `{ channel: 'team-alpha' }` | Custom identifier |
| Persistent ID | `{ seed: '...' }` | Same address every time |

## Performance Considerations

### Memory Usage

```typescript
// Yari message deduplication
private processedMessages: Set<string>;

// Cleanup every 5 minutes
setInterval(() => {
  if (this.processedMessages.size > 1000) {
    const recent = Array.from(this.processedMessages).slice(-500);
    this.processedMessages = new Set(recent);
  }
}, 5 * 60 * 1000);
```

### File Transfer Optimization

```typescript
// Prevent GunDB stack overflow
const BATCH_SIZE = 1;    // One chunk at a time
const BATCH_DELAY = 5;   // 5ms delay

// For 100MB file (10,000 chunks):
// Total time ≈ 10,000 × 5ms = 50 seconds upload
// Plus network latency
```

### Network Efficiency

- **Messages**: ~500 bytes overhead (signatures, keys)
- **File chunks**: 10KB + ~200 bytes metadata
- **Presence**: ~150 bytes every heartbeat interval

## Security Model

### Threat Model

**Yumi (Plain)**:
- ✅ Protects against: Message tampering, impersonation
- ❌ No protection against: Eavesdropping, traffic analysis
- Use case: Public channels, presence systems

**Yari (Encrypted)**:
- ✅ Protects against: Eavesdropping, message tampering, impersonation
- ❌ No protection against: Traffic analysis, metadata leakage
- Use case: Private messaging, sensitive data

**Kunai (Files)**:
- ✅ Optional E2E encryption via Yari
- ❌ Files stored temporarily in Gun (if not using encryption)
- ⚠️ Auto-cleanup reduces exposure window

### Cryptographic Primitives

| Component | Algorithm | Purpose |
|-----------|-----------|---------|
| Signing | Ed25519 | Message authentication |
| Addressing | RIPEMD160(SHA512) | Address derivation |
| Direct messages | NaCl box | Peer-to-peer encryption (Yumi) |
| E2E encryption | Gun SEA (ECDH) | End-to-end encryption (Yari) |
| Key encoding | Base58Check | Human-readable keys |

### Best Practices

1. **Use Yari for sensitive data** - Always prefer encrypted channels
2. **Validate inputs** - Never trust data from peers
3. **Rotate seeds** - Generate new identity periodically
4. **Use localOnly** - For truly private LANs
5. **Monitor relay logs** - If running your own relay

## Debugging

### Enable Debug Logging

**Node.js**:
```bash
DEBUG=yumi node client/yumi.js
DEBUG=yari node client/yari.js
DEBUG=* node client/kunai.js  # All debug output
```

**Browser**:
```javascript
localStorage.debug = "yumi,yari";
```

### Common Issues

**Issue**: Peers not connecting
```
Solution:
1. Check firewall settings
2. Verify relay URLs are accessible
3. Try --local flag for LAN-only
4. Check Gun relay is running
```

**Issue**: File transfer missing chunks
```
Solution:
1. Increase timeout (already has 5 sweeps)
2. Check network stability
3. Reduce file size or increase chunk size
4. Verify both peers stay connected
```

**Issue**: "No peers found after 5s"
```
Solution:
1. Wait longer (10-15s for internet relays)
2. Use --local if on same LAN
3. Check Gun relay accessibility
4. Verify both peers use same channel
```

## Extending the System

### Adding a New Transport Layer

```typescript
class Yumi {
  constructor(opts) {
    // Add new transport
    if (opts.customTransport) {
      this.transport = new CustomTransport(opts);
      this.transport.on('message', (msg) => {
        this.handleMessage(msg);
      });
    }
  }
}
```

### Adding a New Encryption Method

```typescript
class YariAdvanced extends Yari {
  async encrypt(message, peer) {
    // Use different encryption
    const encrypted = await customEncrypt(message, peer.key);
    return encrypted;
  }
}
```

### Custom Relay Discovery

```typescript
const yumi = new Yumi('room', {
  announce: await discoverRelays(), // Custom discovery
  heartbeat: 5000
});

async function discoverRelays() {
  // DHT lookup, DNS-SD, mDNS, etc.
  return ['http://relay1.local', 'http://relay2.local'];
}
```

---

**Further Reading**:
- [GunDB Documentation](https://gun.eco/docs/)
- [NaCl Cryptography](https://nacl.cr.yp.to/)
- [Gun SEA](https://gun.eco/docs/SEA)
- [Shogun Core](https://github.com/scobru/shogun-core)

