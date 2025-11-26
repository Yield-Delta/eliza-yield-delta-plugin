# Portfolio Query Fix - Testing Guide

## Changes Made

### 1. Updated Vault Provider (`src/providers/vault-provider.ts`)

**Key Changes:**
- ✅ Updated `getCustomerPortfolioDirectly()` to use `getCustomerStats` instead of just `balanceOf`
- ✅ Added vault-specific decimal handling (18 for SEI, 6 for USDC)
- ✅ Fixed P&L calculation to include withdrawals: `unrealizedGains = (currentValue + withdrawn) - deposited`
- ✅ Added comprehensive logging for debugging

**Decimal Configuration:**
```typescript
const vaultConfigs: Record<string, { decimals: number }> = {
    [VaultName.SEI]: { decimals: 18 },
    [VaultName.USDC]: { decimals: 6 },
    // Defaults to 18 for other vaults
};
```

### 2. Updated Environment Configuration (`.env.example`)

**Updated Vault Addresses (Nov 26, 2024):**
```env
# Native SEI Vault
SEI_VAULT_ADDRESS=0x1ec7d0E455c0Ca2Ed4F2c27bc8F7E3542eeD6565

# USDC Stable Vault
USDC_VAULT_ADDRESS=0xbCB883594435D92395fA72D87845f87BE78d202E
```

## How to Test

### Setup

1. **Copy `.env.example` to `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Ensure the following are set in your `.env`:**
   ```env
   SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com
   SEI_NETWORK=testnet
   SEI_VAULT_ADDRESS=0x1ec7d0E455c0Ca2Ed4F2c27bc8F7E3542eeD6565
   USDC_VAULT_ADDRESS=0xbCB883594435D92395fA72D87845f87BE78d202E
   ```

3. **Build the plugin:**
   ```bash
   npm run build
   ```

### Test Cases

#### Test 1: Query Portfolio for Address with Positions

**Test Address:** `0xA932b7D4c4Dab93A11Fe2AFF873534Bc4D2c6aE0`

This address should have:
- Native SEI Vault: ~3 SEI
- USDC Vault: ~1 USDC

**Expected Output:**
```
Your Yield Delta Portfolio:

Total Value: 4.00

Positions:
• SEI Vault: 3 shares (3.00) +0.00 gains ✓ Can withdraw
• USDC Vault: 1 shares (1.00) +0.00 gains ✓ Can withdraw

Total Unrealized Gains: +0.00

All your positions are available for withdrawal.
```

**Test Query:**
```
"What's my portfolio?" (if agent wallet is set to test address)
OR
"Check holdings for 0xA932b7D4c4Dab93A11Fe2AFF873534Bc4D2c6aE0"
```

#### Test 2: Query Portfolio for Address with No Positions

**Test with a random address that has no deposits**

**Expected Output:**
```
Address 0x1234...5678 doesn't have any positions in Yield Delta vaults.
```

### Debugging

If you encounter errors, check the logs for:

1. **Vault Provider Initialization:**
   ```
   === VaultProvider Initialization Started ===
   Network: testnet
   RPC URL: https://evm-rpc-testnet.sei-apis.com
   Configured vaults: sei, usdc
   ✅ VaultProvider initialized successfully
   ```

2. **Direct Query Process:**
   ```
   Querying vaults directly for 0xA932...6aE0...
   Checking sei at 0x1ec7...6565...
   Using 18 decimals for sei
   Found position in SEI Vault: 3 shares, value: 3, P&L: +0
   Checking usdc at 0xbCB8...202E...
   Using 6 decimals for usdc
   Found position in USDC Vault: 1 shares, value: 1, P&L: +0
   Direct query complete: found 2 positions
   ```

3. **Common Errors and Solutions:**

   **Error:** "Contract function ... reverted"
   - **Cause:** Wrong vault address or vault doesn't have `getCustomerStats` function
   - **Solution:** Verify vault addresses are correct

   **Error:** "Position shows wrong value"
   - **Cause:** Using wrong decimals
   - **Solution:** Verify decimals configuration in vault-provider.ts line 242-247

   **Error:** "Negative P&L when should be positive"
   - **Cause:** P&L calculation not including withdrawals
   - **Solution:** Already fixed in line 299-300

## Verification Checklist

- [x] Vault addresses updated to new deployments (Nov 26, 2024)
- [x] SEI vault uses 18 decimals
- [x] USDC vault uses 6 decimals
- [x] P&L calculation includes withdrawals
- [x] `getCustomerStats` ABI added and used
- [x] Error handling for individual vault failures
- [x] Logging for debugging
- [x] Build succeeds without errors

## Contract Interaction Details

### getCustomerStats Function

The vault contract's `getCustomerStats` function returns:
```solidity
function getCustomerStats(address customer) external view returns (
    uint256 shares,           // User's share balance
    uint256 shareValue,       // Current value of shares
    uint256 totalDeposited,   // Total amount deposited
    uint256 totalWithdrawn,   // Total amount withdrawn
    uint256 depositTime,      // First deposit timestamp
    uint256 lockTimeRemaining // Lock time remaining in seconds
)
```

### P&L Calculation

```typescript
// Correct P&L formula (implemented)
const totalValue = currentValue + withdrawn;
const unrealizedGains = totalValue - deposited;

// Example:
// deposited = 10, withdrawn = 5, currentValue = 8
// totalValue = 8 + 5 = 13
// unrealizedGains = 13 - 10 = +3 (gain)
```

## Next Steps

1. Test with the provided address: `0xA932b7D4c4Dab93A11Fe2AFF873534Bc4D2c6aE0`
2. Verify the output matches expected results
3. If successful, test with other addresses
4. Monitor logs for any unexpected errors

## Vault Details

### Native SEI Vault
- **Address:** `0x1ec7d0E455c0Ca2Ed4F2c27bc8F7E3542eeD6565`
- **Name:** SEI Vault
- **Strategy:** Concentrated Liquidity
- **Token:** Native SEI
- **Decimals:** 18

### USDC Stable Vault
- **Address:** `0xbCB883594435D92395fA72D87845f87BE78d202E`
- **Name:** USDC Vault
- **Strategy:** Stable Max
- **Token:** USDC
- **Token Address:** `0x4fCF1784B31630811181f670Aea7A7bEF803eaED`
- **Decimals:** 6

## OLD Addresses (DO NOT USE)

These are the old vault addresses that should NOT be used:
- ❌ `0xcF796aEDcC293db74829e77df7c26F482c9dBEC0` - OLD USDC vault
- ❌ `0xD460d6C569631A1BDc6FAF28D47BF376aFDD90D0` - OLD SEI vault
