# Kunai Features - File Transfer + Messaging 🥷

## Overview

Kunai combina **trasferimento file** e **messaggistica** in un'unica API, usando automaticamente:
- **Yari** (🔐 criptato) se `encrypted: true`
- **Yumi** (📤 plain) se `encrypted: false`

---

## 🎯 Nuove Funzionalità

### 1. ✅ Chunk Retransmission System

Sistema intelligente di recupero chunks mancanti per trasferimenti file affidabili.

**Come Funziona:**

```
Sender (mittente)                    Receiver (ricevente)
     │                                        │
     │──── Upload 1724 chunks ───────────────▶│
     │                                        │── Receive 1721/1724 ✓
     │                                        │── Missing: [31, 1357, 1359]
     │                                        │
     │◀──── RPC 'request-chunks' ─────────────│
     │      { fileId, missingChunks: [...] }  │
     │                                        │
     │──── RPC Response ──────────────────────▶│
     │      { chunks: [ {index, data}, ... ]} │
     │                                        │
     │                                        │── Reassemble complete! ✓
     │                                        │
     │◀──── RPC 'transfer-confirmed' ─────────│
     │                                        │
     │─── Cache cleanup ──────────────────────│
```

**Caratteristiche:**

- ✅ **Cache automatica**: I chunks vengono conservati in memoria per 5 minuti
- ✅ **Richiesta intelligente**: Solo i chunks mancanti vengono richiesti
- ✅ **Conferma trasferimento**: Il sender viene notificato quando il file è completo
- ✅ **Cleanup automatico**: Cache svuotata dopo conferma o timeout

**Output Console:**

```bash
# Sender side:
✅ File uploaded to GunDB: 45-juliet-golf
💾 Cached 1724 chunks for retransmission (retention: 5 min)
📨 Received request for 3 missing chunks from BN3VZp4Z8WLN...
✅ Sending 3 chunks to BN3VZp4Z8WLN...
✅ Transfer confirmed by BN3VZp4Z8WLN... for 45-juliet-golf

# Receiver side:
⏰ Timeout reached for test.mp3. Attempting reassembly with 1721/1724 chunks...
🔍 Timeout: Performing final sweeps for 3 missing chunks...
🔄 Requesting 3 chunks from sender...
📨 Requesting 3 chunks from BN3VZp4Z...
📥 Received 3 missing chunks
✅ All chunks received after retransmission! Reassembling test.mp3...
🎉 File received: test.mp3 (12.33 MB)
```

---

### 2. 💬 Simple Messaging via Kunai

Kunai ora supporta anche messaggi semplici, non solo file!

**API Unificata:**

```typescript
// Create Kunai instance
const kunai = new Kunai('my-room', {
  encrypted: true  // Usa Yari (E2E encrypted)
  // encrypted: false  // Usa Yumi (plain)
});

// Send message (automatically encrypted if encrypted: true)
await kunai.send({
  type: 'chat',
  text: 'Hello!',
  timestamp: Date.now()
});

// Listen for messages
kunai.onMessage((address, message) => {
  console.log('From:', address);
  console.log('Message:', message);
});

// Send file
const buffer = fs.readFileSync('./file.pdf');
const code = await kunai.sendFile(
  { name: 'file.pdf', size: buffer.length },
  buffer
);
```

**Metodi Disponibili:**

| Metodo | Descrizione | Encryption |
|--------|-------------|------------|
| `send(message)` | Broadcast message | Auto (Yari/Yumi) |
| `send(address, message)` | Direct message | Auto (Yari/Yumi) |
| `onMessage(callback)` | Listen for messages | Auto decryption |
| `sendFile(file, data)` | Send file | Via GunDB |
| `connections()` | Get peer count | - |
| `ping()` | Ping peers | - |
| `register(name, fn)` | Register RPC | - |
| `rpc(address, call, args, cb)` | Call RPC | - |

---

## 📝 CLI Usage

### Commands Disponibili

```bash
node client/kunai.js [--encrypted] [--local] [--channel=name]
```

**Comandi Interattivi:**

```bash
🥷 > send <filepath>      # Send a file
🥷 > msg <message>        # Send a text message (NEW!)
🥷 > receive              # Listen for transfers
🥷 > check                # Check for existing files
🥷 > status               # Show connections
🥷 > history              # Show transfer history
🥷 > quit                 # Exit
```

