#!/bin/bash

###############################################################################
# KUNAI CLI Uninstallation Script
# Removes kunai, yumi, and yari global commands
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
echo "║  🗑️  KUNAI CLI Uninstallation                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if commands are installed
INSTALLED=false
if command -v kunai &> /dev/null || command -v yumi &> /dev/null || command -v yari &> /dev/null; then
    INSTALLED=true
fi

if [ "$INSTALLED" = false ]; then
    echo -e "${YELLOW}⚠️  KUNAI CLI commands are not globally installed${NC}"
    echo -e "${BLUE}Nothing to uninstall.${NC}"
    exit 0
fi

echo -e "${CYAN}Removing global commands...${NC}"

# Unlink globally
npm unlink -g shogun-yumi 2>/dev/null || true

echo -e "${GREEN}✓ Global commands removed${NC}"
echo ""

# Check if uninstallation was successful
if command -v kunai &> /dev/null || command -v yumi &> /dev/null || command -v yari &> /dev/null; then
    echo -e "${YELLOW}⚠️  Some commands may still be available${NC}"
    echo -e "${YELLOW}   Try opening a new terminal or manually remove:${NC}"
    
    if command -v kunai &> /dev/null; then
        KUNAI_PATH=$(which kunai)
        echo -e "     ${CYAN}rm $KUNAI_PATH${NC}"
    fi
    if command -v yumi &> /dev/null; then
        YUMI_PATH=$(which yumi)
        echo -e "     ${CYAN}rm $YUMI_PATH${NC}"
    fi
    if command -v yari &> /dev/null; then
        YARI_PATH=$(which yari)
        echo -e "     ${CYAN}rm $YARI_PATH${NC}"
    fi
else
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ Uninstallation completed successfully!           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
fi

echo ""
echo -e "${BLUE}To reinstall:${NC}"
echo -e "  ${CYAN}./install.sh${NC}             # Or: npm run install-global"
echo ""

echo -e "${PURPLE}Goodbye! 👋${NC}"

