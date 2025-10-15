# Troubleshooting Guide 🔧

Common issues and solutions for Yumi/Yari/Kunai.

## Table of Contents

- [Connection Issues](#connection-issues)
- [File Transfer Issues](#file-transfer-issues)
- [Encryption Issues](#encryption-issues)
- [Performance Issues](#performance-issues)
- [Platform-Specific Issues](#platform-specific-issues)

---

## Connection Issues

### Problem: Peers Not Connecting

**Symptoms:**
```
✅ Yumi ready!
Address: BN3VZp4Z8WLNFaT8MG9RpU3...
🔗 Connections: 0
```

**Solutions:**

1. **Check Gun Relay Accessibility**

   ```bash
   # Test relay URLs
   curl http://peer.wallie.io/gun
   curl https://relay.shogun-eco.xyz/gun
   ```

   If relays are down, use different ones:
   ```typescript
   const yumi = new Yumi('room', {
     announce: [
       'https://gun.defucc.me/gun',
       'https://a.talkflow.team/gun'
     ]
   });
   ```

2. **Use Local-Only Mode**

   If peers are on same LAN:
   ```bash
   node client/kunai.js --local
   ```
   
   Or programmatically:
   ```typescript
   const yumi = new Yumi('room', {
     localOnly: true,
     axe: true  // Enable LAN discovery
   });
   ```

3. **Verify Same Identifier**

   Both peers must use the same room name:
   ```typescript
   // Peer A
   const yumi = new Yumi('my-room'); // ✅
   
   // Peer B
   const yumi = new Yumi('my-room'); // ✅
   
   // This won't work:
   const yumi = new Yumi('different-room'); // ❌
   ```

4. **Wait Longer**

   Internet relays can take 10-30 seconds to sync:
   ```typescript
   setTimeout(() => {
     if (yumi.connections() === 0) {
       console.log('Still no peers after 30s, check configuration');
     }
   }, 30000);
   ```

5. **Check Firewall**

   Ensure ports are open:
   - WebSocket: Port 443 (HTTPS)
   - Gun relay: Usually 8765 or custom port
   - AXE multicast: UDP (for LAN)

### Problem: Peers Connect Then Disconnect

**Symptoms:**
```
🔗 Connections: 1
👋 Peer left: BN3VZp4Z...
⏱️ Peer timeout: BN3VZp4Z...
```

**Solutions:**

1. **Enable Heartbeat**

   ```typescript
   const yumi = new Yumi('room', {
     heartbeat: 10000  // Every 10 seconds
   });
   ```

2. **Increase Timeout**

   ```typescript
   const yumi = new Yumi('room', {
     timeout: 60000,  // 1 minute (default: 5 minutes)
     heartbeat: 15000
   });
   ```

3. **Check Network Stability**

   Monitor connection:
   ```typescript
   yumi.on('timeout', (address) => {
     console.error('Peer timed out:', address);
     console.log('This might indicate network issues');
   });
   ```

### Problem: "No Such API Call" Error

**Symptoms:**
```
📞 RPC response: { error: "No such API call." }
```

**Solutions:**

1. **Register RPC Before Calling**

   ```typescript
   // Peer A - Register first
   yumi.register('my-function', (address, args, callback) => {
     callback({ result: 'success' });
   });
   
   // Peer B - Then call
   yumi.on('seen', (address) => {
     setTimeout(() => {
       yumi.rpc(address, 'my-function', {}, (response) => {
         console.log(response);
       });
     }, 1000); // Wait a bit for registration
   });
   ```

2. **Check Function Name**

   Function names are case-sensitive:
   ```typescript
   yumi.register('ping', fn);  // ✅
   yumi.rpc(peer, 'ping', {}, cb);  // ✅
   
   yumi.rpc(peer, 'Ping', {}, cb);  // ❌ Wrong case
   ```

---

## File Transfer Issues

### Problem: Missing Chunks

**Symptoms:**
```
📥 File detected: document.pdf (105 chunks)
📦 Progress: 90% (95/105 chunks)
❌ Missing 10 chunks for document.pdf after 5 sweeps
```

**Solutions:**

1. **Increase Chunk Delay**

   Edit `kunai.ts`:
   ```typescript
   const batchDelay = 10; // Increase from 5ms to 10ms
   ```

2. **Reduce File Size**

   Split large files:
   ```bash
   # Split file into 10MB chunks
   split -b 10M largefile.pdf chunk_
   
   # Send each chunk separately
   node client/kunai.js
   🥷 > send chunk_aa
   🥷 > send chunk_ab
   ```

3. **Improve Network Connection**

   - Use wired connection instead of WiFi
   - Reduce network congestion
   - Try local-only mode if on same LAN

4. **Increase Timeout**

   ```typescript
   const kunai = new Kunai('room', {
     transferTimeout: 30000  // 30 seconds instead of 10
   });
   ```

5. **Check GunDB Storage**

   If using RAD storage:
   ```typescript
   const kunai = new Kunai('room', {
     radisk: true  // Enable for persistence
   });
   ```

### Problem: "No File Data Received"

**Symptoms:**
```
❌ Error saving file: No file data received
```

**Solutions:**

1. **Verify File Read**

   ```javascript
   const buffer = fs.readFileSync(filepath);
   if (!buffer || buffer.length === 0) {
     console.error('File is empty or not found');
     return;
   }
   ```

2. **Check File Format**

   Ensure proper Buffer/ArrayBuffer:
   ```javascript
   // Node.js ✅
   const buffer = fs.readFileSync('./file.pdf');
   await kunai.sendFile({ name: 'file.pdf', size: buffer.length }, buffer);
   
   // Browser ✅
   const arrayBuffer = await file.arrayBuffer();
   await kunai.sendFile({ name: file.name, size: file.size }, arrayBuffer);
   ```

### Problem: Files Too Large

**Symptoms:**
```
📤 Sending file via GunDB: hugefile.mp4 (50000 chunks)
[System becomes unresponsive]
```

**Solutions:**

1. **Use Smaller Chunk Size**

   ```typescript
   const kunai = new Kunai('room', {
     chunkSize: 5000  // 5KB instead of 10KB
   });
   ```

2. **Limit File Size**

   ```javascript
   const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
   
   if (stats.size > MAX_FILE_SIZE) {
     console.log('❌ File too large. Max 50MB.');
     return;
   }
   ```

3. **Consider Alternative Solutions**

   For very large files, use:
   - IPFS integration
   - WebTorrent
   - Direct WebRTC data channels

---

## Encryption Issues

### Problem: "No Peers Available for Encryption"

**Symptoms:**
```
⚠️ No peers available for encryption, storing message in GunDB for later pickup
```

**Solutions:**

1. **Wait for Key Exchange**

   ```typescript
   yari.events.on('newPeer', (peers) => {
     console.log('✅ Keys exchanged, ready to send');
     yari.send({ type: 'hello' });
   });
   ```

2. **Check Peer Count**

   ```typescript
   yari.on('connections', (count) => {
     if (count === 0) {
       console.log('Waiting for peers...');
     } else {
       console.log(`Connected to ${count} peer(s)`);
     }
   });
   ```

3. **Manual Key Exchange**

   If automatic exchange fails:
   ```typescript
   yari.on('seen', async (address) => {
     await yari.SEA(); // Ensure keys are ready
     
     yari.rpc(address, 'peer', {
       pub: yari.sea.pub,
       epub: yari.sea.epub
     }, (response) => {
       console.log('Manual key exchange:', response);
     });
   });
   ```

### Problem: "Decryption Error"

**Symptoms:**
```
❌ Decryption error for peer BN3VZp4Z...: Invalid secret
```

**Solutions:**

1. **Ensure Key Exchange Completed**

   ```typescript
   yari.events.on('newPeer', (peers) => {
     const peerAddress = Object.keys(peers)[0];
     if (peers[peerAddress].pub && peers[peerAddress].epub) {
       console.log('✅ Keys ready');
     }
   });
   ```

2. **Verify SEA Initialization**

   ```typescript
   yari.on('ready', async () => {
     if (!yari.sea) {
       console.log('⚠️ SEA not initialized, initializing...');
       await yari.SEA();
     }
   });
   ```

3. **Check Gun SEA Version**

   Ensure Shogun Core is up to date:
   ```bash
   npm update shogun-core
   ```

### Problem: Messages Not Encrypted

**Symptoms:**
```
📨 Message from: BN3VZp4Z...
   Content: { text: "This should be encrypted!" }
```

**Solutions:**

1. **Use Yari, Not Yumi**

   ```typescript
   // Wrong ❌
   const yumi = new Yumi('room');
   yumi.send({ secret: 'data' }); // Not encrypted!
   
   // Correct ✅
   const yari = new Yari('room');
   await yari.send({ secret: 'data' }); // Encrypted!
   ```

2. **Or Use Kunai with Encryption**

   ```typescript
   const kunai = new Kunai('room', {
     encrypted: true  // ← Important!
   });
   ```

---

## Performance Issues

### Problem: High Memory Usage

**Symptoms:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions:**

1. **Enable Memory Cleanup (Yari)**

   Already enabled by default, but verify:
   ```typescript
   // In yari.ts - runs every 5 minutes
   this.cleanupInterval = setInterval(() => {
     this.cleanupProcessedMessages();
   }, 5 * 60 * 1000);
   ```

2. **Limit Message History**

   ```typescript
   // Clear old messages
   setInterval(() => {
     if (Object.keys(yumi.seen).length > 1000) {
       yumi.seen = {};
     }
   }, 10 * 60 * 1000); // Every 10 minutes
   ```

3. **Disable RAD Storage**

   ```typescript
   const yumi = new Yumi('room', {
     radisk: false  // Don't persist to disk
   });
   ```

4. **Increase Node Memory**

   ```bash
   node --max-old-space-size=4096 client/kunai.js
   ```

### Problem: Slow File Transfers

**Symptoms:**
```
📤 Upload progress: 10% (1000/10000 chunks)
[Takes 5+ minutes for small file]
```

**Solutions:**

1. **Decrease Chunk Delay**

   ```typescript
   const batchDelay = 2; // Reduce from 5ms to 2ms
   ```

2. **Use Local-Only Mode**

   ```bash
   node client/kunai.js --local
   ```
   
   Local transfers are much faster.

3. **Check Gun Relay Performance**

   Use faster relays or run your own:
   ```bash
   node relay/relay.js 8765
   ```

4. **Increase Chunk Size**

   ```typescript
   const kunai = new Kunai('room', {
     chunkSize: 20000  // 20KB instead of 10KB
   });
   ```

### Problem: CPU Usage High

**Symptoms:**
```
[CPU usage at 100%]
```

**Solutions:**

1. **Reduce Heartbeat Frequency**

   ```typescript
   const yumi = new Yumi('room', {
     heartbeat: 30000  // Every 30s instead of 10s
   });
   ```

2. **Limit Active Transfers**

   Only transfer one file at a time.

3. **Disable Unnecessary Features**

   ```typescript
   const yumi = new Yumi('room', {
     webrtc: false,
     wire: false,
     axe: false
   });
   ```

---

## Platform-Specific Issues

### Windows Issues

#### Problem: "Error: Cannot find module 'ripemd160'"

**Solution:**

```bash
npm install ripemd160
```

Or code will fallback to NaCl hash automatically.

#### Problem: File Paths with Backslashes

**Solution:**

```javascript
import path from 'path';

// Wrong ❌
const filepath = 'C:\\Users\\Me\\file.pdf';

// Correct ✅
const filepath = path.join('C:', 'Users', 'Me', 'file.pdf');
```

### Linux/macOS Issues

#### Problem: Permission Denied

**Solution:**

```bash
# Make CLI executable
chmod +x client/kunai.js

# Or run with node
node client/kunai.js
```

#### Problem: Port Already in Use (Relay)

**Solution:**

```bash
# Find process using port 8765
lsof -i :8765

# Kill it
kill -9 <PID>

# Or use different port
node relay/relay.js 9000
```

### Browser Issues

#### Problem: "Gun is not defined"

**Solution:**

Ensure scripts loaded in correct order:
```html
<!-- 1. Gun -->
<script src="https://cdn.jsdelivr.net/npm/shogun-core@latest/dist/shogun-core.umd.js"></script>

<!-- 2. TweetNaCl -->
<script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl-fast.min.js"></script>

<!-- 3. bs58 -->
<script src="https://cdn.jsdelivr.net/npm/bs58@4.0.1/index.js"></script>

<!-- 4. Yumi/Yari -->
<script src="dist/yumi.umd.js"></script>
```

#### Problem: CORS Errors

**Solution:**

1. Use HTTPS relays
2. Or run local relay with CORS:
   ```javascript
   // In relay/relay.js
   app.use((req, res, next) => {
     res.header('Access-Control-Allow-Origin', '*');
     next();
   });
   ```

---

## Debug Mode

Enable debug logging to see what's happening:

**Node.js:**
```bash
DEBUG=yumi node client/yumi.js
DEBUG=yari node client/yari.js
DEBUG=* node client/kunai.js  # All debug output
```

**Browser:**
```javascript
localStorage.debug = "yumi,yari";
location.reload();
```

**Example Debug Output:**
```
yumi raw message yumi 234 a3f5e9b2...
yumi unpacked message { t: 1234567890, i: 'yumi', pk: '7qGBpMQ8...', ... }
yumi packet { y: 'm', v: '{"type":"hello"}' } checksig: true checkid: true checktime: true
yumi message yumi { y: 'm', v: '{"type":"hello"}', ... }
```

---

## Still Having Issues?

1. **Check GitHub Issues**: [github.com/yourrepo/issues](https://github.com/yourrepo/issues)
2. **Enable Debug Mode**: See section above
3. **Provide Details**:
   - OS and Node.js version
   - Full error output
   - Minimal reproduction steps
   - Configuration used

**Example Bug Report:**
```markdown
**Environment:**
- OS: Windows 11
- Node: v18.17.0
- Package version: 1.0.0

**Command:**
node client/kunai.js --encrypted

**Error:**
❌ Missing 10 chunks for file.pdf after 5 sweeps

**Steps:**
1. Start two instances
2. send large.pdf (50MB)
3. Chunks missing on receive
```

---

For more help, see [CONTRIBUTING.md](./CONTRIBUTING.md) or open a discussion.

