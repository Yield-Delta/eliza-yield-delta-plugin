import type { Address } from "viem";

// Vault name enum with all available vaults
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

// Display names for vaults
export const VaultDisplayNames: Record<VaultName, string> = {
    [VaultName.DELTA_NEUTRAL]: "Delta Neutral Vault",
    [VaultName.STABLE_MAX]: "Stable Max Vault",
    [VaultName.SEI_HYPERGROWTH]: "SEI Hypergrowth Vault",
    [VaultName.BLUE_CHIP]: "Blue Chip Vault",
    [VaultName.HEDGE]: "Hedge Vault",
    [VaultName.YIELD_FARMING]: "Yield Farming Vault",
    [VaultName.ARBITRAGE]: "Arbitrage Vault",
    [VaultName.CONCENTRATED_LIQUIDITY]: "Concentrated Liquidity Vault",
    [VaultName.SEI]: "SEI Vault",
    [VaultName.USDC]: "USDC Vault"
};

// Vault strategies descriptions
export const VaultStrategies: Record<VaultName, string> = {
    [VaultName.DELTA_NEUTRAL]: "Delta-neutral yield farming with IL protection",
    [VaultName.STABLE_MAX]: "Stablecoin optimization",
    [VaultName.SEI_HYPERGROWTH]: "Leveraged SEI exposure",
    [VaultName.BLUE_CHIP]: "BTC/ETH diversified yield",
    [VaultName.HEDGE]: "Hedged positions with downside protection",
    [VaultName.YIELD_FARMING]: "Optimized LP farming",
    [VaultName.ARBITRAGE]: "Cross-DEX arbitrage",
    [VaultName.CONCENTRATED_LIQUIDITY]: "Active CL position management",
    [VaultName.SEI]: "Single-sided SEI yield optimization",
    [VaultName.USDC]: "Single-sided USDC yield optimization"
};

// Risk levels for vaults
export type RiskLevel = "Very Low" | "Low" | "Medium" | "Medium-High" | "High";

export const VaultRiskLevels: Record<VaultName, RiskLevel> = {
    [VaultName.DELTA_NEUTRAL]: "Low",
    [VaultName.STABLE_MAX]: "Very Low",
    [VaultName.SEI_HYPERGROWTH]: "High",
    [VaultName.BLUE_CHIP]: "Medium",
    [VaultName.HEDGE]: "Low",
    [VaultName.YIELD_FARMING]: "Medium",
    [VaultName.ARBITRAGE]: "Medium-High",
    [VaultName.CONCENTRATED_LIQUIDITY]: "Medium",
    [VaultName.SEI]: "Medium",
    [VaultName.USDC]: "Very Low"
};

// Matches Solidity struct VaultInfo
export interface VaultInfo {
    name: string;
    strategy: string;
    token0: Address;
    token1: Address;
    poolFee: number;
    totalSupply: bigint;
    totalValueLocked: bigint;
    isActive: boolean;
}

// Matches Solidity struct Position
export interface Position {
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    tokensOwed0: bigint;
    tokensOwed1: bigint;
    feeGrowthInside0LastX128: bigint;
    feeGrowthInside1LastX128: bigint;
}

// Matches Solidity struct CustomerPortfolio
export interface CustomerPortfolio {
    vaultAddress: Address;
    vaultName: string;
    shareBalance: bigint;
    shareValue: bigint;
    totalDeposited: bigint;
    totalWithdrawn: bigint;
    unrealizedGains: bigint;
    depositTimestamp: bigint;
    lockTimeRemaining: bigint;
    canWithdraw: boolean;
}

// Matches Solidity struct VaultMetrics
export interface VaultMetrics {
    totalValueLocked: bigint;
    totalShares: bigint;
    pricePerShare: bigint;
    apy: bigint;
    totalYieldGenerated: bigint;
    managementFeeRate: bigint;
    performanceFeeRate: bigint;
    withdrawalFeeRate: bigint;
}

