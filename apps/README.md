# Browser Demo Apps 🌐

Beautiful HTML demos showcasing Yumi, Yari, and Kunai in action!

## 📁 Files

| File | Description | Features |
|------|-------------|----------|
| **yumi.html** | Plain P2P Chat | 🏹 Unencrypted messaging, peer discovery |
| **yari.html** | Encrypted P2P Chat | ⚔️🔐 E2E encrypted messaging, auto key exchange |
| **kunai.html** | File Transfer + Chat | 🥷 File transfers with chunk retransmission + messaging |

## 🚀 Quick Start

### Option 1: Direct File Open

1. Build the project first:
   ```bash
   npm run build
   ```

2. Open any HTML file directly in your browser:
   - `file:///path/to/bugout/apps/yumi.html`
   - `file:///path/to/bugout/apps/yari.html`
   - `file:///path/to/bugout/apps/kunai.html`

### Option 2: Local Server (Recommended)

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server -p 8000

# Then open:
# http://localhost:8000/apps/yumi.html
# http://localhost:8000/apps/yari.html
# http://localhost:8000/apps/kunai.html
```

## 🏹 Yumi Demo (Plain P2P Chat)

**File**: `yumi.html`

**Features**:
- ✅ Plain P2P messaging (no encryption)
- ✅ Peer discovery and presence
- ✅ Real-time chat
- ✅ Event logging

**Usage**:
1. Open `yumi.html` in browser
2. Note the Room ID in the URL hash (e.g., `#yumi-demo-abc123`)
3. Share URL with others to join same room
4. Type messages and click "Send"

**Multiplayer Test**:
```bash
# Terminal 1
open http://localhost:8000/apps/yumi.html#my-test-room

# Terminal 2 (or different browser)
open http://localhost:8000/apps/yumi.html#my-test-room

# Now you have 2 peers in same room!
```

## ⚔️ Yari Demo (Encrypted P2P Chat)

**File**: `yari.html`

**Features**:
- ✅ End-to-end encryption (Gun SEA)
- ✅ Automatic key exchange
- ✅ Encrypted peer list
- ✅ Message deduplication
- ✅ Real-time encrypted chat

**Usage**:
1. Open `yari.html` in browser
2. Wait for "Keys exchanged" message
3. Type encrypted messages
4. Messages are automatically encrypted/decrypted

**Encrypted Indicators**:
- 🔐 Lock icon on messages
- Purple color scheme
- "Encrypted peers" counter
- SEA public key display

## 🥷 Kunai Demo (File Transfer)

**File**: `kunai.html`

**Features**:
- ✅ Ephemeral file transfers
- ✅ **NEW**: Chunk retransmission (automatic recovery)
- ✅ **NEW**: Simple messaging support
- ✅ Progress tracking
- ✅ Transfer codes (e.g., "42-ninja-sakura")
- ✅ Auto-download
- ✅ 5-minute chunk cache for retransmission

**Usage**:

**Sending**:
1. Open `kunai.html`
2. Click "Choose File"
3. Click "🥷 Send File"
4. Share the transfer code (e.g., "42-ninja-sakura")

**Receiving**:
1. Open `kunai.html` in another tab/browser
2. Files are auto-detected and downloaded!
3. Or enter transfer code manually

**With Chunk Retransmission**:
- If transfer is incomplete, receiver automatically requests missing chunks
- Sender keeps chunks cached for 5 minutes
- Automatic recovery without manual intervention!

**Example Flow**:
```
Sender                          Receiver
  │                                 │
  │──── Upload 1000 chunks ─────────▶│
  │                                 │── Receive 997/1000
  │                                 │── Missing: [31, 357, 859]
  │                                 │
  │◀──── Request missing chunks ────│
  │                                 │
  │──── Send 3 chunks ──────────────▶│
  │                                 │
  │                                 │── Complete! ✓
```

## 🔧 Technical Details

### Dependencies (CDN)

All demos use these external dependencies:

```html
<!-- Shogun Core (includes Gun + SEA) -->
<script src="https://cdn.jsdelivr.net/npm/shogun-core@3.3.5/dist/browser/shogun-core.js"></script>

<!-- TweetNaCl for crypto -->
<script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl-fast.min.js"></script>

<!-- bs58 (minimal inline implementation) -->
<script>/* Inline bs58 encode/decode */</script>
```

### Local Builds

Each demo uses the compiled UMD builds:

```html
<!-- Yumi demo -->
<script src="../dist/yumi.umd.js"></script>

<!-- Yari demo -->
<script src="../dist/yumi.umd.js"></script>
<script src="../dist/yari.umd.js"></script>

<!-- Kunai demo (NEW!) -->
<script src="../dist/yumi.umd.js"></script>
<script src="../dist/yari.umd.js"></script>
<script src="../dist/kunai.umd.js"></script>
```

**Note**: Run `npm run build` to update these files!

### Gun Relays

