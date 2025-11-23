import {
    createPublicClient,
    http,
    formatUnits,
    type Address,
    type PublicClient
} from "viem";
import {
    type IAgentRuntime,
    type Provider,
    type Memory,
    type State,
    elizaLogger
} from "@elizaos/core";
import NodeCache from "node-cache";
import * as viemChains from "viem/chains";

import {
    VaultInfo,
    Position,
    CustomerPortfolio,
    VaultMetrics,
    YieldHistory,
    ProjectedReturns,
    DepositRatio,
    FormattedVaultInfo,
    FormattedPosition,
    FormattedCustomerPortfolio,
    FormattedVaultMetrics,
    FormattedYieldHistory,
    FormattedProjectedReturns,
    FormattedDepositRatio,
    VaultName,
    VaultDisplayNames,
    VaultAddressMap,
    STRATEGY_VAULT_ABI,
    CUSTOMER_DASHBOARD_ABI,
    VAULT_FACTORY_ABI,
    matchVaultName
} from "../types/vault";

// Cache TTL in seconds
const DEFAULT_CACHE_TTL = 30;
const LONG_CACHE_TTL = 300; // 5 minutes for less volatile data

export class VaultProvider {
    name = "VAULT_PROVIDER";
    description = "Provides access to Yield Delta vault data including portfolio, metrics, and projections";

    private cache: NodeCache;
    private publicClient: PublicClient | null = null;
    private vaultFactoryAddress: Address | null = null;
    private customerDashboardAddress: Address | null = null;
    private vaultAddresses: VaultAddressMap = {};
    private initialized = false;

    constructor() {
        this.cache = new NodeCache({ stdTTL: DEFAULT_CACHE_TTL });
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        if (this.initialized) return;

        try {
            // Get network configuration
            const network = runtime.getSetting("SEI_NETWORK") || "sei-mainnet";
            const rpcUrl = runtime.getSetting("SEI_RPC_URL") || this.getDefaultRpcUrl(network);

            // Create public client
            const chain = this.getChainForNetwork(network);
            this.publicClient = createPublicClient({
                chain,
                transport: http(rpcUrl)
            });

            // Load contract addresses from environment
            this.vaultFactoryAddress = runtime.getSetting("VAULT_FACTORY_ADDRESS") as Address;
            this.customerDashboardAddress = runtime.getSetting("CUSTOMER_DASHBOARD_ADDRESS") as Address;

            // Load individual vault addresses
            this.vaultAddresses = {
                [VaultName.DELTA_NEUTRAL]: runtime.getSetting("DELTA_NEUTRAL_VAULT_ADDRESS") as Address,
                [VaultName.STABLE_MAX]: runtime.getSetting("STABLE_MAX_VAULT_ADDRESS") as Address,
                [VaultName.SEI_HYPERGROWTH]: runtime.getSetting("SEI_HYPERGROWTH_VAULT_ADDRESS") as Address,
                [VaultName.BLUE_CHIP]: runtime.getSetting("BLUE_CHIP_VAULT_ADDRESS") as Address,
                [VaultName.HEDGE]: runtime.getSetting("HEDGE_VAULT_ADDRESS") as Address,
                [VaultName.YIELD_FARMING]: runtime.getSetting("YIELD_FARMING_VAULT_ADDRESS") as Address,
                [VaultName.ARBITRAGE]: runtime.getSetting("ARBITRAGE_VAULT_ADDRESS") as Address,
                [VaultName.CONCENTRATED_LIQUIDITY]: runtime.getSetting("CONCENTRATED_LIQUIDITY_VAULT_ADDRESS") as Address,
                [VaultName.SEI]: runtime.getSetting("SEI_VAULT_ADDRESS") as Address,
                [VaultName.USDC]: runtime.getSetting("USDC_VAULT_ADDRESS") as Address
            };

            this.initialized = true;
            elizaLogger.info(`VaultProvider initialized - Network: ${network}, Factory: ${this.vaultFactoryAddress}, Dashboard: ${this.customerDashboardAddress}`);
        } catch (error) {
            elizaLogger.error(`Failed to initialize VaultProvider: ${error}`);
            throw error;
        }
    }

    private getDefaultRpcUrl(network: string): string {
        switch (network) {
            case "sei-mainnet":
                return "https://evm-rpc.sei-apis.com";
            case "sei-testnet":
                return "https://evm-rpc-testnet.sei-apis.com";
            case "sei-devnet":
                return "https://evm-rpc-arctic-1.sei-apis.com";
            default:
                return "https://evm-rpc.sei-apis.com";
        }
    }

