# API Reference 📚

Complete API documentation for Yumi, Yari, and Kunai.

## Table of Contents

- [Yumi API](#yumi-api) - Plain P2P messaging
- [Yari API](#yari-api) - Encrypted messaging
- [Kunai API](#kunai-api) - File transfer
- [Types](#types) - TypeScript types

---

## Yumi API

### Constructor

```typescript
new Yumi(identifier?: string, options?: YumiOptions)
```

Creates a new Yumi instance for P2P messaging.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | `string` | No | Room/channel identifier. All peers with same ID connect. Defaults to your address. |
| `options` | `YumiOptions` | No | Configuration options (see below) |

**Options:**

```typescript
interface YumiOptions {
  seed?: string;           // Seed for persistent identity
  announce?: string[];     // Gun relay server URLs
  timeout?: number;        // Peer timeout in ms (default: 300000)
  heartbeat?: number;      // Heartbeat interval in ms
  gun?: any;              // Existing Gun instance
  localStorage?: boolean;  // Enable localStorage (default: false)
  radisk?: boolean;        // Enable RAD storage (default: false for Node, true for browser)
  wire?: boolean;          // Enable Gun wire protocol
  axe?: boolean;           // Enable AXE multicast for LAN
  webrtc?: boolean;        // Enable WebRTC
  ws?: boolean;            // Enable WebSocket
  localOnly?: boolean;     // Disable external relays (LAN only)
  rtc?: object;           // WebRTC configuration (ICE servers)
}
```

**Example:**

```typescript
import { Yumi } from 'shogun-yumi';

const yumi = new Yumi('my-chat-room', {
  announce: [
    'http://peer.wallie.io/gun',
    'https://relay.shogun-eco.xyz/gun'
  ],
  heartbeat: 15000,
  localOnly: false
});
```

### Properties

#### `yumi.seed: string`

Base58Check encoded seed for identity. Save this to restore same address later.

```typescript
console.log(yumi.seed);
// "7qGBpMQ8Y7K4tZMqAhNxwuCpPWCvCvH9qGSKDzwKRPxKb..."

// Save for later
localStorage.setItem('my-seed', yumi.seed);

// Restore
const yumi2 = new Yumi('room', { 
  seed: localStorage.getItem('my-seed') 
});
```

#### `yumi.identifier: string`

The room/channel identifier.

```typescript
console.log(yumi.identifier); // "my-chat-room"
```

#### `yumi.peers: Record<string, PeerInfo>`

Currently connected peers.

```typescript
console.log(yumi.peers);
// {
//   "BN3VZp4Z8WLNFaT8...": {
//     pk: "7qGBpMQ8...",
//     ek: "9xKLmP2s...",
//     last: 1234567890123
//   }
// }
```

#### `yumi.gun: GunDB`

The underlying Gun instance.

```typescript
// Direct Gun access
yumi.gun.get('custom-data').put({ hello: 'world' });
```

### Methods

#### `address(publicKey?: string): string`

Get your address or derive address from public key.

```typescript
// Get your address
const myAddress = yumi.address();
console.log(myAddress); // "BN3VZp4Z8WLNFaT8MG9RpU3..."

// Derive address from public key
const peerAddress = yumi.address(peerPublicKey);
```

#### `send(message: any): void`

Broadcast message to all peers.

```typescript
// Simple message
yumi.send({ type: 'chat', text: 'Hello everyone!' });

// Complex data
yumi.send({
  type: 'notification',
  title: 'New Event',
  data: { id: 123, timestamp: Date.now() },
  urgent: true
});
```

#### `send(address: string, message: any): void`

Send direct message to specific peer (encrypted with NaCl box).

```typescript
yumi.on('seen', (peerAddress) => {
  // Send private message
  yumi.send(peerAddress, {
    type: 'private',
    text: 'Secret message just for you'
  });
});
```

#### `register(name: string, fn: APIFunction, docstring?: string): void`

Register an RPC function that peers can call.

```typescript
yumi.register('get-status', (address, args, callback) => {
  console.log('Status requested by:', address);
  callback({
    status: 'online',
    uptime: process.uptime(),
    peers: Object.keys(yumi.peers).length
  });
}, 'Get current status');

yumi.register('echo', (address, args, callback) => {
  callback({ echo: args });
}, 'Echo back the arguments');
```

**Function Signature:**

```typescript
type APIFunction = (
  address: string,    // Caller's address
  args: any,          // Arguments passed by caller
  callback: (result: any) => void  // Send response
) => void;
```

#### `rpc(address: string, call: string, args: any, callback: (result: any) => void): void`

Call a peer's RPC function.

```typescript
yumi.on('seen', (peerAddress) => {
  yumi.rpc(peerAddress, 'get-status', {}, (response) => {
    console.log('Peer status:', response);
    // { status: 'online', uptime: 123.45, peers: 2 }
  });
});
```

#### `ping(): void`

Send ping to all peers.

```typescript
yumi.ping();
```

#### `heartbeat(interval?: number): void`

Start heartbeat timer for presence announcements.

```typescript
yumi.heartbeat(10000); // Every 10 seconds
```

#### `connections(): number`

Get number of connected peers.

```typescript
console.log('Connected peers:', yumi.connections());
```

#### `destroy(callback?: () => void): void`

Clean up and disconnect.

```typescript
process.on('SIGINT', () => {
  yumi.destroy(() => {
    console.log('Disconnected gracefully');
    process.exit(0);
  });
});
```

### Events

Listen to events with `yumi.on(event, handler)`.

#### `ready`

Emitted when Yumi is initialized and ready.

```typescript
yumi.on('ready', () => {
  console.log('✅ Ready! Address:', yumi.address());
});
```

#### `seen` → `(address: string)`

Emitted when a new peer joins.

```typescript
yumi.on('seen', (address) => {
  console.log('👀 Peer joined:', address);
});
```

#### `left` → `(address: string)`

Emitted when a peer disconnects.

```typescript
yumi.on('left', (address) => {
  console.log('👋 Peer left:', address);
});
```

#### `timeout` → `(address: string)`

Emitted when a peer times out.

```typescript
yumi.on('timeout', (address) => {
  console.log('⏱️ Peer timed out:', address);
});
```

#### `connections` → `(count: number)`

Emitted when peer count changes.

```typescript
yumi.on('connections', (count) => {
  console.log('🔗 Connections:', count);
});
```

#### `message` → `(address: string, message: any, packet: any)`

Emitted when receiving a message.

```typescript
yumi.on('message', (address, message, packet) => {
  console.log('📨 From:', address);
  console.log('Message:', message);
  console.log('Packet:', packet);
});
```

#### `ping` → `(address: string)`

Emitted when receiving a ping.

```typescript
yumi.on('ping', (address) => {
  console.log('🏓 Ping from:', address);
});
```

#### `rpc` → `(address: string, call: string, args: any, nonce: string)`

Emitted when receiving an RPC call.

```typescript
yumi.on('rpc', (address, call, args, nonce) => {
  console.log('📞 RPC call:', call, 'from:', address);
});
```

#### `rpc-response` → `(address: string, nonce: string, response: any)`

Emitted when receiving an RPC response.

```typescript
yumi.on('rpc-response', (address, nonce, response) => {
  console.log('📞 RPC response:', response);
});
```

---

## Yari API

### Constructor

```typescript
new Yari(identifier: string, options?: YumiOptions)
```

Creates a new Yari instance with automatic E2E encryption.

**Parameters:**

Same as Yumi, but all messages are automatically encrypted using Gun SEA.

**Example:**

```typescript
import { Yari } from 'shogun-yumi';

const yari = new Yari('secure-room', {
  announce: ['https://relay.shogun-eco.xyz/gun'],
  heartbeat: 15000
});
```

### Properties

#### `yari.yumi: Yumi`

The underlying Yumi instance.

```typescript
// Access Yumi methods
console.log(yari.yumi.address());
```

#### `yari.sea: SEAKeyPair`

Gun SEA key pair for encryption.

```typescript
console.log(yari.sea);
// {
//   pub: "7qGBpMQ8...",
//   priv: "...",
//   epub: "9xKLmP2s...",
//   epriv: "..."
// }
```

#### `yari.address: string`

Your address (from underlying Yumi).

```typescript
console.log(yari.address); // "BN3VZp4Z8WLNFaT8..."
```

#### `yari.peers: Record<string, YariPeerInfo>`

Peers with exchanged encryption keys.

```typescript
console.log(yari.peers);
// {
//   "BN3VZp4Z...": {
//     pub: "7qGBpMQ8...",
//     epub: "9xKLmP2s..."
//   }
// }
```

#### `yari.events: EventEmitter`

Yari-specific events (separate from Yumi events).

```typescript
yari.events.on('newPeer', (peers) => {
  console.log('🔑 Keys exchanged with peers:', Object.keys(peers).length);
});
```

### Methods

#### `async SEA(pair?: SEAKeyPair): Promise<SEAKeyPair>`

Initialize or set SEA key pair.

```typescript
// Generate new keys
await yari.SEA();

// Restore existing keys
const savedKeys = JSON.parse(localStorage.getItem('sea-keys'));
await yari.SEA(savedKeys);

// Save keys for later
localStorage.setItem('sea-keys', JSON.stringify(yari.sea));
```

#### `async send(message: any): Promise<void>`

Broadcast encrypted message to all peers.

```typescript
await yari.send({
  type: 'secure-chat',
  text: 'This is encrypted!',
  timestamp: Date.now()
});
```

#### `async send(address: string, message: any): Promise<void>`

Send direct encrypted message to specific peer.

```typescript
await yari.send(peerAddress, {
  type: 'private',
  data: 'Secret for you only'
});
```

#### Inherited from Yumi

All Yumi methods are available via binding:

```typescript
yari.on('ready', callback);
yari.register(name, fn, docstring);
yari.rpc(address, call, args, callback);
yari.heartbeat(interval);
yari.destroy(callback);
```

### Events

#### All Yumi Events

Yari inherits all Yumi events (`ready`, `seen`, `left`, `connections`, etc.).

#### `decrypted` → `(address: string, pubkeys: YariPeerInfo, message: any, messageId: string)`

Emitted when an encrypted message is successfully decrypted.

```typescript
yari.on('decrypted', (address, pubkeys, message, msgId) => {
  console.log('🔓 Decrypted from:', address);
  console.log('   Public key:', pubkeys.pub);
  console.log('   Message:', message);
  console.log('   Message ID:', msgId);
});
```

**Note**: Use `decrypted` instead of `message` for encrypted messages!

#### Yari-Specific Events (via `yari.events`)

##### `newPeer` → `(peers: Record<string, YariPeerInfo>)`

Emitted when keys are exchanged with a new peer.

```typescript
yari.events.on('newPeer', (peers) => {
  console.log('🔑 Total encrypted peers:', Object.keys(peers).length);
  
  // Now safe to send encrypted messages
  yari.send({ type: 'hello', encrypted: true });
});
```

---

## Kunai API

### Constructor

```typescript
new Kunai(identifier?: string, options?: KunaiOptions)
```

Creates a new Kunai instance for file transfers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `identifier` | `string` | No | Channel identifier |
| `options` | `KunaiOptions` | No | Configuration options |

**Options:**

```typescript
interface KunaiOptions extends YumiOptions {
  chunkSize?: number;       // Chunk size in bytes (default: 10000)
  cleanupDelay?: number;    // Cleanup delay in ms (default: 5000)
  transferTimeout?: number; // Transfer timeout in ms (default: 10000)
  encrypted?: boolean;      // Use Yari for E2E encryption
  channel?: string;         // Custom channel name
}
```

**Example:**

```typescript
import { Kunai } from 'shogun-yumi';

// Plain file transfer
const kunai = new Kunai('file-room', {
  heartbeat: 15000,
  cleanupDelay: 10000
});

// Encrypted file transfer
const kunaiSecure = new Kunai('secure-files', {
  encrypted: true,
  channel: 'team-alpha'
});
```

### Properties

#### `kunai.yumi: Yumi`

The underlying Yumi instance.

```typescript
console.log(kunai.yumi.address());
```

#### `kunai.yari: Yari | null`

The Yari instance if encryption is enabled.

```typescript
if (kunai.yari) {
  console.log('Encrypted mode enabled');
}
```

### Methods

#### `async sendFile(file: FileInfo, data: ArrayBuffer | Uint8Array): Promise<string>`

Send a file and get transfer code.

```typescript
import fs from 'fs';

// Read file
const buffer = fs.readFileSync('./document.pdf');

// Send file
const code = await kunai.sendFile(
  { name: 'document.pdf', size: buffer.length },
  buffer
);

console.log('🔑 Transfer code:', code);
// Output: "42-ninja-sakura"
```

**File Info:**

```typescript
interface FileInfo {
  name: string;   // Filename
  size: number;   // File size in bytes
  type?: string;  // MIME type (optional)
}
```

**Returns:** Transfer code (e.g., `"42-ninja-sakura"`)

#### `address(): string`

Get your address.

```typescript
console.log(kunai.address());
```

#### `checkExistingFiles(): void`

Check for files already in Gun.

```typescript
kunai.checkExistingFiles();
// Will log any found files and emit events
```

#### `destroy(callback?: () => void): void`

Clean up and disconnect.

```typescript
kunai.destroy(() => {
  console.log('Cleanup complete');
});
```

### Events

#### `ready`

Emitted when Kunai is ready.

```typescript
kunai.on('ready', () => {
  console.log('✅ Kunai ready!');
});
```

#### `connections` → `(count: number)`

Emitted when peer count changes.

```typescript
kunai.on('connections', (count) => {
  console.log('🔗 Peers:', count);
});
```

#### `file-received` → `(result: FileResult)`

Emitted when a file is successfully received.

```typescript
kunai.on('file-received', (result) => {
  console.log('📥 File:', result.filename);
  console.log('   Size:', result.size);
  console.log('   ID:', result.fileId);
  
  // Save to disk
  const buffer = Buffer.from(result.data);
  fs.writeFileSync(`./received/${result.filename}`, buffer);
});
```

**File Result:**

```typescript
interface FileResult {
  filename: string;   // File name
  size: number;       // File size in bytes
  data: ArrayBuffer;  // File data
  fileId: string;     // Transfer ID
}
```

#### `transfer-complete` → `(transferId: string)`

Emitted when file upload completes.

```typescript
kunai.on('transfer-complete', (transferId) => {
  console.log('✅ Upload complete:', transferId);
});
```

---

## Types

### YumiOptions

```typescript
interface YumiOptions {
  seed?: string;
  announce?: string[];
  timeout?: number;
  heartbeat?: number | boolean;
  gun?: any;
  keyPair?: any;
  localStorage?: boolean;
  radisk?: boolean;
  wire?: boolean;
  axe?: boolean;
  webrtc?: boolean;
  localOnly?: boolean;
  ws?: boolean;
  rtc?: {
    iceServers: Array<{ urls: string }>;
  };
}
```

### PeerInfo

```typescript
interface PeerInfo {
  pk: string;    // Public key (Base58)
  ek: string;    // Encryption key (Base58)
  last: number;  // Last seen timestamp
}
```

### SEAKeyPair

```typescript
interface SEAKeyPair {
  pub: string;    // Public key
  priv: string;   // Private key
  epub: string;   // Encryption public key
  epriv: string;  // Encryption private key
}
```

### YariPeerInfo

```typescript
interface YariPeerInfo {
  pub: string;   // Public key
  epub: string;  // Encryption public key
}
```

### APIFunction

```typescript
type APIFunction = (
  address: string,
  args: any,
  callback: (result: any) => void
) => void;
```

### RPCCallback

```typescript
type RPCCallback = (result: any) => void;
```

---

## Usage Examples

### Complete Yumi Example

```typescript
import { Yumi } from 'shogun-yumi';

const yumi = new Yumi('demo-room', {
  announce: ['https://relay.shogun-eco.xyz/gun'],
  heartbeat: 15000
});

yumi.on('ready', () => {
  console.log('Address:', yumi.address());
});

yumi.on('connections', (count) => {
  console.log('Peers:', count);
});

yumi.on('message', (address, message) => {
  console.log('From:', address);
  console.log('Message:', message);
});

// Send message every 10 seconds
setInterval(() => {
  yumi.send({
    type: 'ping',
    timestamp: Date.now()
  });
}, 10000);

// Graceful shutdown
process.on('SIGINT', () => {
  yumi.destroy(() => process.exit(0));
});
```

### Complete Yari Example

```typescript
import { Yari } from 'shogun-yumi';

const yari = new Yari('secure-room', {
  heartbeat: 15000
});

yari.on('ready', () => {
  console.log('Address:', yari.address);
});

yari.events.on('newPeer', (peers) => {
  console.log('Encrypted peers:', Object.keys(peers).length);
});

yari.on('decrypted', (address, pubkeys, message) => {
  console.log('Decrypted from:', address);
  console.log('Message:', message);
});

// Send encrypted message
setTimeout(async () => {
  await yari.send({
    type: 'secure',
    data: 'Top secret!'
  });
}, 5000);
```

### Complete Kunai Example

```typescript
import { Kunai } from 'shogun-yumi';
import fs from 'fs';

const kunai = new Kunai('file-transfer', {
  encrypted: true
});

kunai.on('ready', async () => {
  // Send file
  const buffer = fs.readFileSync('./photo.jpg');
  const code = await kunai.sendFile(
    { name: 'photo.jpg', size: buffer.length },
    buffer
  );
  console.log('Transfer code:', code);
});

kunai.on('file-received', (result) => {
  fs.writeFileSync(`./received/${result.filename}`, Buffer.from(result.data));
  console.log('File saved:', result.filename);
});
```

---

For more examples, see [EXAMPLES.md](./EXAMPLES.md).

