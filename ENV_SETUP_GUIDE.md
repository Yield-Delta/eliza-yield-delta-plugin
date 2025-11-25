# Environment Setup Guide - Fix Portfolio Query Error

## The Problem

You're seeing this error:
```
Error: VaultProvider not properly initialized
```

This happens because the plugin needs the **CUSTOMER_DASHBOARD_ADDRESS** environment variable to query portfolios, but it's not set in your Kairos agent's `.env` file.

## The Solution

Add the required contract addresses to your **Kairos agent's .env file** (NOT this plugin's directory).

---

## Required Environment Variables

### Location: `/path/to/your/kairos-agent/.env`

```bash
# ============================================
# SEI Yield Delta Plugin Configuration
# ============================================

# Network Configuration (choose one)
SEI_NETWORK=sei-testnet
# OR for mainnet: SEI_NETWORK=sei-mainnet

# ⚠️ REQUIRED for portfolio queries
CUSTOMER_DASHBOARD_ADDRESS=0xYourCustomerDashboardContractAddress

# Optional: Vault Factory (for listing all vaults)
VAULT_FACTORY_ADDRESS=0xYourVaultFactoryAddress

# Optional: Individual Vault Addresses
# Only add the vaults you've actually deployed

# Core Vaults
DELTA_NEUTRAL_VAULT_ADDRESS=0x...
STABLE_MAX_VAULT_ADDRESS=0x...
SEI_HYPERGROWTH_VAULT_ADDRESS=0x...

# Additional Vaults
BLUE_CHIP_VAULT_ADDRESS=0x...
HEDGE_VAULT_ADDRESS=0x...
YIELD_FARMING_VAULT_ADDRESS=0x...
ARBITRAGE_VAULT_ADDRESS=0x...
CONCENTRATED_LIQUIDITY_VAULT_ADDRESS=0x...

# Single-Asset Vaults
SEI_VAULT_ADDRESS=0x...
USDC_VAULT_ADDRESS=0xcF796aEDcC293db74829e77df7c26F482c9dBEC0  # Your USDC vault
```

---

## Step-by-Step Fix

### Step 1: Find Your Kairos Agent's .env File

```bash
# Navigate to your Kairos agent directory
cd /path/to/kairos-agent

# Check if .env exists
ls -la .env

# If it doesn't exist, create it
touch .env
```

### Step 2: Add the Customer Dashboard Address

You **MUST** have this contract deployed and its address. If you don't have it yet, you need to:

1. Deploy the `CustomerDashboard` contract
2. Get its contract address
3. Add it to your `.env` file

```bash
# In your Kairos agent's .env file
CUSTOMER_DASHBOARD_ADDRESS=0xYourActualDashboardAddress
```

### Step 3: Restart Kairos Agent

```bash
# Stop the current instance (Ctrl+C if running)

# Restart it
npm run dev
# or
pnpm start
```

### Step 4: Check the Logs on Startup

You should now see detailed initialization logs:

```
=== VaultProvider Initialization Started ===
Network: sei-testnet
RPC URL: https://evm-rpc-testnet.sei-apis.com
Public client created successfully
Vault Factory Address from env: NOT SET
Customer Dashboard Address from env: 0xYourActualDashboardAddress
Configured vaults: usdc
✅ VaultProvider initialized successfully
   Network: sei-testnet
   Factory: NOT SET
   Dashboard: 0xYourActualDashboardAddress
===========================================
```

### Step 5: Test the Portfolio Query Again

Send this message to Kairos:
```
what is my portfolio amount given this address 0xa932b7d4c4dab93a11fe2aff873534bc4d2c6ae0
```

You should now see:
```
[PORTFOLIO_QUERY] Validating message: "what is my portfolio amount..."
[PORTFOLIO_QUERY] Has address: true
[PORTFOLIO_QUERY] Validation result: true
Portfolio Query Action triggered
Message text: "what is my portfolio amount given this address 0xa932b7d4c4dab93a11fe2aff873534bc4d2c6ae0"
Extracted address from message: 0xa932b7d4c4dab93a11fe2aff873534bc4d2c6ae0
Fetching portfolio for address: 0xa932b7d4c4dab93a11fe2aff873534bc4d2c6ae0 (provided address)
Calling vaultProvider.getCustomerPortfolio with address: 0xa932b7d4c4dab93a11fe2aff873534bc4d2c6ae0
Portfolio query returned 0 positions
```

---

## Common Issues & Solutions

### Issue 1: Still getting "not properly initialized"