    private getChainForNetwork(network: string) {
        switch (network) {
            case "sei-mainnet":
                return viemChains.sei;
            case "sei-testnet":
                return viemChains.seiTestnet;
            case "sei-devnet":
                return viemChains.seiDevnet;
            default:
                return viemChains.sei;
        }
    }

    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        _state?: State
    ): Promise<string> {
        await this.initialize(runtime);
        return `Vault provider ready. Available vaults: ${Object.values(VaultDisplayNames).join(", ")}`;
    }

    // Get vault address by name
    getVaultAddress(vaultName: VaultName | string): Address | null {
        if (typeof vaultName === "string") {
            const matched = matchVaultName(vaultName);
            if (!matched) return null;
            return this.vaultAddresses[matched] || null;
        }
        return this.vaultAddresses[vaultName] || null;
    }

    // Get customer portfolio from dashboard contract
    async getCustomerPortfolio(
        runtime: IAgentRuntime,
        customerAddress: Address
    ): Promise<FormattedCustomerPortfolio[]> {
        await this.initialize(runtime);

        const cacheKey = `portfolio:${customerAddress}`;
        const cached = this.cache.get<FormattedCustomerPortfolio[]>(cacheKey);
        if (cached) return cached;

        if (!this.publicClient || !this.customerDashboardAddress) {
            throw new Error("VaultProvider not properly initialized");
        }

        try {
            const portfolios = await this.publicClient.readContract({
                address: this.customerDashboardAddress,
                abi: CUSTOMER_DASHBOARD_ABI,
                functionName: "getCustomerPortfolio",
                args: [customerAddress]
            }) as CustomerPortfolio[];

            const formatted: FormattedCustomerPortfolio[] = portfolios.map(p => ({
                vaultAddress: p.vaultAddress,
                vaultName: p.vaultName,
                shareBalance: Number(formatUnits(p.shareBalance, 18)),
                shareValue: Number(formatUnits(p.shareValue, 6)), // USDC decimals
                totalDeposited: Number(formatUnits(p.totalDeposited, 6)),
                totalWithdrawn: Number(formatUnits(p.totalWithdrawn, 6)),
                unrealizedGains: Number(formatUnits(p.unrealizedGains, 6)),
                depositTimestamp: Number(p.depositTimestamp),
                lockTimeRemaining: Number(p.lockTimeRemaining),
                canWithdraw: p.canWithdraw
            }));

            this.cache.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            elizaLogger.error(`Failed to get customer portfolio for ${customerAddress}: ${error}`);
            throw error;
        }
    }

    // Get vault metrics from dashboard contract
    async getVaultMetrics(
        runtime: IAgentRuntime,
        vaultAddress: Address
    ): Promise<FormattedVaultMetrics> {
        await this.initialize(runtime);

        const cacheKey = `metrics:${vaultAddress}`;
        const cached = this.cache.get<FormattedVaultMetrics>(cacheKey);
        if (cached) return cached;

        if (!this.publicClient || !this.customerDashboardAddress) {
            throw new Error("VaultProvider not properly initialized");
        }

        try {
            const metrics = await this.publicClient.readContract({
                address: this.customerDashboardAddress,
                abi: CUSTOMER_DASHBOARD_ABI,
                functionName: "getVaultMetrics",
                args: [vaultAddress]
            }) as VaultMetrics;

            const formatted: FormattedVaultMetrics = {
                totalValueLocked: Number(formatUnits(metrics.totalValueLocked, 6)),
                totalShares: Number(formatUnits(metrics.totalShares, 18)),
                pricePerShare: Number(formatUnits(metrics.pricePerShare, 6)),
                apy: Number(metrics.apy) / 100, // Basis points to percentage
                totalYieldGenerated: Number(formatUnits(metrics.totalYieldGenerated, 6)),
                managementFeeRate: Number(metrics.managementFeeRate) / 100,
                performanceFeeRate: Number(metrics.performanceFeeRate) / 100,
                withdrawalFeeRate: Number(metrics.withdrawalFeeRate) / 100
            };

            this.cache.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            elizaLogger.error(`Failed to get vault metrics for ${vaultAddress}: ${error}`);
            throw error;
        }
    }

    // Get vault info from vault contract
    async getVaultInfo(
        runtime: IAgentRuntime,
        vaultAddress: Address
    ): Promise<FormattedVaultInfo> {
        await this.initialize(runtime);

        const cacheKey = `info:${vaultAddress}`;
        const cached = this.cache.get<FormattedVaultInfo>(cacheKey);
        if (cached) return cached;

        if (!this.publicClient) {
            throw new Error("VaultProvider not properly initialized");
        }

        try {
            const info = await this.publicClient.readContract({
                address: vaultAddress,
                abi: STRATEGY_VAULT_ABI,
                functionName: "getVaultInfo"
            }) as VaultInfo;

            const formatted: FormattedVaultInfo = {
                name: info.name,
                strategy: info.strategy,
                token0: info.token0,
                token1: info.token1,
                poolFee: info.poolFee,
                totalSupply: Number(formatUnits(info.totalSupply, 18)),
                totalValueLocked: Number(formatUnits(info.totalValueLocked, 6)),
                isActive: info.isActive
            };

            this.cache.set(cacheKey, formatted, LONG_CACHE_TTL);
            return formatted;
        } catch (error) {
            elizaLogger.error(`Failed to get vault info for ${vaultAddress}: ${error}`);
            throw error;
        }
    }

    // Get current position from vault contract
    async getCurrentPosition(
        runtime: IAgentRuntime,
        vaultAddress: Address
    ): Promise<FormattedPosition> {
        await this.initialize(runtime);

        const cacheKey = `position:${vaultAddress}`;
        const cached = this.cache.get<FormattedPosition>(cacheKey);
        if (cached) return cached;

        if (!this.publicClient) {
            throw new Error("VaultProvider not properly initialized");
        }

        try {
            const position = await this.publicClient.readContract({
                address: vaultAddress,
                abi: STRATEGY_VAULT_ABI,
                functionName: "getCurrentPosition"
            }) as Position;

            // Convert ticks to prices (simplified - actual formula depends on token decimals)
            const tickToPrice = (tick: number): number => {
                return Math.pow(1.0001, tick);
            };

            const formatted: FormattedPosition = {
                tickLower: position.tickLower,
                tickUpper: position.tickUpper,
                liquidity: Number(position.liquidity),
                tokensOwed0: Number(formatUnits(position.tokensOwed0, 18)), // SEI decimals
                tokensOwed1: Number(formatUnits(position.tokensOwed1, 6)), // USDC decimals
                priceLower: tickToPrice(position.tickLower),
                priceUpper: tickToPrice(position.tickUpper),
                currentPrice: tickToPrice((position.tickLower + position.tickUpper) / 2)
            };

            this.cache.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            elizaLogger.error(`Failed to get current position for ${vaultAddress}: ${error}`);
            throw error;
        }
    }

    // Get yield history from dashboard contract
    async getYieldHistory(
        runtime: IAgentRuntime,
        vaultAddress: Address,
        fromTimestamp: number = 0
    ): Promise<FormattedYieldHistory[]> {
        await this.initialize(runtime);

        const cacheKey = `history:${vaultAddress}:${fromTimestamp}`;
        const cached = this.cache.get<FormattedYieldHistory[]>(cacheKey);
        if (cached) return cached;

        if (!this.publicClient || !this.customerDashboardAddress) {
            throw new Error("VaultProvider not properly initialized");
        }

        try {
            const history = await this.publicClient.readContract({
                address: this.customerDashboardAddress,
                abi: CUSTOMER_DASHBOARD_ABI,
                functionName: "getYieldHistory",
                args: [vaultAddress, BigInt(fromTimestamp)]
            }) as YieldHistory[];

            const formatted: FormattedYieldHistory[] = history.map(h => ({
                timestamp: Number(h.timestamp),
                totalValue: Number(formatUnits(h.totalValue, 6)),
                yieldGenerated: Number(formatUnits(h.yieldGenerated, 6)),
                apy: Number(h.apy) / 100
            }));

            this.cache.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            elizaLogger.error(`Failed to get yield history for ${vaultAddress}: ${error}`);
            throw error;
        }
    }

    // Calculate projected returns from dashboard contract
    async calculateProjectedReturns(
        runtime: IAgentRuntime,
        vaultAddress: Address,
        depositAmount: number,
        daysHeld: number
    ): Promise<FormattedProjectedReturns> {
        await this.initialize(runtime);

        const cacheKey = `projection:${vaultAddress}:${depositAmount}:${daysHeld}`;
        const cached = this.cache.get<FormattedProjectedReturns>(cacheKey);
        if (cached) return cached;

        if (!this.publicClient || !this.customerDashboardAddress) {
            throw new Error("VaultProvider not properly initialized");
        }

        try {
            // Convert deposit amount to contract format (6 decimals for USDC)
            const depositAmountBigInt = BigInt(Math.floor(depositAmount * 1e6));

            const [projectedValue, projectedYield, managementFees, withdrawalFees] = await this.publicClient.readContract({
                address: this.customerDashboardAddress,
                abi: CUSTOMER_DASHBOARD_ABI,
                functionName: "calculateProjectedReturns",
                args: [vaultAddress, depositAmountBigInt, BigInt(daysHeld)]
            }) as [bigint, bigint, bigint, bigint];

            const formatted: FormattedProjectedReturns = {
                projectedValue: Number(formatUnits(projectedValue, 6)),
                projectedYield: Number(formatUnits(projectedYield, 6)),
                managementFees: Number(formatUnits(managementFees, 6)),
                withdrawalFees: Number(formatUnits(withdrawalFees, 6)),
                depositAmount,
                daysHeld
            };

            this.cache.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            elizaLogger.error(`Failed to calculate projected returns for ${vaultAddress} (amount: ${depositAmount}, days: ${daysHeld}): ${error}`);
            throw error;
        }
    }

    // Get optimal deposit ratio from dashboard contract
    async getOptimalDepositRatio(
        runtime: IAgentRuntime,
        vaultAddress: Address
    ): Promise<FormattedDepositRatio> {
        await this.initialize(runtime);

        const cacheKey = `ratio:${vaultAddress}`;
        const cached = this.cache.get<FormattedDepositRatio>(cacheKey);
        if (cached) return cached;

        if (!this.publicClient || !this.customerDashboardAddress) {
            throw new Error("VaultProvider not properly initialized");
        }

        try {
            const [token0Ratio, token1Ratio, currentPrice] = await this.publicClient.readContract({
                address: this.customerDashboardAddress,
                abi: CUSTOMER_DASHBOARD_ABI,
                functionName: "getOptimalDepositRatio",
                args: [vaultAddress]
            }) as [bigint, bigint, bigint];

            const formatted: FormattedDepositRatio = {
                token0Ratio: Number(token0Ratio) / 100, // Percentage
                token1Ratio: Number(token1Ratio) / 100,
                currentPrice: Number(formatUnits(currentPrice, 6))
            };

            this.cache.set(cacheKey, formatted);
            return formatted;
        } catch (error) {
            elizaLogger.error(`Failed to get optimal deposit ratio for ${vaultAddress}: ${error}`);
            throw error;
        }
    }

    // Get all vaults from factory or config
    async getAllVaults(runtime: IAgentRuntime): Promise<FormattedVaultInfo[]> {
        await this.initialize(runtime);

        const cacheKey = "allVaults";
        const cached = this.cache.get<FormattedVaultInfo[]>(cacheKey);
        if (cached) return cached;

        const vaults: FormattedVaultInfo[] = [];

        // Get vaults from configured addresses
        for (const [name, address] of Object.entries(this.vaultAddresses)) {
            if (address) {
                try {
                    const info = await this.getVaultInfo(runtime, address);
                    vaults.push(info);
                } catch (error) {
                    elizaLogger.warn(`Failed to get info for vault ${name}: ${error}`);
                }
            }
        }

        // If we have a factory, also try to get vaults from there
        if (this.vaultFactoryAddress && this.publicClient) {
            try {
                const factoryVaults = await this.publicClient.readContract({
                    address: this.vaultFactoryAddress,
                    abi: VAULT_FACTORY_ABI,
                    functionName: "getAllVaults"
                }) as Address[];

                for (const vaultAddress of factoryVaults) {
                    // Check if we already have this vault
                    const exists = vaults.some(v =>
                        Object.values(this.vaultAddresses).includes(vaultAddress as Address)
                    );

                    if (!exists) {
                        try {
                            const info = await this.getVaultInfo(runtime, vaultAddress);
                            vaults.push(info);
                        } catch (error) {
                            elizaLogger.warn(`Failed to get info for vault ${vaultAddress}: ${error}`);
                        }
                    }
                }
            } catch (error) {
                elizaLogger.warn(`Failed to get vaults from factory: ${error}`);
            }
        }

        this.cache.set(cacheKey, vaults, LONG_CACHE_TTL);
        return vaults;
    }

    // Helper to get vault metrics by name
    async getVaultMetricsByName(
        runtime: IAgentRuntime,
        vaultName: string
    ): Promise<FormattedVaultMetrics | null> {
        const address = this.getVaultAddress(vaultName);
        if (!address) {
            elizaLogger.warn(`Vault not found: ${vaultName}`);
            return null;
        }
        return this.getVaultMetrics(runtime, address);
    }

    // Helper to get vault info by name
    async getVaultInfoByName(
        runtime: IAgentRuntime,
        vaultName: string
    ): Promise<FormattedVaultInfo | null> {
        const address = this.getVaultAddress(vaultName);
        if (!address) {
            elizaLogger.warn(`Vault not found: ${vaultName}`);
            return null;
        }
        return this.getVaultInfo(runtime, address);
    }

    // Clear cache
    clearCache(): void {
        this.cache.flushAll();
    }
}

// Export singleton instance for ElizaOS
export const vaultProvider = new VaultProvider();
