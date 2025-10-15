# CLI Installation Guide 🥷

Complete guide to installing and using KUNAI as command-line tools on Linux, macOS, and Windows.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## Prerequisites

- **Node.js** 14 or higher
- **npm** (comes with Node.js)
- **Git** (optional, for cloning)

Check your versions:
```bash
node -v   # Should be v14.0.0 or higher
npm -v    # Should be 6.0.0 or higher
```

---

## Installation Methods

### Method 1: Automated Installation (Linux/macOS) ⚡

**Easiest and recommended for Linux/macOS users:**

```bash
# Clone or download the project
git clone https://github.com/scobru/shogun-yumi.git kunai
cd kunai

# Run the install script
chmod +x install.sh
./install.sh
```

This will:
1. Install dependencies
2. Build the project
3. Install `kunai`, `yumi`, and `yari` as global commands

### Method 2: Manual Installation (All Platforms) 🔧

**Works on Windows, Linux, and macOS:**

```bash
# 1. Navigate to the project
cd kunai

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Link globally
npm link

# Or use the npm script:
npm run install-global
```

### Method 3: npm Global Install (When Published) 📦

**When the package is published to npm:**

```bash
npm install -g shogun-yumi
```

---

## Quick Start

After installation, you'll have three commands available:

### 🥷 Kunai - Ephemeral File Transfer

```bash
kunai
```

**Interactive CLI for secure file transfers, similar to Magic Wormhole.**

### 🏹 Yumi - P2P Messaging

```bash
yumi
```

**Plain P2P messaging (signed but not encrypted).**

### ⚔️ Yari - Encrypted P2P Messaging

```bash
yari
```

**Encrypted P2P messaging with automatic key exchange.**

---

## Usage Examples

### File Transfer with Kunai

**Sender (Terminal 1):**
```bash
kunai
🥷 > send myfile.pdf
📤 Transfer code: 42-ninja-sakura
```

**Receiver (Terminal 2):**
```bash
kunai
🥷 > # File automatically detected and downloaded
📥 File received: myfile.pdf
```

**Encrypted file transfer:**
```bash
kunai --encrypted
🔐🥷 > send secret.pdf
```

**Custom channel:**
```bash
kunai --channel=team-alpha
🥷 > send document.pdf
```

### P2P Messaging with Yumi

**Peer 1:**
```bash
yumi
🏹 > send Hello, World!
🏹 > peers          # List connected peers
🏹 > ping <address> # Ping a specific peer
```

**Peer 2:**
```bash
yumi
# Automatically receives messages from Peer 1
📨 From: BN3VZp4Z8WLN...
    Message: Hello, World!
```

### Encrypted Messaging with Yari

**Peer 1:**
```bash
yari
⚔️ > send Secret message
🔑 Keys exchanged with: BQ7xKLmP2s...
✅ Message encrypted and sent
```

**Peer 2:**
```bash
yari
🔓 Decrypted from: BN3VZp4Z8WLN...
   Message: Secret message
```

---

## Command Options

### Kunai Options

```bash
kunai                           # Start interactive CLI
kunai --encrypted               # Use encryption (Yari)
kunai --channel=my-room         # Use custom channel
kunai --help                    # Show help
```

### Available Commands (Inside CLI)

**Kunai:**
```
send <filepath>     # Send a file
receive             # Listen for incoming files
peers               # List connected peers
help                # Show help
quit                # Exit
```

**Yumi/Yari:**
```
send <message>      # Broadcast message
peers               # List connected peers
ping <address>      # Ping a peer
info <address>      # Get peer info
quit                # Exit
```

---

## Troubleshooting

### Commands not found after installation

**Linux/macOS:**
```bash
# Refresh your shell
source ~/.bashrc
# or
source ~/.zshrc

# Or open a new terminal
```

**Check if commands are installed:**
```bash
which kunai
which yumi
which yari
```

### Permission errors during installation

**Linux/macOS:**
```bash
# If npm link requires sudo
sudo npm link

# Or use npm prefix to install in user directory
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
npm link
```

### Build errors

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Node.js version issues

```bash
# Check version
node -v

# Update Node.js if needed
# Visit: https://nodejs.org/
```

### Port conflicts or connection issues

```bash
# Check if firewall is blocking connections
# Try with local-only mode first

kunai --local
```

---

## Uninstallation

### Method 1: Automated (Linux/macOS)

```bash
chmod +x uninstall.sh
./uninstall.sh
```

### Method 2: Manual (All Platforms)

```bash
npm unlink -g shogun-yumi

# Or use the npm script:
npm run uninstall-global
```

### Method 3: Clean All (If Published)

```bash
npm uninstall -g shogun-yumi
```

---

## Advanced Configuration

### Using with Systemd (Linux Server)

Create a service file for running Kunai as a daemon:

```bash
sudo nano /etc/systemd/system/kunai.service
```

```ini
[Unit]
Description=Kunai File Transfer Service
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser
ExecStart=/usr/local/bin/kunai
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable kunai
sudo systemctl start kunai
sudo systemctl status kunai
```

### Using with PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start Kunai
pm2 start kunai --name "kunai-transfer"

# Save PM2 config
pm2 save

# Auto-start on boot
pm2 startup
```

---

## Environment Variables

```bash
# Debug mode
DEBUG=yumi,yari,kunai kunai

# Custom relay servers
export KUNAI_RELAYS="http://relay1.local/gun,http://relay2.local/gun"
```

---

## Integration with Shell

### Bash Aliases

Add to `~/.bashrc`:

```bash
# Quick file send
alias send='kunai --encrypted'

# Team channel
alias team-send='kunai --encrypted --channel=team-alpha'
```

### Bash Functions

```bash
# Send file with automatic code display
send-file() {
    kunai --encrypted <<EOF
send $1
quit
EOF
}

# Usage: send-file myfile.pdf
```

---

## Comparison with Magic Wormhole

| Feature | Magic Wormhole | KUNAI Kunai |
|---------|---------------|--------------|
| Platform | Python CLI | Node.js (CLI + Browser) |
| File Transfer | ✅ | ✅ |
| Messaging | ❌ | ✅ (Yumi/Yari) |
| Browser Support | ❌ | ✅ |
| Encryption | ✅ | ✅ (Optional) |
| Transfer Codes | ✅ | ✅ |
| Decentralized | ✅ | ✅ (GunDB) |
| RPC System | ❌ | ✅ |
| WebRTC | ✅ | ✅ |

---

## Support

- **Documentation**: [README.md](./README.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Reference**: [API.md](./API.md)
- **Issues**: https://github.com/scobru/shogun-yumi/issues

---

## License

MIT License - See [LICENSE](./LICENSE) for details

---

**Happy hacking! 🚀**