// Matches Solidity struct YieldHistory
export interface YieldHistory {
    timestamp: bigint;
    totalValue: bigint;
    yieldGenerated: bigint;
    apy: bigint;
}

// Return type for calculateProjectedReturns
export interface ProjectedReturns {
    projectedValue: bigint;
    projectedYield: bigint;
    managementFees: bigint;
    withdrawalFees: bigint;
}

// Return type for getOptimalDepositRatio
export interface DepositRatio {
    token0Ratio: bigint;
    token1Ratio: bigint;
    currentPrice: bigint;
}

// Formatted versions for display (with numbers instead of bigint)
export interface FormattedVaultInfo {
    name: string;
    strategy: string;
    token0: Address;
    token1: Address;
    poolFee: number;
    totalSupply: number;
    totalValueLocked: number;
    isActive: boolean;
}

export interface FormattedPosition {
    tickLower: number;
    tickUpper: number;
    liquidity: number;
    tokensOwed0: number;
    tokensOwed1: number;
    priceLower: number;
    priceUpper: number;
    currentPrice: number;
}

export interface FormattedCustomerPortfolio {
    vaultAddress: Address;
    vaultName: string;
    shareBalance: number;
    shareValue: number;
    totalDeposited: number;
    totalWithdrawn: number;
    unrealizedGains: number;
    depositTimestamp: number;
    lockTimeRemaining: number;
    canWithdraw: boolean;
}

export interface FormattedVaultMetrics {
    totalValueLocked: number;
    totalShares: number;
    pricePerShare: number;
    apy: number;
    totalYieldGenerated: number;
    managementFeeRate: number;
    performanceFeeRate: number;
    withdrawalFeeRate: number;
}

export interface FormattedYieldHistory {
    timestamp: number;
    totalValue: number;
    yieldGenerated: number;
    apy: number;
}

export interface FormattedProjectedReturns {
    projectedValue: number;
    projectedYield: number;
    managementFees: number;
    withdrawalFees: number;
    depositAmount: number;
    daysHeld: number;
}

export interface FormattedDepositRatio {
    token0Ratio: number;
    token1Ratio: number;
    currentPrice: number;
}

// Vault address mapping type
export type VaultAddressMap = Partial<Record<VaultName, Address>>;

// AI Rebalance parameters (for keeper)
export interface AIRebalanceParams {
    vaultAddress: Address;
    targetTickLower: number;
    targetTickUpper: number;
    rebalanceThreshold: number;
    maxSlippage: number;
}

// Type guards for validation
export function isVaultName(value: string): value is VaultName {
    return Object.values(VaultName).includes(value as VaultName);
}

export function isVaultInfo(obj: unknown): obj is VaultInfo {
    if (!obj || typeof obj !== "object") return false;
    const v = obj as Record<string, unknown>;
    return (
        typeof v.name === "string" &&
        typeof v.strategy === "string" &&
        typeof v.token0 === "string" &&
        typeof v.token1 === "string" &&
        typeof v.poolFee === "number" &&
        typeof v.totalSupply === "bigint" &&
        typeof v.totalValueLocked === "bigint" &&
        typeof v.isActive === "boolean"
    );
}

export function isCustomerPortfolio(obj: unknown): obj is CustomerPortfolio {
    if (!obj || typeof obj !== "object") return false;
    const v = obj as Record<string, unknown>;
    return (
        typeof v.vaultAddress === "string" &&
        typeof v.vaultName === "string" &&
        typeof v.shareBalance === "bigint" &&
        typeof v.shareValue === "bigint" &&
        typeof v.canWithdraw === "boolean"
    );
}

export function isVaultMetrics(obj: unknown): obj is VaultMetrics {
    if (!obj || typeof obj !== "object") return false;
    const v = obj as Record<string, unknown>;
    return (
        typeof v.totalValueLocked === "bigint" &&
        typeof v.totalShares === "bigint" &&
        typeof v.pricePerShare === "bigint" &&
        typeof v.apy === "bigint"
    );
}

