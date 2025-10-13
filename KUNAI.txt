# Kunai (苦無) 🥷 - Ephemeral File Transfer

**Fast, temporary P2P file transfers without persistence.**

Kunai uses Yumi for signaling but streams files **directly without storing them in GunDB**. Like a ninja's throwing knife - quick, precise, and leaves no trace.

---

## 🎯 **Key Differences from Magic Wormhole**

| Feature | Kunai (苦無) | Magic Wormhole |
|---------|--------------|----------------|
| Language | JavaScript/TypeScript | Python |
| Platform | Browser + Node.js | CLI only |
| Transport | GunDB signaling + direct stream | Mailbox + Transit Relay |
| Persistence | ❌ Auto-cleanup | ❌ Ephemeral |
| Encryption | ✅ Optional E2E (via Yari) | ✅ Always (PAKE) |
| Custom Channels | ✅ Yes | ❌ No |
| Setup | Zero (uses public relays) | Requires Python |
| Use Case | Web apps + CLI | CLI file transfer |

---

## 🚀 **Quick Start**

### **Browser (Instant)**

1. Open `apps/kunai.html` in your browser
2. Select a file
3. Click "Send File"
4. Share the code (e.g., `42-ninja-sakura`)
5. Receiver opens `apps/kunai.html` in another browser
6. Enters code and receives file automatically

### **Node.js CLI**

**Plain Transfer (default):**
```bash
# Terminal 1 (Sender)
node client/kunai.js

🥷 > send document.pdf
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 Sending File
File: document.pdf
Size: 2.45 MB

🔑 Transfer code: 67-samurai-tokyo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Terminal 2 (Receiver)
node client/kunai.js

🥷 > receive
✅ Listening for transfers...
📥 Receiving file...
✅ File received successfully!
📁 Saved to: ./received/document.pdf
```

**Encrypted Transfer (E2E with Yari):**
```bash
# Terminal 1 (Sender)
node client/kunai.js --encrypted

🔐🥷 > send secret.pdf
🔐 Kunai initialized with encryption (Yari)
📤 Sending encrypted file...

# Terminal 2 (Receiver)
node client/kunai.js --encrypted

🔐🥷 > receive
🔐 Keys exchanged with peer
📥 Receiving encrypted file...
✅ File decrypted and saved!
```

**Custom Channel (private room):**
```bash
# Terminal 1
node client/kunai.js --channel=team-alpha

# Terminal 2 (same channel!)
node client/kunai.js --channel=team-alpha
```

**Encrypted + Custom Channel:**
```bash
# Maximum privacy
node client/kunai.js --encrypted --channel=secret-team-room
```

---

## 📖 **API Usage**

### **TypeScript/JavaScript**

**Plain Transfer (Yumi - no encryption):**
```typescript
import { Kunai } from 'shogun-yumi';

const kunai = new Kunai('my-transfer-session', {
  announce: ["https://relay.shogun-eco.xyz/gun"],
  heartbeat: 15000,
  chunkSize: 64 * 1024,      // 64KB chunks
  cleanupDelay: 5000,         // Cleanup after 5s
  transferTimeout: 300000,    // Timeout after 5 min
  encrypted: false            // Default: plain (Yumi)
});
```

**Encrypted Transfer (Yari - E2E encryption):**
```typescript
import { Kunai } from 'shogun-yumi';

const kunaiEncrypted = new Kunai('secure-transfers', {
  announce: ["https://relay.shogun-eco.xyz/gun"],
  encrypted: true,            // Enable Yari encryption
  channel: 'my-private-room'  // Custom channel
});

// ============ SENDER ============

kunai.on('ready', () => {
  // Browser: from file input
  const file = document.getElementById('fileInput').files[0];
  const code = kunai.sendOffer(file);
  
  console.log('Share this code:', code);
  // Output: 42-ninja-sakura
});

kunai.on('transfer-started', (transferId) => {
  console.log('Transfer started:', transferId);
});

kunai.on('send-progress', (progress) => {
  console.log(`Progress: ${progress.percent}%`);
});

kunai.on('transfer-complete', (transferId) => {
  console.log('Transfer complete!', transferId);
});

// ============ RECEIVER ============

kunai.on('file-offer', (offer) => {
  console.log(`Incoming: ${offer.filename} (${offer.size} bytes)`);
  console.log(`From: ${offer.from}`);
  console.log(`Code: ${offer.transferId}`);
  
  // Auto-accepted by default
});

kunai.on('receive-progress', (progress) => {
  console.log(`Receiving: ${progress.percent}%`);
});

kunai.on('file-received', (result) => {
  console.log('File received:', result.filename);
  
  // Browser: download
  if (result.blob) {
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
  }
  
  // Node.js: save
  if (result.buffer) {
    fs.writeFileSync(result.filename, result.buffer);
  }
});
```

