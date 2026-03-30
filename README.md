# ASHFIELDS MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets AI agents mint [Ashfields](https://ashfields-mint.vercel.app) NFTs autonomously on Ethereum — no browser, no MetaMask, no human in the loop.

> **Ashfields** — 10,000 fully on-chain animated SVG NFTs. Minting burns 100,000 $ASH permanently. Earn $ASH by burning dead NFTs on [deadjpg.lol](https://deadjpg.lol).

---

## Requirements

- Node.js 18+
- A wallet with:
  - Enough $ASH to mint (100,000 $ASH per token)
  - A small amount of ETH for gas (~0.001 ETH per mint)

---

## Installation

```bash
git clone https://github.com/smoke711711/ashfields-mcp-server
cd ashfields-mcp-server
npm install
```

---

## Configuration

Set your wallet private key as an environment variable:

```bash
export WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

Optionally set a custom RPC endpoint (defaults to a public node):

```bash
export ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

## Usage

### Run directly

```bash
WALLET_PRIVATE_KEY=0x... node index.js
```

### Add to Claude Desktop

Edit `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ashfields": {
      "command": "node",
      "args": ["/absolute/path/to/ashfields-mcp-server/index.js"],
      "env": {
        "WALLET_PRIVATE_KEY": "0xYOUR_PRIVATE_KEY",
        "ETH_RPC_URL": "https://ethereum.publicnode.com"
      }
    }
  }
}
```

Restart Claude Desktop. The tools will appear automatically.

---

## Available Tools

### `get_mint_info`
Returns current mint status — price, total minted, remaining supply, and whether minting is active. Call this first to confirm minting is open.

```
No arguments required.
```

### `check_wallet`
Returns the configured wallet's $ASH balance, ETH balance, current allowance for the Ashfields contract, and how many tokens it can mint right now.

```
No arguments required.
```

### `approve_ash`
Approves the Ashfields contract to spend $ASH from the wallet. Waits for on-chain confirmation before returning. Only needed if the current allowance is insufficient — `mint_ashfield` handles this automatically.

```
quantity  number  Tokens to approve for (1–5). Approves quantity × 100,000 ASH.
```

### `mint_ashfield`
Full mint flow: checks allowance, auto-approves if needed, mints the requested quantity, and waits for on-chain confirmation. Returns token IDs and OpenSea links.

```
quantity  number  Tokens to mint (1–5 per transaction).
```

**Example response:**
```json
{
  "status": "success",
  "minted": 1,
  "ashBurned": "100,000 ASH",
  "tokenIds": ["8377"],
  "approvalTx": "0xfc33...",
  "mintTx": "0xe2e0...",
  "etherscan": "https://etherscan.io/tx/0xe2e0...",
  "opensea": ["https://opensea.io/assets/ethereum/0x068F.../8377"]
}
```

### `trigger_distribute`
Calls `distribute()` on the RoyaltyDistributor contract. Permissionless — any wallet can trigger this. Splits accumulated royalty ETH: **1% creator · 1% $ASH team · 8% Uniswap buyback → burned to 0xdead**. Requires ≥ 0.005 ETH in the distributor.

```
No arguments required.
```

---

## Example Agent Prompts

> "Check my wallet, then mint 2 Ashfields and give me the token IDs."

> "Check if minting is active, verify my $ASH balance is sufficient, then mint 1 token."

> "Trigger the buyback+burn distribution on the RoyaltyDistributor."

---

## Contract Addresses (Ethereum Mainnet)

| Contract | Address |
|----------|---------|
| Ashfields (ASHF) | `0x068FB5Ac232462f642F34B2bAa81750Cc2F00DAA` |
| $ASH Token | `0x7e6aed913DEAA38A486514AD75Bdf8E48Fa74a17` |
| RoyaltyDistributor | `0xF3b4063958dB5814E31aA745FbbfD4c0006E52A6` |

---

## Security

- The private key is read from environment variables only — never passed as a tool argument
- The server communicates via stdio — no network port is opened
- Only the configured wallet can sign transactions
- `trigger_distribute()` is permissionless by contract design — safe for any wallet to call

---

## Machine-Readable Spec

```bash
curl https://ashfields-mint.vercel.app/api/mint-info
```

---

## License

MIT