// Fuzzy vault name matching
const vaultNameAliases: Record<string, VaultName> = {
    // Delta Neutral
    "delta neutral": VaultName.DELTA_NEUTRAL,
    "delta-neutral": VaultName.DELTA_NEUTRAL,
    "deltaneutral": VaultName.DELTA_NEUTRAL,
    "dn": VaultName.DELTA_NEUTRAL,
    "delta": VaultName.DELTA_NEUTRAL,

    // Stable Max
    "stable max": VaultName.STABLE_MAX,
    "stable-max": VaultName.STABLE_MAX,
    "stablemax": VaultName.STABLE_MAX,
    "stable": VaultName.STABLE_MAX,

    // SEI Hypergrowth
    "sei hypergrowth": VaultName.SEI_HYPERGROWTH,
    "sei-hypergrowth": VaultName.SEI_HYPERGROWTH,
    "seihypergrowth": VaultName.SEI_HYPERGROWTH,
    "hypergrowth": VaultName.SEI_HYPERGROWTH,
    "sei growth": VaultName.SEI_HYPERGROWTH,

    // Blue Chip
    "blue chip": VaultName.BLUE_CHIP,
    "blue-chip": VaultName.BLUE_CHIP,
    "bluechip": VaultName.BLUE_CHIP,

    // Hedge
    "hedge": VaultName.HEDGE,
    "hedging": VaultName.HEDGE,
    "hedge vault": VaultName.HEDGE,

    // Yield Farming
    "yield farming": VaultName.YIELD_FARMING,
    "yield-farming": VaultName.YIELD_FARMING,
    "yieldfarming": VaultName.YIELD_FARMING,
    "farming": VaultName.YIELD_FARMING,

    // Arbitrage
    "arbitrage": VaultName.ARBITRAGE,
    "arb": VaultName.ARBITRAGE,
    "arb vault": VaultName.ARBITRAGE,

    // Concentrated Liquidity
    "concentrated liquidity": VaultName.CONCENTRATED_LIQUIDITY,
    "concentrated-liquidity": VaultName.CONCENTRATED_LIQUIDITY,
    "concentratedliquidity": VaultName.CONCENTRATED_LIQUIDITY,
    "cl": VaultName.CONCENTRATED_LIQUIDITY,
    "concentrated": VaultName.CONCENTRATED_LIQUIDITY,

    // SEI Vault
    "sei vault": VaultName.SEI,
    "sei": VaultName.SEI,

    // USDC Vault
    "usdc vault": VaultName.USDC,
    "usdc": VaultName.USDC
};

export function matchVaultName(input: string): VaultName | null {
    const normalized = input.toLowerCase().trim();

    // Direct match
    if (vaultNameAliases[normalized]) {
        return vaultNameAliases[normalized];
    }

    // Partial match
    for (const [alias, vaultName] of Object.entries(vaultNameAliases)) {
        if (normalized.includes(alias) || alias.includes(normalized)) {
            return vaultName;
        }
    }

    return null;
}

