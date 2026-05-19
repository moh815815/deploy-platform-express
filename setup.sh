#!/bin/bash
# ─── Deploy Platform — Express Edition Setup ─────────────────────────────────

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   🚀 Deploy Platform (Express) — Setup   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌  Node.js not found. Install from: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node --version | sed 's/v//')
MAJOR=$(echo $NODE_VER | cut -d. -f1)
if [ "$MAJOR" -lt 16 ]; then
  echo "❌  Node.js v$NODE_VER is too old. Need v16 or newer."
  exit 1
fi

echo "✅  Node.js $(node --version)"
echo "✅  npm $(npm --version)"
echo ""

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "📦  Installing dependencies..."
  npm install
  echo "✅  Dependencies installed"
else
  echo "✅  Dependencies already installed"
fi
echo ""

# Create .env if missing
if [ ! -f ".env" ]; then
  echo "📝  Creating .env file..."
  cat > .env << 'ENVEOF'
PORT=3000
# Upload directory (defaults to system temp)
# UPLOAD_DIR=/tmp/deploy-uploads

# Add your API tokens below for REAL deployment (optional)
# Without tokens, the server runs in simulation mode.

# Netlify: https://app.netlify.com/user/applications#personal-access-tokens
# NETLIFY_TOKEN=

# Vercel: https://vercel.com/account/tokens
# VERCEL_TOKEN=

# GitHub: https://github.com/settings/tokens
# GITHUB_TOKEN=
# GITHUB_USERNAME=
ENVEOF
  echo "✅  .env created — edit it to add API tokens for real deployment"
else
  echo "✅  .env already exists"
fi
echo ""

# Start the server
echo "🚀  Starting server..."
echo ""
node server.js