---

## 🏗️ **Architecture**

```
┌─────────────┐                           ┌─────────────┐
│   Sender    │                           │  Receiver   │
└─────────────┘                           └─────────────┘
       │                                         │
       │ 1. file-offer (metadata only)           │
       ├────────── GunDB Relay ──────────────────>
       │    {transferId, filename, size}         │
       │                                         │
       │ 2. file-accept                          │
       <─────────── GunDB Relay ─────────────────┤
       │                                         │
       │ 3. Stream chunks (ephemeral)            │
       ├────────── Direct/Relay ─────────────────>
       │    {chunk1, chunk2, ..., chunkN}        │
       │    ↓ auto-cleanup after 5s              │
       │                                         │
       │ 4. transfer-complete                    │
       ├────────── GunDB Relay ──────────────────>
       │                                         │
```

### **No Persistence Strategy**

1. **Metadata** (file offer) → Small, OK to use GunDB
2. **Chunks** → Sent via Yumi but **auto-deleted after 5 seconds**
3. **Cleanup** → Scheduled `gun.get(chunkId).put(null)` removes data
4. **Result** → File never persists in GunDB graph

---

## ⚡ **Performance**

### **Chunk Size Tuning**

```javascript
// Small files (< 1MB): larger chunks
const kunai = new Kunai('transfer', { chunkSize: 256 * 1024 });

// Large files (> 100MB): smaller chunks for progress updates
const kunai = new Kunai('transfer', { chunkSize: 32 * 1024 });
```

### **Speed Comparison**

| File Size | Chunks (64KB) | Typical Speed | Time |
|-----------|---------------|---------------|------|
| 1 MB | 16 | ~2 MB/s | < 1s |
| 10 MB | 160 | ~1.5 MB/s | ~7s |
| 100 MB | 1600 | ~1 MB/s | ~100s |

**Note:** Speed depends on:
- Network conditions
- Gun relay performance
- Number of intermediate relays
- Chunk size configuration

---

## 🔐 **Security Considerations**

### **Plain Mode (default)**
- ✅ Transfers are **signed** (Ed25519)
- ❌ **NOT encrypted** by default
- ⚠️ Anyone on Gun relay can intercept chunks
- ✅ Auto-cleanup prevents long-term storage
- ✅ Good for: public files, non-sensitive data

### **Encrypted Mode (--encrypted)**

Enable Yari-based E2E encryption:

```typescript
// Encrypted file transfers
const kunai = new Kunai('secure-transfer', {
  encrypted: true  // ← Enables Yari E2E encryption
});
```

**Security with Encryption:**
- ✅ Transfers are **signed AND encrypted** (Ed25519 + Gun SEA)
- ✅ End-to-end encryption via Yari
- ✅ Automatic key exchange between peers
- ✅ Only intended recipient can decrypt chunks
- ✅ Good for: sensitive documents, private data

**CLI Usage:**
```bash
# Encrypted send
node client/kunai.js --encrypted

🔐🥷 > send confidential.pdf

# Encrypted receive (both must use --encrypted!)
node client/kunai.js --encrypted

🔐🥷 > receive
```

**Note:** Both sender and receiver **MUST use the same encryption setting** (both plain OR both encrypted).

---

## 🛠️ **Advanced Usage**

### **Custom Channels (Private Rooms)**

Use custom channels to create private transfer rooms:

```typescript
// Team A uses their own channel
const kunaiTeamA = new Kunai('team-a-transfers', {
  channel: 'team-alpha-private'
});

// Team B uses a different channel (won't see Team A's transfers)
const kunaiTeamB = new Kunai('team-b-transfers', {
  channel: 'team-bravo-private'
});

// CLI usage
// node client/kunai.js --channel=team-alpha-private
// node client/kunai.js --channel=team-bravo-private
```

