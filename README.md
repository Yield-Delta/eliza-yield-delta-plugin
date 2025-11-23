# Eliza Yield Delta Plugin

A comprehensive **query interface plugin** for the Yield Delta vault system on SEI blockchain. This plugin enables Eliza agents to query vault portfolios, metrics, yield history, and provide recommendations to users.

> **Note:** This is a **READ-ONLY** plugin for querying vault data. It does not execute deposits, withdrawals, or rebalancing operations.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Available Actions](#available-actions)
- [Providers](#providers)
- [Evaluators](#evaluators)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Yield Delta plugin provides natural language access to vault data for users. It integrates with ElizaOS to enable conversational queries about:

- User portfolio positions and balances
- Vault performance metrics (APY, TVL, fees)
- Historical yield data and trends
- Projected returns calculations
- Optimal deposit recommendations
- Vault health monitoring

### What This Plugin Does

✅ **Query Operations:**
- Check user portfolio across all vaults
- List available vaults with current metrics
- View detailed vault performance
- Analyze historical yields
- Calculate projected returns
- Get optimal deposit ratios
- Monitor vault health status

### What This Plugin Does NOT Do

❌ **Execution Operations:**
- Execute deposits or withdrawals
- Perform rebalancing
- Harvest yield
- Manage strategy allocations
- Execute trades or swaps

*Execution operations should be handled by a separate vault management system.*

---

## Features

### 🎯 Core Capabilities

- **Portfolio Management**: View positions, balances, unrealized gains
- **Vault Discovery**: Browse 10 different vault strategies
- **Performance Analysis**: APY tracking, yield history, trend analysis
- **Return Projections**: Calculate expected returns for any amount/timeframe
- **Deposit Optimization**: Get optimal token ratios for LP positions
- **Health Monitoring**: Automated alerts for vault anomalies

### 🔐 Security

- Read-only operations (no transaction signing)
- Multi-network support (mainnet, testnet, devnet)
- Configurable RPC endpoints
- Private key authentication for queries

### ⚡ Performance

- Intelligent caching (30s-5min TTL)
- Concurrent query support
- Automatic retry logic
- Efficient data formatting

---

## Installation

### Prerequisites

- Node.js >= 18
- ElizaOS >= 1.2.0
- SEI network access

### Install Plugin

```bash
# In your Eliza project
npm install @elizaos/plugin-sei-yield-delta

# Or with pnpm
pnpm add @elizaos/plugin-sei-yield-delta
```

### Add to Eliza Character

```typescript
import { seiYieldDeltaPlugin } from '@elizaos/plugin-sei-yield-delta';

export const character = {
  name: "VaultAssistant",
  plugins: [
    seiYieldDeltaPlugin
  ],
  // ... rest of character config
};
```

---

## Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# ===== REQUIRED =====

# SEI Network Configuration
SEI_NETWORK=sei-testnet              # Options: sei-mainnet, sei-testnet, sei-devnet
SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com
SEI_PRIVATE_KEY=0x...                # Agent wallet private key (for authentication)

# Vault Contract Addresses
VAULT_FACTORY_ADDRESS=0x1ec598666f2a7322a7c954455018e3cfb5a13a99
CUSTOMER_DASHBOARD_ADDRESS=0x...     # Customer dashboard contract

# ===== OPTIONAL =====

# Individual Vault Addresses (can auto-discover via factory)
DELTA_NEUTRAL_VAULT_ADDRESS=0x...
STABLE_MAX_VAULT_ADDRESS=0x...
SEI_HYPERGROWTH_VAULT_ADDRESS=0x...
BLUE_CHIP_VAULT_ADDRESS=0x...
HEDGE_VAULT_ADDRESS=0x...
YIELD_FARMING_VAULT_ADDRESS=0x...
ARBITRAGE_VAULT_ADDRESS=0x...
CONCENTRATED_LIQUIDITY_VAULT_ADDRESS=0x...
SEI_VAULT_ADDRESS=0x1ec7d0E455c0Ca2Ed4F2c27bc8F7E3542eeD6565
USDC_VAULT_ADDRESS=0x...

# Oracle Configuration (for price feeds)
ORACLE_API_KEY=...
YEI_API3_CONTRACT=0x...
YEI_PYTH_CONTRACT=0x...
YEI_REDSTONE_CONTRACT=0x...

# DEX Integration (optional)
DRAGONSWAP_API_URL=https://api.dragonswap.app
SYMPHONY_API_URL=https://api.symphony.finance
```

### Network Configurations

#### SEI Mainnet
```bash
SEI_NETWORK=sei-mainnet
SEI_RPC_URL=https://evm-rpc.sei-apis.com
# Chain ID: 1329
```

#### SEI Testnet (Atlantic-2)
```bash
SEI_NETWORK=sei-testnet
SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com
# Chain ID: 1328
```

#### SEI Devnet
```bash
SEI_NETWORK=sei-devnet
SEI_RPC_URL=https://evm-rpc-arctic-1.sei-apis.com
# Chain ID: 713715
```

---

## Available Actions

### 1. Portfolio Query

Get user's vault portfolio including all positions, balances, and gains.

**Trigger Keywords:**
- "show my portfolio"
- "my vault positions"
- "what's my balance"
- "check my vaults"

**Example Response:**
```
Your Vault Portfolio
====================

Total Value: $12,450.00
Total Deposited: $10,000.00
Unrealized Gains: $2,450.00 (+24.5%)

Positions:
----------

1. SEI Vault
   Shares: 1,000.50
   Value: $5,250.00
   Deposited: $5,000.00
   Gains: $250.00 (+5.0%)
   Lock Status: Unlocked ✅

2. Delta Neutral Vault
   Shares: 500.25
   Value: $7,200.00
   Deposited: $5,000.00
   Gains: $2,200.00 (+44.0%)
   Lock Status: 2 days remaining 🔒
```

---

### 2. Vault List

List all available vaults with key metrics.

**Trigger Keywords:**
- "what vaults are available"
- "list all vaults"
- "show vault options"

**Example Response:**
```
Available Vaults (sorted by APY)
=================================

1. SEI Hypergrowth Vault 🔴 High Risk
   APY: 45.2%
   TVL: $1,250,000
   Strategy: Leveraged SEI exposure

2. Delta Neutral Vault 🟢 Low Risk
   APY: 18.3%
   TVL: $2,100,000
   Strategy: Delta-neutral yield farming
```

---

### 3. Vault Metrics

Get detailed performance metrics for a specific vault.

**Trigger Keywords:**
- "apy for [vault name]"
- "vault stats"
- "[vault name] metrics"

**Example Query:** "What's the APY for the SEI vault?"

---

### 4. Yield History

View historical yield performance and trends.

**Trigger Keywords:**
- "yield history for [vault]"
- "past performance"
- "how has [vault] performed"

---

### 5. Projected Returns

Calculate expected returns for a deposit amount and time period.

**Trigger Keywords:**
- "project returns for [amount]"
- "if I deposit [amount]"
- "returns calculator"

**Example Query:** "If I deposit $5,000 in the stable max vault for 90 days, what will I earn?"

---

### 6. Position Details

Get detailed LP position information (for advanced users).

**Trigger Keywords:**
- "position details"
- "tick range"
- "liquidity details"

---

### 7. Optimal Deposit

Get recommended token ratios for optimal LP efficiency.

**Trigger Keywords:**
- "optimal deposit ratio"
- "how should I deposit"
- "token ratio"

---

## Providers

### VaultProvider

The core provider for all vault data queries.

```typescript
import { vaultProvider } from '@elizaos/plugin-sei-yield-delta';

// Get customer portfolio
const portfolio = await vaultProvider.getCustomerPortfolio(
  runtime,
  "0x..." // customer address
);

// Get vault metrics
const metrics = await vaultProvider.getVaultMetrics(
  runtime,
  "0x..." // vault address
);

// Get all vaults
const vaults = await vaultProvider.getAllVaults(runtime);
```

### OracleProvider

Multi-source price feed provider.

```typescript
import { oracleProvider } from '@elizaos/plugin-sei-yield-delta';

// Get price for a token
const price = await oracleProvider.getPrice(runtime, "SEI");
```

### WalletProvider

SEI wallet management and queries.

```typescript
import { initWalletProvider } from '@elizaos/plugin-sei-yield-delta';

const wallet = await initWalletProvider(runtime);
const address = wallet.getAddress();
const balance = await wallet.getWalletBalance();
```

---

## Evaluators

### Vault Monitor Evaluator

Automated vault health monitoring with alerts.

**Triggers:**
- "monitor vault health"
- "check all vaults"
- "vault status"

**Features:**
- Checks APY against targets (10% min, 15% target)
- Monitors TVL thresholds
- Tracks share price stability
- Classifies vault status: Healthy / Warning / Critical

---

## Usage Examples

### Basic User Queries

```typescript
// Check portfolio
User: "Show me my vault positions"
Agent: [Calls portfolio-query action] → Returns formatted portfolio

// See available vaults
User: "What vaults can I invest in?"
Agent: [Calls vault-list action] → Returns list of 10 vaults

// Check specific vault
User: "What's the APY for the SEI vault?"
Agent: [Calls vault-metrics action] → Returns detailed metrics

// Calculate returns
User: "If I put $10,000 in the delta neutral vault for 6 months, how much will I make?"
Agent: [Calls projected-returns action] → Returns projections
```

---

## API Reference

### Vault Types

```typescript
export enum VaultName {
  DELTA_NEUTRAL = "delta-neutral",
  STABLE_MAX = "stable-max",
  SEI_HYPERGROWTH = "sei-hypergrowth",
  BLUE_CHIP = "blue-chip",
  HEDGE = "hedge",
  YIELD_FARMING = "yield-farming",
  ARBITRAGE = "arbitrage",
  CONCENTRATED_LIQUIDITY = "concentrated-liquidity",
  SEI = "sei",
  USDC = "usdc"
}
```

### Helper Functions

```typescript
// Match vault name from user input
import { matchVaultName } from '@elizaos/plugin-sei-yield-delta';

const vaultName = matchVaultName("delta neutral");
// Returns: VaultName.DELTA_NEUTRAL
```

---

## Testing

### Run Tests

```bash
# Run all tests
pnpm test

# Run specific tests
pnpm test src/providers/vault-provider.test.ts

# Run with coverage
pnpm test:coverage
```

### Manual Testing Checklist

- [ ] Portfolio query returns user positions
- [ ] Vault list shows all 10 vaults
- [ ] Metrics display correct APY/TVL
- [ ] Yield history shows historical data
- [ ] Projected returns calculate correctly
- [ ] Position details show tick ranges
- [ ] Optimal deposit shows current ratios
- [ ] Vault monitor classifies health correctly

---

## Troubleshooting

### Common Issues

#### "VaultProvider not properly initialized"

**Solution:**
```bash
# Ensure these are set in .env
VAULT_FACTORY_ADDRESS=0x...
CUSTOMER_DASHBOARD_ADDRESS=0x...
```

#### "Failed to get customer portfolio"

**Solution:**
- Verify wallet address is correct
- Check SEI_NETWORK matches deployed contracts
- Ensure RPC URL is accessible

#### "No vaults found"

**Solution:**
```bash
# Set VAULT_FACTORY_ADDRESS to auto-discover
VAULT_FACTORY_ADDRESS=0x1ec598666f2a7322a7c954455018e3cfb5a13a99
```

### Debug Mode

Enable verbose logging:

```bash
DEBUG=eliza:vault:*
LOG_LEVEL=debug
```

---

## Plugin Structure

```
eliza-yield-delta-plugin/
├── src/
│   ├── actions/              # 7 query actions
│   │   ├── portfolio-query.ts
│   │   ├── vault-list.ts
│   │   ├── vault-metrics.ts
│   │   ├── yield-history.ts
│   │   ├── projected-returns.ts
│   │   ├── position-details.ts
│   │   └── optimal-deposit.ts
│   │
│   ├── providers/            # Data providers
│   │   ├── vault-provider.ts
│   │   ├── wallet.ts
│   │   ├── sei-oracle.ts
│   │   └── amm-manager.ts
│   │
│   ├── evaluators/           # Background monitors
│   │   ├── vault-monitor.ts
│   │   └── amm-risk.ts
│   │
│   ├── types/                # TypeScript types
│   │   ├── vault.ts
│   │   └── index.ts
│   │
│   ├── environment.ts        # Config & validation
│   └── index.ts              # Plugin exports
```

---

## Development

### Building

```bash
pnpm build
```

### Running in Development

```bash
pnpm run dev
```

### Testing

```bash
pnpm test
```

---

## License

MIT License - see LICENSE file for details

---

## Support

- **Documentation**: See this README and inline code documentation
- **Issues**: Report issues in the repository
- **SEI Docs**: https://docs.sei.io

---

## Version History

### v1.0.0 (Current)
- ✅ Complete vault query interface
- ✅ 7 user-facing actions
- ✅ Vault health monitoring
- ✅ Multi-network support
- ✅ Comprehensive caching
- ✅ Full TypeScript support

---

**Built with ❤️ for the SEI ecosystem**
