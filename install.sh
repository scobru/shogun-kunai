#!/bin/bash

###############################################################################
# KUNAI CLI Installation Script
# Installs kunai, yumi, and yari as global commands
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  🥷 KUNAI CLI Installation                          ║"
echo "║  Yumi (弓) | Yari (槍) | Kunai (苦無)                 ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Node.js is installed
echo -e "${CYAN}Checking dependencies...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    echo -e "${YELLOW}Please install Node.js 14+ from https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo -e "${RED}❌ Node.js version 14+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) detected${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm $(npm -v) detected${NC}"
echo ""

# Install dependencies
echo -e "${CYAN}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Build the project
echo -e "${CYAN}🔨 Building project...${NC}"
npm run build
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Make CLI scripts executable
echo -e "${CYAN}🔧 Setting up CLI scripts...${NC}"
chmod +x cli/kunai.js
chmod +x cli/yumi.js
chmod +x cli/yari.js
echo -e "${GREEN}✓ CLI scripts are now executable${NC}"
echo ""

# Link globally
echo -e "${CYAN}🔗 Installing global commands...${NC}"
npm link

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Installation completed successfully!             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}Available commands:${NC}"
echo -e "  ${YELLOW}kunai${NC}  - Ephemeral file transfer (like Magic Wormhole)"
echo -e "  ${YELLOW}yumi${NC}   - P2P messaging"
echo -e "  ${YELLOW}yari${NC}   - Encrypted P2P messaging"
echo ""

echo -e "${BLUE}Quick start:${NC}"
echo -e "  ${CYAN}kunai${NC}                    # Start file transfer"
echo -e "  ${CYAN}kunai --encrypted${NC}        # Encrypted file transfer"
echo -e "  ${CYAN}yumi${NC}                     # Start P2P messaging"
echo -e "  ${CYAN}yari${NC}                     # Start encrypted messaging"
echo ""

echo -e "${BLUE}To uninstall:${NC}"
echo -e "  ${CYAN}./uninstall.sh${NC}           # Or: npm run uninstall-global"
echo ""

# Test if commands are available
if command -v kunai &> /dev/null; then
    echo -e "${GREEN}✓ Commands successfully installed and available globally${NC}"
else
    echo -e "${YELLOW}⚠️  Commands installed but may not be in PATH yet${NC}"
    echo -e "${YELLOW}   Try opening a new terminal or run: source ~/.bashrc${NC}"
fi

echo ""
echo -e "${PURPLE}Happy hacking! 🚀${NC}"

