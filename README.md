# Ashfields MCP Server

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/ashfields-mcp-server)](https://www.npmjs.com/package/ashfields-mcp-server)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

**The first MCP server that burns an ERC-20 token to mint an NFT. Approve $ASH, call mint() — 100,000 tokens permanently destroyed, fully on-chain animated SVG appears on Ethereum. No ETH payment. No browser. Two contract calls from any agent.**

> **Ashfields** — 10,000 fully on-chain animated SVG NFTs. Minting burns 100,000 $ASH permanently. Earn $ASH by burning dead NFTs on [deadjpg.lol](https://deadjpg.lol).

---

## Installation

```bash
git clone https://github.com/smoke711711/ashfields-mcp-server
cd ashfields-mcp-server
npm install
```

Or via npx (no clone needed):

```bash
npx ashfields-mcp-server
```

---

## Requirements

- Node.js 18+
- A wallet with:
  - Enough $ASH to mint (100,000 $ASH per token)
  - A small amount of ETH for gas (~0.001 ETH per mint)

---

## Configuration

```bash
export WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
# Optional — defaults to a public Ethereum node
export ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
```

---

## Add to Claude Desktop

Edit `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

Restart Claude Desktop — the tools will appear automatically.

---

## Available Tools

### `get_mint_info`
Returns current mint status: price per token, total minted, remaining supply, whether minting is active, and contract addresses.

| Arg | Type | Required |
|-----|------|----------|
| — | — | — |

**Returns:** `{ mintActive, totalMinted, remainingSupply, pricePerToken, priceFormatted, maxPerTransaction, contracts }`

---

### `check_wallet`
Returns the configured wallet address, $ASH balance, ETH balance, current $ASH allowance for the Ashfields contract, and how many tokens it can mint right now.

| Arg | Type | Required |
|-----|------|----------|
| — | — | — |

**Returns:** `{ walletAddress, ashBalance, ashAllowance, ethBalance, canMintThisTx, needsApproval }`

---

### `approve_ash`
Approves the Ashfields contract to spend $ASH from the wallet. Waits for on-chain confirmation. Only needed if allowance is insufficient — `mint_ashfield` handles this automatically.

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `quantity` | number | yes | Tokens to approve for (1–5). Approves quantity × 100,000 ASH. |

**Returns:** `{ status, approved, forTokens, wallet, txHash, etherscan }`

---

### `mint_ashfield`
Full mint flow: checks allowance, auto-approves if needed, mints, waits for confirmation. Returns minted token IDs and OpenSea link. Burns 100,000 $ASH per token permanently (sent to 0xdead).

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `quantity` | number | yes | Tokens to mint (1–5 per transaction). |

**Returns:** `{ status, minted, ashBurned, tokenIds, wallet, approvalTx, mintTx, etherscan, opensea }`

**Example response:**
```json
{
  "status": "success",
  "minted": 2,
  "ashBurned": "200,000 ASH",
  "tokenIds": ["8377", "220"],
  "approvalTx": "0xfc33...",
  "mintTx": "0xe2e0...",
  "etherscan": "https://etherscan.io/tx/0xe2e0...",
  "opensea": "https://opensea.io/collection/ashfields-lol"
}
```

---

### `trigger_distribute`
Calls `distribute()` on the RoyaltyDistributor contract. Permissionless — any wallet can trigger this at any time. Splits accumulated royalty ETH: 1% creator · 1% $ASH team · 8% Uniswap buyback → burned to 0xdead. Requires ≥ 0.005 ETH in the distributor.

| Arg | Type | Required |
|-----|------|----------|
| — | — | — |

**Returns:** `{ status, txHash, etherscan, note }`

---

## Example Agent Prompt

> "Check my wallet balance, verify I have enough $ASH to mint 2 Ashfields, then mint them and return the token IDs and OpenSea links."

---

## Contract Addresses (Ethereum Mainnet)

| Contract | Address |
|----------|---------|
| Ashfields NFT (ASHF) | `0x068FB5Ac232462f642F34B2bAa81750Cc2F00DAA` |
| $ASH Token | `0x7e6aed913DEAA38A486514AD75Bdf8E48Fa74a17` |
| RoyaltyDistributor | `0xF3b4063958dB5814E31aA745FbbfD4c0006E52A6` |

---

## Security

- Private key is read from environment variables only — never passed as a tool argument
- Server communicates via stdio — no network port is opened
- Only the configured wallet can sign transactions
- `trigger_distribute()` is permissionless by contract design — safe for any wallet to call

---

## Machine-Readable Spec

```bash
curl https://ashfields-mint.vercel.app/api/mint-info
```

---

## Links

- [Mint site & MCP docs](https://ashfields-mint.vercel.app/mcp)
- [OpenSea collection](https://opensea.io/collection/ashfields-lol)
- [Etherscan — Ashfields contract](https://etherscan.io/address/0x068FB5Ac232462f642F34B2bAa81750Cc2F00DAA)
- [deadjpg.lol — earn $ASH](https://deadjpg.lol)

---

## License

MIT © 2025 smoke711711