**Use Cases:**
- 🏢 **Team collaboration** - Each team has their own transfer channel
- 🔒 **Privacy** - Others can't see your transfers without channel name
- 🎯 **Organization** - Separate channels for different projects
- 🌐 **Multi-tenancy** - Multiple isolated transfer rooms

### **Custom Transfer Lifecycle**

```javascript
const kunai = new Kunai('advanced');

// Hook into every stage
kunai.on('offer-sent', (offer) => {
  console.log('Offer sent:', offer);
});

kunai.on('transfer-accepted', (transferId) => {
  console.log('Peer accepted:', transferId);
});

kunai.on('send-progress', ({ transferId, sent, total, percent }) => {
  updateProgressBar(percent);
});

kunai.on('receive-progress', ({ transferId, received, total, percent }) => {
  updateProgressBar(percent);
});

kunai.on('transfer-complete', (transferId) => {
  showNotification('Transfer complete!');
});

kunai.on('transfer-timeout', (transferId) => {
  console.error('Transfer timed out:', transferId);
});
```

### **Manual Accept/Reject**

```javascript
kunai.on('file-offer', (offer) => {
  // Show confirmation dialog
  const accept = confirm(
    `Accept ${offer.filename} (${formatSize(offer.size)}) ` +
    `from ${offer.from}?`
  );
  
  if (accept) {
    kunai.acceptTransfer(offer.transferId);
  } else {
    // Just ignore - transfer will timeout
    console.log('Transfer rejected');
  }
});
```

### **Progress Tracking**

```javascript
// React example
function FileTransfer() {
  const [progress, setProgress] = useState(0);
  
  kunai.on('send-progress', (p) => {
    setProgress(parseFloat(p.percent));
  });

  return (
    <ProgressBar value={progress} max={100} />
  );
}
```

---

## 🆚 **Kunai vs Magic Wormhole**

### **Similarities**
- ✅ Ephemeral transfers (no persistence)
- ✅ Human-readable codes
- ✅ Progress tracking
- ✅ Automatic cleanup

### **Advantages of Kunai**
- ✅ **Browser support** (no Python needed)
- ✅ **JavaScript ecosystem** (npm, React, Vue, etc.)
- ✅ **Zero setup** (uses public Gun relays)
- ✅ **TypeScript types** included
- ✅ **Same stack** as Yumi/Yari (unified ecosystem)

### **Advantages of Magic Wormhole**
- ✅ **PAKE encryption** (password-based key exchange)
- ✅ **Stronger security model** (1/65536 attack chance)
- ✅ **CLI-first design** (perfect for terminals)
- ✅ **Mature protocol** (battle-tested since 2016)

### **When to Use Which**

**Use Kunai when:**
- Building web applications
- Need browser support
- Want unified stack with Yumi/Yari
- Don't need PAKE security model
- Prefer JavaScript/TypeScript

**Use Magic Wormhole when:**
- CLI-only use case
- Need maximum security (PAKE)
- Python ecosystem
- Terminal automation
- Cross-platform Python apps

---

## 🔮 **Roadmap**

### **v1.1 - Encrypted Kunai**
- [ ] Integration with Yari for E2E encryption
- [ ] PAKE-style security model
- [ ] Encrypted chunk streaming

### **v1.2 - WebRTC Data Channel**
- [ ] Direct P2P via WebRTC (no relay)
- [ ] Better speeds for large files
- [ ] Fallback to Gun relay

### **v1.3 - Advanced Features**
- [ ] Resume interrupted transfers
- [ ] Multi-file transfers
- [ ] Directory transfers (zip on-the-fly)
- [ ] Transfer history (ephemeral)

---

## 📝 **Example Scenarios**

### **1. Share Screenshot**

```javascript
// Capture screenshot
const canvas = document.getElementById('myCanvas');
canvas.toBlob((blob) => {
  const file = new File([blob], 'screenshot.png');
  const code = kunai.sendOffer(file);
  
  alert(`Screenshot ready! Code: ${code}`);
});
```

### **2. Send Log File**

```javascript
// Node.js: send server log
const kunai = new Kunai('logs');

kunai.on('ready', () => {
  kunai.sendFile('/var/log/server.log');
});
```

### **3. Receive in Browser, Send from Node**

```javascript
// Node.js sender
const kunai = new Kunai('cross-platform');
const code = await kunai.sendFile('./report.pdf');
console.log('Code:', code);

// Browser receiver (different machine)
// Open apps/kunai.html
// Enter code: receives and downloads
```

