# Quick Reference: Environment Variable Configuration

## New Environment Variables

### Oracle Contract Addresses

```bash
# YEI Finance Multi-Oracle Configuration
YEI_API3_CONTRACT=0x2880aB155794e7179c9eE2e38200202908C17B43
YEI_PYTH_CONTRACT=0x2880aB155794e7179c9eE2e38200202908C17B43
YEI_REDSTONE_CONTRACT=0x1111111111111111111111111111111111111111
```

**Used by:** `src/providers/sei-oracle.ts` - SeiOracleProvider

**Purpose:** Configure oracle contract addresses for YEI Finance's multi-oracle price feed system.

**Defaults:** See values above (used if not specified)

---

### Symphony Finance DEX

```bash
# Symphony Finance API Configuration
SYMPHONY_API_URL=https://api.symphony.finance
SYMPHONY_TIMEOUT=10000
```

**Used by:** `src/providers/symphony-dex.ts` - SymphonyDexProvider

**Purpose:** Configure Symphony Finance API endpoint and request timeout.

**Defaults:**
- `SYMPHONY_API_URL`: `https://api.symphony.finance`
- `SYMPHONY_TIMEOUT`: `10000` (milliseconds)

---

## Usage Examples

### Example 1: Default Configuration

```bash
# .env
SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com
SEI_NETWORK=testnet
# No oracle or Symphony config - uses defaults
```

### Example 2: Custom Oracle Addresses

```bash
# .env
SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com
SEI_NETWORK=testnet

# Custom oracle contracts
YEI_API3_CONTRACT=0xNewAPI3Contract0000000000000000000000000000
YEI_PYTH_CONTRACT=0xNewPythContract0000000000000000000000000000
YEI_REDSTONE_CONTRACT=0xNewRedstoneContract000000000000000000000000
```

### Example 3: Custom Symphony Configuration

```bash
# .env
SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com
SEI_NETWORK=testnet

# Custom Symphony API (e.g., for private deployment)
SYMPHONY_API_URL=https://custom-symphony.example.com
SYMPHONY_TIMEOUT=30000
```

### Example 4: Full Custom Configuration

```bash
# .env
SEI_RPC_URL=https://evm-rpc.sei-apis.com
SEI_NETWORK=mainnet

# Custom oracle contracts for mainnet
YEI_API3_CONTRACT=0xMainnetAPI3Contract000000000000000000000000
YEI_PYTH_CONTRACT=0xMainnetPythContract000000000000000000000000
YEI_REDSTONE_CONTRACT=0xMainnetRedstoneContract00000000000000000000

# Custom Symphony configuration
SYMPHONY_API_URL=https://api.symphony.finance
SYMPHONY_TIMEOUT=15000
```

---

## Code Examples

### Using Config in Oracle Provider

```typescript
import { SeiOracleProvider } from '@elizaos/plugin-sei-yield-delta';

// Oracle provider automatically reads environment variables
const oracleProvider = new SeiOracleProvider(runtime);

// Internally uses:
// - YEI_API3_CONTRACT (or default)
// - YEI_PYTH_CONTRACT (or default)
// - YEI_REDSTONE_CONTRACT (or default)
```

### Using Config in Symphony Provider

```typescript
import { SymphonyDexProvider } from '@elizaos/plugin-sei-yield-delta';
import { validateSeiConfig } from '@elizaos/plugin-sei-yield-delta';

// Get config from runtime
const seiConfig = await validateSeiConfig(runtime);

// Create provider with custom config
const symphonyDex = new SymphonyDexProvider({
  network: seiConfig.SEI_NETWORK || 'testnet',
  rpcUrl: seiConfig.SEI_RPC_URL,
  apiUrl: seiConfig.SYMPHONY_API_URL,      // Custom API URL
  timeout: seiConfig.SYMPHONY_TIMEOUT      // Custom timeout
});
```

### Backward Compatible Usage

```typescript
// Old code still works without changes!
const symphonyDex = new SymphonyDexProvider({
  network: 'testnet',
  rpcUrl: 'https://evm-rpc-testnet.sei-apis.com'
  // apiUrl and timeout are optional - uses defaults
});
```

---

## Configuration Priority

1. **Environment Variables** (highest priority)
2. **Runtime Settings** (from validateSeiConfig)
3. **Default Values** (fallback)

---

## When to Update

### Update Oracle Addresses When:
- Oracle contracts are upgraded on SEI network
- Switching between testnet/mainnet/devnet
- Using custom oracle deployments for testing

### Update Symphony Configuration When:
- Symphony API endpoint changes
- Using private Symphony deployment
- Network conditions require different timeouts
- Testing against local Symphony instance

---

## Troubleshooting

### Oracle Provider Not Using Custom Addresses?

1. Check `.env` file has correct variable names
2. Verify addresses are valid Ethereum addresses (0x...)
3. Restart application after changing `.env`
4. Check runtime.getSetting() is returning values

### Symphony Requests Timing Out?

```bash
# Increase timeout in .env
SYMPHONY_TIMEOUT=30000
```

### Symphony API URL Not Working?

1. Verify URL is accessible
2. Check URL format (no trailing slash)
3. Ensure network connectivity to custom endpoint
4. Test with default URL first: `https://api.symphony.finance`

---

## Testing

Run the test script to verify configuration:

```bash
npx ts-node test-env-config.ts
```

Expected output:
```
🧪 Testing Environment Variable Configuration

1️⃣ Test: Default Configuration (No Env Vars)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Config validated successfully
   YEI_API3_CONTRACT: undefined (will use default)
   YEI_PYTH_CONTRACT: undefined (will use default)
   YEI_REDSTONE_CONTRACT: undefined (will use default)
   SYMPHONY_API_URL: undefined (will use default)
   SYMPHONY_TIMEOUT: undefined (will use default)

[... more test output ...]

🎉 All tests passed successfully!
```

---

## Files Modified

- ✅ `src/environment.ts` - Added config fields
- ✅ `src/providers/sei-oracle.ts` - Uses configurable addresses
- ✅ `src/providers/symphony-dex.ts` - Uses configurable API URL/timeout
- ✅ `README.md` - Documentation updated

---

## Related Documentation

- `ENV_CONFIG_CHANGES.md` - Full changelog and technical details
- `README.md` - Plugin usage and setup guide
- `GRAPHQL_INTEGRATION_SUMMARY.md` - DragonSwap GraphQL changes

---

**For full details, see:** `ENV_CONFIG_CHANGES.md`
