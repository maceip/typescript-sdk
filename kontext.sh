#!/bin/bash
set -e  # Exit on error

# ANSI color codes
BLACK_BG='\033[40m'
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
PINK='\033[38;5;213m'
ITALIC='\033[3m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Header function with kontext.dev branding
print_header() {
    local text="$1"
    local color="${2:-$GREEN}"
    echo ""
    echo -e "${BLACK_BG}${color}═══════════════════════════════════════════════════════════${PINK}kontext.dev${color}═${NC}"
    echo -e "${BLACK_BG}${color}${text}${NC}"
    echo -e "${BLACK_BG}${color}═══════════════════════════════════════════════════════════${PINK}kontext.dev${color}═${NC}"
    echo ""
}

log_info() {
    echo -e "${GREEN}[info]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[warn]${NC} $1"
}

log_error() {
    echo -e "${RED}[error]${NC} $1"
}

print_header "mcp server scaffolding - build & test" "$GREEN"
echo -e "${CYAN}ubuntu 20.04 setup script${NC}"
echo ""

# Check if running on Ubuntu
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        log_warn "this script is designed for ubuntu 20.04, but you're running $ID $VERSION_ID"
        log_warn "continuing anyway..."
    fi
fi

# Step 1: Install system dependencies
log_info "installing system dependencies..."
sudo apt-get update
sudo apt-get install -y curl wget git build-essential

# Step 2: Install Node.js 20.x (required by package.json engines)
log_info "checking node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_warn "node.js version $NODE_VERSION found, but version 20+ is required"
        log_info "installing node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        log_info "node.js $(node -v) is already installed"
    fi
else
    log_info "installing node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Verify Node.js installation
log_info "node.js version: $(node -v)"
log_info "npm version: $(npm -v)"

# Step 3: Install pnpm (version 10.24.0+ required)
log_info "installing pnpm..."
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    log_info "pnpm $PNPM_VERSION is already installed"
else
    npm install -g pnpm@10.24.0
fi

log_info "pnpm version: $(pnpm -v)"

# Step 4: Install project dependencies
log_info "installing project dependencies..."

# Run install and filter out build script warning (benign and expected)
pnpm install 2>&1 | grep -v "Ignored build scripts" | grep -v "approve-builds" | grep -v "to run scripts" | grep -v "^╭ Warning" | grep -v "^╰──" | grep -v "^│"

# Rebuild packages with build scripts to ensure they're available
pnpm rebuild esbuild unrs-resolver 2>/dev/null || true

# Step 5: Build all packages
log_info "building all packages..."
pnpm build:all

log_info "type-checking all packages..."
pnpm typecheck:all

# Step 6: Run tests
log_info "running tests..."
pnpm test:all || log_warn "some tests failed, continuing..."

print_header "build complete" "$GREEN"

echo -e "${ITALIC}${CYAN}available example servers:${NC}"
echo ""
echo "1. simple data server (basic data processing):"
echo "   pnpm --filter @modelcontextprotocol/examples-scaffolding simple-data"
echo ""
echo "2. multi-api server (google drive + salesforce integration):"
echo "   pnpm --filter @modelcontextprotocol/examples-scaffolding multi-api"
echo ""
echo "3. template starter (minimal template):"
echo "   pnpm --filter @modelcontextprotocol/examples-scaffolding template"
echo ""

print_header "running interactive demo" "$CYAN$ITALIC"

# Run the test client which starts the server and exercises it
log_info "starting mcp client-server demo..."
log_info "the client will connect to the server and test its functionality"
echo ""

# Run the test client
pnpm --filter @modelcontextprotocol/examples-scaffolding test-client

print_header "token efficiency demonstration (vishi)" "$CYAN$ITALIC"

log_info "running vishi - token savings demo..."
echo ""

# Run the vishi demonstration
pnpm --filter @modelcontextprotocol/examples-scaffolding vishi

print_header "all demonstrations completed" "$GREEN"
