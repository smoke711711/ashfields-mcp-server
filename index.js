#!/usr/bin/env node
/**
 * ASHFIELDS MCP Server
 *
 * Exposes Ashfields NFT minting as MCP tools for autonomous AI agents.
 * Any MCP-compatible agent (Claude, GPT, etc.) can mint Ashfields NFTs
 * directly on Ethereum — no browser, no MetaMask, no human in the loop.
 *
 * Required env vars:
 *   WALLET_PRIVATE_KEY   0x-prefixed private key of the signing wallet
 *
 * Optional env vars:
 *   ETH_RPC_URL          Ethereum JSON-RPC endpoint (defaults to public node)
 *
 * Usage:
 *   WALLET_PRIVATE_KEY=0x... node index.js
 */

import { Server }               from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatUnits,
  formatEther,
} from 'viem'
import { mainnet }              from 'viem/chains'
import { privateKeyToAccount }  from 'viem/accounts'

/* ── Contract addresses ─────────────────────────────────────────────── */
const ASHFIELDS    = '0x068FB5Ac232462f642F34B2bAa81750Cc2F00DAA'
const ASH_TOKEN    = '0x7e6aed913DEAA38A486514AD75Bdf8E48Fa74a17'
const DISTRIBUTOR  = '0xF3b4063958dB5814E31aA745FbbfD4c0006E52A6'
const MINT_PRICE   = 100_000n * 10n ** 18n   // 100,000 ASH (18 decimals)
const MAX_PER_TX   = 5

/* ── ABIs ───────────────────────────────────────────────────────────── */
const ASH_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
])

const ASHFIELDS_ABI = parseAbi([
  'function mint(uint256 quantity)',
  'function totalMinted() view returns (uint256)',
  'function mintActive() view returns (bool)',
])

const DISTRIBUTOR_ABI = parseAbi([
  'function distribute()',
])

/* ── Clients ────────────────────────────────────────────────────────── */
const RPC_URL = process.env.ETH_RPC_URL ?? 'https://ethereum.publicnode.com'

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL),
})

function getWalletClients() {
  const pk = process.env.WALLET_PRIVATE_KEY
  if (!pk) throw new Error('WALLET_PRIVATE_KEY environment variable is not set.')
  const account = privateKeyToAccount(/** @type {`0x${string}`} */ (pk))
  const walletClient = createWalletClient({ account, chain: mainnet, transport: http(RPC_URL) })
  return { account, walletClient }
}

function fmtAsh(n) {
  return Number(formatUnits(n, 18)).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ASH'
}

