# CLI Quick Start 🚀

Get up and running with KUNAI CLI commands in 60 seconds!

## One-Line Installation

### Linux/macOS
```bash
git clone https://github.com/scobru/shogun-yumi.git kunai && cd kunai && chmod +x install.sh && ./install.sh
```

### Windows PowerShell (as Administrator)
```powershell
git clone https://github.com/scobru/shogun-yumi.git kunai; cd kunai; .\install.ps1
```

## Or Manual Steps

```bash
# 1. Get the code
git clone https://github.com/scobru/shogun-yumi.git kunai
cd kunai

# 2. Install & build
npm install
npm run build

# 3. Install globally
npm link
```

## Commands Available

After installation, you get three commands:

### 🥷 `kunai` - File Transfer (Magic Wormhole Alternative)

```bash
kunai
🥷 > send myfile.pdf
📤 Transfer code: 42-ninja-sakura
```

**Options:**
- `kunai --encrypted` - Encrypted transfers
- `kunai --channel=my-team` - Private channel

### 🏹 `yumi` - P2P Messaging

```bash
yumi
🏹 > send Hello World!
```

### ⚔️ `yari` - Encrypted Messaging

```bash
yari
⚔️ > send Secret message
🔑 Keys exchanged automatically
```

## Quick File Transfer Example

**Terminal 1 (Sender):**
```bash
kunai
🥷 > send photo.jpg
📤 Transfer code: 67-samurai-tokyo
```

**Terminal 2 (Receiver):**
```bash
kunai
📥 File automatically detected: photo.jpg
✅ Download complete!
```

## Uninstall

```bash
# Linux/macOS
./uninstall.sh

# Windows
.\uninstall.ps1

# Or manually
npm unlink -g shogun-yumi
```

## Troubleshooting

**Commands not found?**
```bash
# Open new terminal or:
source ~/.bashrc
```

**Permission error?**
```bash
# Linux/macOS
sudo npm link

# Windows
# Run PowerShell as Administrator
```

**Need help?**
```bash
kunai --help
```

## Full Documentation

📖 See **[CLI_INSTALL.md](./CLI_INSTALL.md)** for complete guide

---

**That's it! Happy transferring! 🚀**