---

## 🏗️ **Building Custom Kunai Apps**

### **React Component**

```typescript
import { Kunai } from 'shogun-yumi';
import { useState, useEffect } from 'react';

function FileTransferApp() {
  const [kunai] = useState(() => new Kunai('my-app'));
  const [code, setCode] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    kunai.on('offer-sent', (offer) => {
      setCode(offer.transferId);
    });

    kunai.on('send-progress', (p) => {
      setProgress(parseFloat(p.percent));
    });

    kunai.on('file-received', (file) => {
      // Download file
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
    });

    return () => kunai.destroy();
  }, []);

  const handleSend = (file: File) => {
    kunai.sendOffer(file);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleSend(e.target.files[0])} />
      {code && <div>Code: {code}</div>}
      {progress > 0 && <progress value={progress} max={100} />}
    </div>
  );
}
```

### **Vue Component**

```vue
<template>
  <div class="kunai-transfer">
    <input type="file" @change="sendFile" />
    <div v-if="transferCode">Code: {{ transferCode }}</div>
    <progress v-if="progress > 0" :value="progress" max="100" />
  </div>
</template>

<script setup>
import { Kunai } from 'shogun-yumi';
import { ref, onMounted, onUnmounted } from 'vue';

const kunai = new Kunai('vue-app');
const transferCode = ref('');
const progress = ref(0);

onMounted(() => {
  kunai.on('offer-sent', (offer) => {
    transferCode.value = offer.transferId;
  });

  kunai.on('send-progress', (p) => {
    progress.value = parseFloat(p.percent);
  });
});

onUnmounted(() => {
  kunai.destroy();
});

const sendFile = (event) => {
  const file = event.target.files[0];
  kunai.sendOffer(file);
};
</script>
```

---

## 🧹 **How Auto-Cleanup Works**

```typescript
// When chunk is sent:
kunai.sendChunk(transferId, index, data);

// Scheduled cleanup (5 seconds later):
setTimeout(() => {
  gun.get('kunai-chunks')
     .get(`${transferId}-chunk-${index}`)
     .put(null);  // ← Removes from GunDB graph
}, 5000);
```

**Result:** File chunks exist in GunDB for only ~5 seconds, then are garbage collected.

---

## 🎨 **Styling & UI**

Kunai's browser demo (`apps/kunai.html`) uses a **ninja-themed dark UI**:

- 🎨 **Colors**: Red/black ninja aesthetic
- 🥷 **Icon**: Throwing knife (Kunai)
- 📊 **Progress bars**: Smooth animations
- 🔔 **Notifications**: Transfer status updates

Feel free to customize the styles for your app!

---

## 🐛 **Troubleshooting**

### **Transfer stuck at 0%**

```bash
# Check Gun relay connectivity
DEBUG=yumi node client/kunai.js

# Try different relay
const kunai = new Kunai('transfer', {
  announce: ['http://peer.wallie.io/gun']
});
```

### **File corrupted on receive**

```javascript
// Verify chunk integrity
kunai.on('file-received', (result) => {
  console.log('Received size:', result.blob.size);
  console.log('Expected size:', result.size);
  
  if (result.blob.size !== result.size) {
    console.error('Chunk mismatch! Transfer corrupted.');
  }
});
```

### **Out of memory (large files)**

```javascript
// Use smaller chunks
const kunai = new Kunai('transfer', {
  chunkSize: 16 * 1024  // 16KB instead of 64KB
});
```

---

## 📚 **Resources**

- 🏹 [Yumi Documentation](./README.md#yumi-弓-usage)
- ⚔️ [Yari Documentation](./README.md#yari-槍-usage-encrypted)
- 🔧 [Source Code](./src/kunai.ts)
- 🎮 [Browser Demo](./apps/kunai.html)
- 🖥️ [CLI Example](./client/kunai.js)

---

## 🤝 **Contributing**

Ideas for improving Kunai:

- [ ] WebRTC Data Channel support
- [ ] PAKE encryption (wormhole-style)
- [ ] Resume interrupted transfers
- [ ] Compression (gzip/brotli)
- [ ] Multi-file/directory support
- [ ] Transfer history UI
- [ ] Mobile app integration

---

**Kunai (苦無)** - Fast as a ninja's blade, ephemeral as the wind. 🥷⚡

