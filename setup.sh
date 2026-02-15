#!/bin/bash
set -e

BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}${BOLD}  ★ StarCode Setup${NC}"
echo -e "${CYAN}  Terminal AI Coding Assistant${NC}"
echo ""

# ─── Check Node.js ───────────────────────────────────────────────
echo -e "${BOLD}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found${NC}"
  echo "  Install Node.js 18+ from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Node.js $NODE_VERSION found, but 18+ is required${NC}"
  echo "  Update Node.js from https://nodejs.org"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"

# ─── Check Ollama ────────────────────────────────────────────────
echo -e "\n${BOLD}Checking Ollama...${NC}"
if ! command -v ollama &> /dev/null; then
  echo -e "${RED}✗ Ollama not found${NC}"
  echo "  Install Ollama from https://ollama.ai"
  exit 1
fi
echo -e "${GREEN}✓ Ollama found${NC}"

# Check if Ollama is running
if ! curl -s http://localhost:11434 > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠ Ollama is not running. Starting it...${NC}"
  ollama serve &
  sleep 2
  if ! curl -s http://localhost:11434 > /dev/null 2>&1; then
    echo -e "${RED}✗ Could not start Ollama${NC}"
    echo "  Try running 'ollama serve' manually in another terminal"
    exit 1
  fi
  echo -e "${GREEN}✓ Ollama started${NC}"
else
  echo -e "${GREEN}✓ Ollama is running${NC}"
fi

# ─── Model Selection ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}Select a coding model:${NC}"
echo ""
echo "  1) starcoder2:3b        (1.7GB  — Fast, good for small tasks)"
echo "  2) starcoder2:7b        (4.0GB  — Balanced quality/speed)"
echo "  3) starcoder2:instruct  (4.0GB  — Best for instructions)"
echo "  4) qwen2.5-coder:7b    (4.7GB  — Strong general coding)"
echo ""
read -p "Choose model [1-4, default 1]: " MODEL_CHOICE

case "$MODEL_CHOICE" in
  2) MODEL="starcoder2:7b" ;;
  3) MODEL="starcoder2:instruct" ;;
  4) MODEL="qwen2.5-coder:7b" ;;
  *) MODEL="starcoder2:3b" ;;
esac

echo ""
echo -e "${BOLD}Pulling ${CYAN}${MODEL}${NC}${BOLD}...${NC}"
echo -e "${YELLOW}(This may take a few minutes on first run)${NC}"
echo ""
ollama pull "$MODEL"
echo -e "${GREEN}✓ Model ${MODEL} ready${NC}"

# ─── Install Dependencies ────────────────────────────────────────
echo ""
echo -e "${BOLD}Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ─── Link Global Command ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Linking 'starcode' command...${NC}"
npm link
echo -e "${GREEN}✓ 'starcode' command available globally${NC}"

# ─── Write config ────────────────────────────────────────────────
echo ""
cat > .starcode.json << EOF
{
  "model": "${MODEL}"
}
EOF
echo -e "${GREEN}✓ Config saved to .starcode.json${NC}"

# ─── Done ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ★ Setup complete!${NC}"
echo ""
echo -e "  Run ${CYAN}starcode${NC} to start the assistant"
echo -e "  Run ${CYAN}starcode --help${NC} for options"
echo ""