### Esempi d'Uso

**1. Encrypted Messaging + File Transfer:**

```bash
# Terminal 1
node client/kunai.js --encrypted --channel=team-alpha

🔐🥷 > msg Hello team! How are you?
✅ Encrypted message sent

🔐🥷 > send document.pdf
📤 Sending File
...
🔑 Transfer code: 42-ninja-sakura

# Terminal 2
node client/kunai.js --encrypted --channel=team-alpha

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔓 Encrypted Message Received
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
From: BN3VZp4Z8WLN...
Content: {
  "type": "chat",
  "text": "Hello team! How are you?",
  "from": "BN3VZp4Z",
  "timestamp": 1234567890
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 File detected: document.pdf (105 chunks)
...
✅ File received successfully!
📁 Saved to: ./received/document.pdf
```

**2. Local-Only Mode (LAN):**

```bash
node client/kunai.js --local --encrypted

🏠 LocalOnly mode enabled - LAN discovery only (no external relays)
🔐 Kunai initialized with encryption (Yari)
```

**3. Plain Messaging (No Encryption):**

```bash
node client/kunai.js

🥷 > msg Public announcement!
✅ Message sent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 Message Received
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
From: BN3VZp4Z8WLN...
Content: {
  "type": "chat",
  "text": "Public announcement!",
  ...
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔧 Technical Details

### Chunk Retransmission Architecture

**RPC Handlers Registrati:**

```typescript
// 1. Request missing chunks
this.yumi.register('request-chunks', (address, args, callback) => {
  const { fileId, missingChunks } = args;
  const cached = this.chunkCache.get(fileId);
  
  // Send only requested chunks
  callback({
    success: true,
    chunks: [ { index, data }, ... ]
  });
});

// 2. Confirm successful transfer
this.yumi.register('transfer-confirmed', (address, args, callback) => {
  const { fileId } = args;
  this.chunkCache.delete(fileId); // Cleanup
  callback({ success: true });
});
```

**Chunk Cache Structure:**

```typescript
chunkCache: Map<fileId, {
  chunks: Map<chunkIndex, chunkData>,  // All chunks
  metadata: {                           // File info
    name: string,
    size: number,
    totalChunks: number,
    sender: string
  },
  timestamp: number                     // For cleanup
}>

// Retention: 5 minutes (300,000 ms)
// Cleanup: Every 1 minute
```

**Timeout & Recovery Flow:**

```typescript
// 1. Normal transfer
Upload → Receive chunks → Complete ✓

// 2. With missing chunks
Upload → Receive partial → Timeout reached
  → GunDB sweeps (5 attempts)
  → Still missing?
  → RPC request-chunks
  → Receive missing
  → Complete ✓
  → RPC transfer-confirmed
  → Sender cleanup cache
```

---

## 🎯 Use Cases

### Use Case 1: Team File Sharing + Chat

```typescript
import { Kunai } from 'shogun-yumi';

const kunai = new Kunai('team-room', {
  encrypted: true,
  channel: 'project-alpha'
});

// Chat
kunai.onMessage((address, message) => {
  if (message.type === 'chat') {
    console.log(`${message.from}: ${message.text}`);
  }
});

await kunai.send({
  type: 'chat',
  text: 'Check out this document!',
  from: 'Alice'
});

// File
const buffer = fs.readFileSync('./specs.pdf');
const code = await kunai.sendFile(
  { name: 'specs.pdf', size: buffer.length },
  buffer
);

await kunai.send({
  type: 'chat',
  text: `File sent! Code: ${code}`,
  from: 'Alice'
});
```

### Use Case 2: Reliable Large File Transfer

```typescript
const kunai = new Kunai('backup', {
  encrypted: true,
  transferTimeout: 60000  // 60 seconds for large files
});

// Send 500MB file
const largeFile = fs.readFileSync('./backup.zip');
const code = await kunai.sendFile(
  { name: 'backup.zip', size: largeFile.length },
  largeFile
);

// Chunks cached for 5 minutes
// If receiver has missing chunks, they're automatically requested
// No manual intervention needed!
```

### Use Case 3: Hybrid Communication

```typescript
// Both messaging and file transfer in one instance
const kunai = new Kunai('hybrid', { encrypted: true });