Default relays used:
- `http://peer.wallie.io/gun`
- `https://relay.shogun-eco.xyz/gun`
- `https://gun.defucc.me/gun`
- `https://a.talkflow.team/gun`

## 🎨 Customization

### Change Room Name

Edit the URL hash:
```javascript
// yumi.html or yari.html
window.location.hash = 'my-custom-room';
```

### Enable Encryption in Kunai

Edit `kunai.html`:
```javascript
const kunai = new Kunai.Kunai('kunai-demo', {
  // ... other options
  encrypted: true  // ← Enable E2E encryption
});
```

### Add Custom Relay

Edit the `announce` array:
```javascript
const yumi = new Yumi.Yumi(room, {
  announce: [
    "http://peer.wallie.io/gun",
    "https://my-custom-relay.com/gun"  // ← Add your relay
  ],
  heartbeat: 15000
});
```

## 🐛 Troubleshooting

### "bs58.decode is not a function"

**Fixed!** All apps now include the complete `bs58` implementation with both `encode` and `decode`.

### "Cannot find module 'fs'"

**Normal for browser!** This error from Shogun Core is expected and harmless in browser environments.

### "MetaMask encountered an error"

**Harmless warning!** If you have MetaMask installed, you'll see this. It doesn't affect the apps.

### No peers connecting

1. **Check if both tabs use same room**:
   - Yumi: Same URL hash
   - Yari: Same URL hash
   - Kunai: Both should be on same page

2. **Wait 10-30 seconds**:
   - Gun relay sync can be slow

3. **Check console for errors**:
   - F12 → Console tab

4. **Try local-only mode**:
   ```javascript
   const yumi = new Yumi.Yumi(room, {
     localOnly: true,
     axe: true  // LAN discovery
   });
   ```

### File transfer incomplete

**Now fixed with chunk retransmission!**

But if issues persist:
1. Keep sender tab open for 5+ minutes
2. Check console for "Missing chunks" messages
3. Look for "Requesting X chunks from sender..." logs
4. Verify sender responds with "Sending X chunks..."

## 📊 Comparison

| Feature | Yumi | Yari | Kunai |
|---------|------|------|-------|
| Messaging | ✅ Plain | ✅ Encrypted | ✅ Plain/Encrypted |
| File Transfer | ❌ | ❌ | ✅ |
| Chunk Recovery | N/A | N/A | ✅ |
| Auto Key Exchange | N/A | ✅ | ✅ (if encrypted) |
| UI Color | Green | Purple | Red |
| Icon | 🏹 | ⚔️🔐 | 🥷 |

## 🚀 Production Use

### Hosting

To deploy these demos:

1. **Build first**:
   ```bash
   npm run build
   ```

2. **Upload to static hosting**:
   - Vercel
   - Netlify
   - GitHub Pages
   - Any static host

3. **Files to upload**:
   ```
   apps/
   ├── yumi.html
   ├── yari.html
   └── kunai.html
   dist/
   ├── yumi.umd.js
   ├── yari.umd.js
   ├── kunai.umd.js
   └── *.d.ts (optional)
   ```

### Performance

**Yumi/Yari (Chat)**:
- ~1KB per message
- Instant delivery (<1s)
- Supports 10-100 peers

**Kunai (Files)**:
- 10KB chunks (GunDB)
- ~5ms delay between chunks
- Suitable for files up to 50MB
- For larger files: split or use IPFS

### Security

**Yumi**: ⚠️ Messages are signed but NOT encrypted
**Yari**: ✅ E2E encrypted via Gun SEA
**Kunai**: 
- Plain mode: ⚠️ Files NOT encrypted
- Encrypted mode: ✅ Messages encrypted, files in GunDB are plain
  - For file E2E encryption: encrypt before calling `sendFile()`

## 📝 Example: Embed in Your Site

```html
<!DOCTYPE html>
<html>
<head>
  <title>My P2P App</title>
</head>
<body>
  <!-- Dependencies -->
  <script src="https://cdn.jsdelivr.net/npm/shogun-core@3.3.5/dist/browser/shogun-core.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/tweetnacl@1.0.3/nacl-fast.min.js"></script>
  <script src="path/to/dist/yumi.umd.js"></script>
  
  <script>
    // Use Yumi in your app
    const yumi = new Yumi.Yumi('my-room', {
      announce: ['https://relay.shogun-eco.xyz/gun'],
      heartbeat: 15000
    });
    
    yumi.on('ready', () => {
      console.log('Connected!', yumi.address());
    });
    
    yumi.on('message', (addr, msg) => {
      console.log('From:', addr, 'Message:', msg);
    });
    
    // Send message
    yumi.send({ text: 'Hello P2P world!' });
  </script>
</body>
</html>
```

## 🔗 Links

- [Main README](../README.md)
- [API Documentation](../API.md)
- [Architecture](../ARCHITECTURE.md)
- [Kunai Features](../KUNAI_FEATURES.md)

---

**Have fun experimenting with P2P! 🎉**