// Contract ABIs (partial, for vault interactions)
export const STRATEGY_VAULT_ABI = [
    {
        name: "getVaultInfo",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "name", type: "string" },
                    { name: "strategy", type: "string" },
                    { name: "token0", type: "address" },
                    { name: "token1", type: "address" },
                    { name: "poolFee", type: "uint24" },
                    { name: "totalSupply", type: "uint256" },
                    { name: "totalValueLocked", type: "uint256" },
                    { name: "isActive", type: "bool" }
                ]
            }
        ]
    },
    {
        name: "getCurrentPosition",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "tickLower", type: "int24" },
                    { name: "tickUpper", type: "int24" },
                    { name: "liquidity", type: "uint128" },
                    { name: "tokensOwed0", type: "uint256" },
                    { name: "tokensOwed1", type: "uint256" },
                    { name: "feeGrowthInside0LastX128", type: "uint256" },
                    { name: "feeGrowthInside1LastX128", type: "uint256" }
                ]
            }
        ]
    },
    {
        name: "seiOptimizedDeposit",
        type: "function",
        stateMutability: "payable",
        inputs: [
            { name: "amount", type: "uint256" },
            { name: "receiver", type: "address" }
        ],
        outputs: [{ name: "shares", type: "uint256" }]
    },
    {
        name: "seiOptimizedWithdraw",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "shares", type: "uint256" },
            { name: "receiver", type: "address" }
        ],
        outputs: [{ name: "amount", type: "uint256" }]
    },
    {
        name: "depositYield",
        type: "function",
        stateMutability: "payable",
        inputs: [],
        outputs: []
    },
    {
        name: "totalAssets",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        name: "totalSupply",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }]
    },
    {
        type: "event",
        name: "SEIOptimizedDeposit",
        inputs: [
            { name: "user", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
            { name: "shares", type: "uint256", indexed: false },
            { name: "blockTime", type: "uint256", indexed: false }
        ]
    },
    {
        type: "event",
        name: "SEIOptimizedWithdraw",
        inputs: [
            { name: "user", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
            { name: "shares", type: "uint256", indexed: false },
            { name: "blockTime", type: "uint256", indexed: false }
        ]
    }
] as const;

export const CUSTOMER_DASHBOARD_ABI = [
    {
        name: "getCustomerPortfolio",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "customer", type: "address" }],
        outputs: [
            {
                name: "",
                type: "tuple[]",
                components: [
                    { name: "vaultAddress", type: "address" },
                    { name: "vaultName", type: "string" },
                    { name: "shareBalance", type: "uint256" },
                    { name: "shareValue", type: "uint256" },
                    { name: "totalDeposited", type: "uint256" },
                    { name: "totalWithdrawn", type: "uint256" },
                    { name: "unrealizedGains", type: "uint256" },
                    { name: "depositTimestamp", type: "uint256" },
                    { name: "lockTimeRemaining", type: "uint256" },
                    { name: "canWithdraw", type: "bool" }
                ]
            }
        ]
    },
    {
        name: "getVaultMetrics",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "vault", type: "address" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "totalValueLocked", type: "uint256" },
                    { name: "totalShares", type: "uint256" },
                    { name: "pricePerShare", type: "uint256" },
                    { name: "apy", type: "uint256" },
                    { name: "totalYieldGenerated", type: "uint256" },
                    { name: "managementFeeRate", type: "uint256" },
                    { name: "performanceFeeRate", type: "uint256" },
                    { name: "withdrawalFeeRate", type: "uint256" }
                ]
            }
        ]
    },
    {
        name: "getYieldHistory",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "vault", type: "address" },
            { name: "fromTimestamp", type: "uint256" }
        ],
        outputs: [
            {
                name: "",
                type: "tuple[]",
                components: [
                    { name: "timestamp", type: "uint256" },
                    { name: "totalValue", type: "uint256" },
                    { name: "yieldGenerated", type: "uint256" },
                    { name: "apy", type: "uint256" }
                ]
            }
        ]
    },
    {
        name: "calculateProjectedReturns",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "vault", type: "address" },
            { name: "depositAmount", type: "uint256" },
            { name: "daysHeld", type: "uint256" }
        ],
        outputs: [
            { name: "projectedValue", type: "uint256" },
            { name: "projectedYield", type: "uint256" },
            { name: "managementFees", type: "uint256" },
            { name: "withdrawalFees", type: "uint256" }
        ]
    },
    {
        name: "getOptimalDepositRatio",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "vault", type: "address" }],
        outputs: [
            { name: "token0Ratio", type: "uint256" },
            { name: "token1Ratio", type: "uint256" },
            { name: "currentPrice", type: "uint256" }
        ]
    }
] as const;

export const VAULT_FACTORY_ABI = [
    {
        name: "getAllVaults",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address[]" }]
    },
    {
        name: "getVaultByName",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "name", type: "string" }],
        outputs: [{ name: "", type: "address" }]
    }
] as const;