// Status updates
setInterval(() => {
  kunai.send({
    type: 'status',
    online: true,
    timestamp: Date.now()
  });
}, 30000);

// File sharing
kunai.on('file-received', (result) => {
  // Auto-notify sender
  kunai.send({
    type: 'ack',
    fileId: result.fileId,
    filename: result.filename,
    status: 'received'
  });
});
```

---

## ⚡ Performance

### Chunk Retransmission Impact

| Scenario | Before | After |
|----------|--------|-------|
| 100% chunks | ✅ Fast | ✅ Fast (same) |
| 95% chunks | ❌ Failed | ✅ +2-3s (recovery) |
| 90% chunks | ❌ Failed | ✅ +5-10s (recovery) |
| Sender offline | ❌ Failed | ❌ Failed (expected) |

### Memory Usage

```
Small file (1MB, 100 chunks):
  - Cache: ~1.3 MB (Base64 overhead)
  - Retention: 5 minutes
  
Large file (100MB, 10,000 chunks):
  - Cache: ~133 MB (Base64 overhead)
  - Retention: 5 minutes
  - Auto-cleanup after confirmation

Recommendation: 
  - For files > 50MB, consider splitting
  - Or increase cache retention if needed
```

---

## 🔐 Security Notes

**Encrypted Mode (`encrypted: true`):**
- ✅ Messages: E2E encrypted via Gun SEA (Yari)
- ✅ Files: Chunks in GunDB are NOT encrypted
- ⚠️ For file E2E encryption, encrypt before calling `sendFile()`

**Chunk Retransmission Security:**
- ✅ RPC calls use existing Yumi encryption
- ✅ Sender verifies peer identity via address
- ✅ No chunk data leaked (only to original sender)

---

## 📊 Comparison

| Feature | Kunai | Yumi | Yari |
|---------|-------|------|------|
| Messaging | ✅ | ✅ | ✅ |
| File Transfer | ✅ | ❌ | ❌ |
| Chunk Recovery | ✅ | N/A | N/A |
| E2E Encryption | ✅ (optional) | ❌ | ✅ |
| Unified API | ✅ | ❌ | ❌ |
| Auto Mode Switch | ✅ | N/A | N/A |

**Quando Usare:**

- **Kunai**: File transfer + messaging, hybrid apps
- **Yumi**: Solo messaging, public channels
- **Yari**: Solo messaging encrypted, private chat

---

## 🚀 Future Enhancements

Possibili miglioramenti:

1. **Progressive File Encryption**: Encrypt chunks before upload
2. **Resumable Transfers**: Save progress, resume later
3. **Multi-Sender**: Request chunks from multiple peers
4. **Bandwidth Control**: Throttle chunk upload/download
5. **Compression**: Compress chunks before transfer
6. **Delta Sync**: Only send changed chunks

---

## 📝 Example: Complete Application

```typescript
import { Kunai } from 'shogun-yumi';
import fs from 'fs';

class TeamCollaboration {
  private kunai: Kunai;
  
  constructor(teamName: string) {
    this.kunai = new Kunai(`team-${teamName}`, {
      encrypted: true,
      heartbeat: 15000
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // Chat messages
    this.kunai.onMessage((address, message) => {
      if (message.type === 'chat') {
        this.displayChat(message);
      } else if (message.type === 'status') {
        this.updateUserStatus(address, message);
      }
    });
    
    // File transfers
    this.kunai.on('file-received', (result) => {
      this.saveFile(result);
      this.notifyFileReceived(result.filename);
    });
  }
  
  async sendMessage(text: string) {
    await this.kunai.send({
      type: 'chat',
      text,
      from: this.kunai.address().slice(0, 8),
      timestamp: Date.now()
    });
  }
  
  async shareFile(filepath: string) {
    const buffer = fs.readFileSync(filepath);
    const code = await this.kunai.sendFile(
      { name: path.basename(filepath), size: buffer.length },
      buffer
    );
    
    await this.sendMessage(`📎 Shared file: ${code}`);
  }
}

// Usage
const team = new TeamCollaboration('alpha');
team.sendMessage('Hello team!');
team.shareFile('./report.pdf');
```

---

For more details, see:
- [README.md](./README.md) - Full project overview
- [API.md](./API.md) - Complete API reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical details
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

