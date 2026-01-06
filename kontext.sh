#!/bin/bash
set -e  # Exit on error

echo "========================================="
echo "MCP Server Scaffolding - Build & Test"
echo "Ubuntu 20.04 Setup Script"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Ubuntu
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        log_warn "This script is designed for Ubuntu 20.04, but you're running $ID $VERSION_ID"
        log_warn "Continuing anyway..."
    fi
fi

# Step 1: Install system dependencies
log_info "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y curl wget git build-essential

# Step 2: Install Node.js 20.x (required by package.json engines)
log_info "Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_warn "Node.js version $NODE_VERSION found, but version 20+ is required"
        log_info "Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        log_info "Node.js $(node -v) is already installed"
    fi
else
    log_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verify Node.js installation
log_info "Node.js version: $(node -v)"
log_info "npm version: $(npm -v)"

# Step 3: Install pnpm (version 10.24.0+ required)
log_info "Installing pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    log_info "pnpm $PNPM_VERSION is already installed"
else
    npm install -g pnpm@10.24.0
fi

log_info "pnpm version: $(pnpm -v)"

# Step 4: Install project dependencies
log_info "Installing project dependencies..."
pnpm install

# Step 5: Build all packages
log_info "Building all packages..."
pnpm build:all

log_info "Type-checking all packages..."
pnpm typecheck:all

# Step 6: Run tests
log_info "Running tests..."
pnpm test:all || log_warn "Some tests failed, continuing..."

echo ""
echo "========================================="
echo "Build Complete! ✅"
echo "========================================="
echo ""
echo "Available example servers:"
echo ""
echo "1. Simple Data Server (basic data processing):"
echo "   pnpm --filter @modelcontextprotocol/examples-scaffolding simple-data"
echo ""
echo "2. Multi-API Server (Google Drive + Salesforce integration):"
echo "   pnpm --filter @modelcontextprotocol/examples-scaffolding multi-api"
echo ""
echo "3. Template Starter (minimal template):"
echo "   pnpm --filter @modelcontextprotocol/examples-scaffolding template"
echo ""
echo "========================================="
echo "Running Template Starter Example..."
echo "========================================="
echo ""

# Run the template starter example
log_info "Starting template-starter.ts on stdio..."
log_info "Press Ctrl+C to exit"
echo ""

# Run the example using workspace filter
pnpm --filter @modelcontextprotocol/examples-scaffolding template

# If the above exits, show summary
echo ""
echo "========================================="
echo "Example execution completed!"
echo "========================================="