/* ── MCP server ─────────────────────────────────────────────────────── */
const server = new Server(
  { name: 'ashfields', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

/* ── Tool list ──────────────────────────────────────────────────────── */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_mint_info',
      description:
        'Returns current Ashfields mint status: price per token, total minted so far, ' +
        'remaining supply, whether minting is currently active, and contract addresses. ' +
        'Call this first to confirm minting is open before attempting a mint.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'check_wallet',
      description:
        'Returns the configured wallet address, its $ASH token balance, its current ' +
        '$ASH allowance for the Ashfields contract, and its ETH balance for gas. ' +
        'Also reports the maximum number of tokens it can mint right now.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'approve_ash',
      description:
        'Approves the Ashfields contract to spend $ASH tokens from the configured wallet. ' +
        'Submits the approval transaction and waits for on-chain confirmation. ' +
        'Required before minting if the current allowance is insufficient.',
      inputSchema: {
        type: 'object',
        properties: {
          quantity: {
            type: 'number',
            description: 'Number of tokens to approve spend for (1–5). Approves quantity × 100,000 ASH.',
          },
        },
        required: ['quantity'],
      },
    },
    {
      name: 'mint_ashfield',
      description:
        'Mints one or more Ashfields NFTs. Automatically approves $ASH if the current ' +
        'allowance is insufficient, then submits the mint transaction and waits for ' +
        'confirmation. Returns the minted token IDs and OpenSea links. ' +
        'Burns 100,000 $ASH per token permanently (sent to 0xdead).',
      inputSchema: {
        type: 'object',
        properties: {
          quantity: {
            type: 'number',
            description: 'Number of tokens to mint. Must be between 1 and 5 per transaction.',
          },
        },
        required: ['quantity'],
      },
    },
    {
      name: 'trigger_distribute',
      description:
        'Calls distribute() on the RoyaltyDistributor contract. Permissionless — any wallet ' +
        'can trigger this at any time. Splits accumulated royalty ETH: 1% to creator, ' +
        '1% to $ASH team, 8% buys $ASH on Uniswap and burns it to 0xdead. ' +
        'Requires at least 0.005 ETH in the distributor to execute.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}))

/* ── Tool handlers ──────────────────────────────────────────────────── */
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params

  try {

    /* ── get_mint_info ─────────────────────────────────────────────── */
    if (name === 'get_mint_info') {
      const [totalMinted, mintActive] = await Promise.all([
        publicClient.readContract({ address: ASHFIELDS, abi: ASHFIELDS_ABI, functionName: 'totalMinted' }),
        publicClient.readContract({ address: ASHFIELDS, abi: ASHFIELDS_ABI, functionName: 'mintActive' }),
      ])

      return text({
        mintActive,
        totalMinted:      Number(totalMinted),
        remainingSupply:  10_000 - Number(totalMinted),
        pricePerToken:    MINT_PRICE.toString(),
        priceFormatted:   '100,000 ASH',
        maxPerTransaction: MAX_PER_TX,
        contracts: {
          ashfields: ASHFIELDS,
          ashToken:  ASH_TOKEN,
        },
      })
    }

    /* ── check_wallet ──────────────────────────────────────────────── */
    if (name === 'check_wallet') {
      const { account } = getWalletClients()
      const [ashBalance, allowance, ethBalance] = await Promise.all([
        publicClient.readContract({ address: ASH_TOKEN, abi: ASH_ABI, functionName: 'balanceOf',  args: [account.address] }),
        publicClient.readContract({ address: ASH_TOKEN, abi: ASH_ABI, functionName: 'allowance',  args: [account.address, ASHFIELDS] }),
        publicClient.getBalance({ address: account.address }),
      ])
      const canMintCount = Math.min(Math.floor(Number(ashBalance / MINT_PRICE)), MAX_PER_TX)

      return text({
        walletAddress:    account.address,
        ashBalance:       fmtAsh(ashBalance),
        ashAllowance:     fmtAsh(allowance),
        ethBalance:       formatEther(ethBalance) + ' ETH',
        canMintThisTx:    canMintCount,
        needsApproval:    allowance < MINT_PRICE,
      })
    }

    /* ── approve_ash ───────────────────────────────────────────────── */
    if (name === 'approve_ash') {
      const quantity = Number(args.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_TX) {
        throw new Error(`quantity must be an integer between 1 and ${MAX_PER_TX}.`)
      }
      const amount = MINT_PRICE * BigInt(quantity)
      const { account, walletClient } = getWalletClients()

      const hash = await walletClient.writeContract({
        address: ASH_TOKEN, abi: ASH_ABI, functionName: 'approve',
        args: [ASHFIELDS, amount],
        gas: 60_000n,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      return text({
        status:    receipt.status,
        approved:  fmtAsh(amount),
        forTokens: quantity,
        wallet:    account.address,
        txHash:    hash,
        etherscan: `https://etherscan.io/tx/${hash}`,
      })
    }

    /* ── mint_ashfield ─────────────────────────────────────────────── */
    if (name === 'mint_ashfield') {
      const quantity = Number(args.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_TX) {
        throw new Error(`quantity must be an integer between 1 and ${MAX_PER_TX}.`)
      }
      const totalCost = MINT_PRICE * BigInt(quantity)
      const { account, walletClient } = getWalletClients()

      // Check allowance — approve if insufficient
      const allowance = await publicClient.readContract({
        address: ASH_TOKEN, abi: ASH_ABI, functionName: 'allowance',
        args: [account.address, ASHFIELDS],
      })

      let approveHash = null
      if (allowance < totalCost) {
        approveHash = await walletClient.writeContract({
          address: ASH_TOKEN, abi: ASH_ABI, functionName: 'approve',
          args: [ASHFIELDS, totalCost],
          gas: 60_000n,
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      // Mint
      const mintHash = await walletClient.writeContract({
        address: ASHFIELDS, abi: ASHFIELDS_ABI, functionName: 'mint',
        args: [BigInt(quantity)],
        gas: 250_000n,
      })
      const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash })

      // Parse Transfer(from=0x0) events to get minted token IDs
      const tokenIds = []
      for (const log of mintReceipt.logs) {
        if (log.topics.length === 4) {
          const from = `0x${log.topics[1].slice(26)}`
          if (from === '0x0000000000000000000000000000000000000000') {
            tokenIds.push(BigInt(log.topics[3]).toString())
          }
        }
      }

      return text({
        status:      mintReceipt.status,
        minted:      quantity,
        ashBurned:   fmtAsh(totalCost),
        tokenIds,
        wallet:      account.address,
        approvalTx:  approveHash ?? 'not needed — allowance was sufficient',
        mintTx:      mintHash,
        etherscan:   `https://etherscan.io/tx/${mintHash}`,
        opensea:     tokenIds.map(id => `https://opensea.io/assets/ethereum/${ASHFIELDS}/${id}`),
      })
    }

    /* ── trigger_distribute ────────────────────────────────────────── */
    if (name === 'trigger_distribute') {
      const { walletClient } = getWalletClients()
      const hash = await walletClient.writeContract({
        address: DISTRIBUTOR, abi: DISTRIBUTOR_ABI, functionName: 'distribute',
        gas: 300_000n,
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      return text({
        status:    receipt.status,
        txHash:    hash,
        etherscan: `https://etherscan.io/tx/${hash}`,
        note:      'ETH split: 1% creator · 1% ASH team · 8% Uniswap buyback → 0xdead burn',
      })
    }

    throw new Error(`Unknown tool: ${name}`)

  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    }
  }
})

/* ── Helpers ────────────────────────────────────────────────────────── */
function text(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] }
}

/* ── Start ──────────────────────────────────────────────────────────── */
const transport = new StdioServerTransport()
await server.connect(transport)