**Check:**
- Did you add the address to the **Kairos agent's** .env (not the plugin's)?
- Did you restart Kairos after adding it?
- Is the address a valid Ethereum address (0x followed by 40 hex characters)?

**Solution:**
```bash
# In Kairos agent directory
cat .env | grep CUSTOMER_DASHBOARD

# Should output:
# CUSTOMER_DASHBOARD_ADDRESS=0x...
```

### Issue 2: "Portfolio query returned 0 positions"

This is **GOOD** - it means the plugin is working! The address just doesn't have any vault positions yet.

**What this means:**
- ✅ Plugin is properly initialized
- ✅ Successfully connected to the contract
- ✅ The wallet address `0xa932b7d4...` has no deposits in any vaults

### Issue 3: Missing contract address

**Error:**
```
Error: CUSTOMER_DASHBOARD_ADDRESS is not set in environment variables
```

**Solution:**
1. Deploy the CustomerDashboard contract to Sei testnet
2. Copy the deployed contract address
3. Add it to `.env`:
```bash
CUSTOMER_DASHBOARD_ADDRESS=0xYourDeployedContractAddress
```

### Issue 4: Wrong network

**Symptoms:**
- Portfolio queries return errors
- Contract calls fail

**Solution:**
Make sure `SEI_NETWORK` matches where your contracts are deployed:
```bash
# For testnet contracts:
SEI_NETWORK=sei-testnet

# For mainnet contracts:
SEI_NETWORK=sei-mainnet
```

---

## Quick Test Script

Create this file to test your setup:

```bash
# test-env.sh
#!/bin/bash

echo "Checking Kairos Agent Environment..."
echo ""

if [ -f .env ]; then
    echo "✅ .env file exists"
else
    echo "❌ .env file NOT found!"
    exit 1
fi

if grep -q "CUSTOMER_DASHBOARD_ADDRESS" .env; then
    ADDR=$(grep "CUSTOMER_DASHBOARD_ADDRESS" .env | cut -d '=' -f2)
    if [ -z "$ADDR" ]; then
        echo "❌ CUSTOMER_DASHBOARD_ADDRESS is empty"
    else
        echo "✅ CUSTOMER_DASHBOARD_ADDRESS is set: $ADDR"
    fi
else
    echo "❌ CUSTOMER_DASHBOARD_ADDRESS not found in .env"
fi

if grep -q "SEI_NETWORK" .env; then
    NETWORK=$(grep "SEI_NETWORK" .env | cut -d '=' -f2)
    echo "✅ SEI_NETWORK is set: $NETWORK"
else
    echo "⚠️  SEI_NETWORK not set (will default to sei-mainnet)"
fi

echo ""
echo "Done!"
```

Run it:
```bash
chmod +x test-env.sh
./test-env.sh
```

---

## Example .env File (Testnet)

```bash
# Kairos Agent .env - Testnet Configuration

# SEI Network
SEI_NETWORK=sei-testnet
SEI_RPC_URL=https://evm-rpc-testnet.sei-apis.com

# ⚠️ REQUIRED CONTRACT ADDRESSES
CUSTOMER_DASHBOARD_ADDRESS=0x1234567890123456789012345678901234567890

# Optional Vault Addresses
VAULT_FACTORY_ADDRESS=0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
USDC_VAULT_ADDRESS=0xcF796aEDcC293db74829e77df7c26F482c9dBEC0

# Add other vault addresses as you deploy them
# DELTA_NEUTRAL_VAULT_ADDRESS=0x...
# STABLE_MAX_VAULT_ADDRESS=0x...
```

---

## After Setup

Once properly configured, you'll be able to:

✅ Query any wallet's portfolio with an address
✅ Check your own portfolio (if agent wallet is configured)
✅ See vault holdings, balances, and gains
✅ Check withdrawal status and lock times

Example queries that will work:
- `what is my portfolio amount given this address 0xa932b7d4...`
- `check holdings for 0xa932b7d4...`
- `show portfolio for 0xa932b7d4...`
- `how much do I have in my portfolio?` (uses agent's wallet)

---

## Need Help?

If you're still having issues:

1. **Check the full startup logs** - Look for the initialization section
2. **Verify contract is deployed** - Make sure the dashboard contract exists on your chosen network
3. **Test with a known address** - Use an address you know has vault positions
4. **Check the RPC connection** - Ensure you can connect to the Sei network

**Still stuck?** Share the full initialization logs (from `=== VaultProvider Initialization Started ===` to the end) and I can help debug further!
