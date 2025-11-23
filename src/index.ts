import type { Plugin } from "@elizaos/core";
import { evmWalletProvider } from "./providers/wallet";
import { oracleProvider } from "./providers/sei-oracle";
import { vaultProvider } from "./providers/vault-provider";

// Import vault query actions (new architecture)
import { portfolioQueryAction } from "./actions/portfolio-query";
import { vaultMetricsAction } from "./actions/vault-metrics";
import { yieldHistoryAction } from "./actions/yield-history";
import { projectedReturnsAction } from "./actions/projected-returns";
import { vaultListAction } from "./actions/vault-list";
import { positionDetailsAction } from "./actions/position-details";
import { optimalDepositAction } from "./actions/optimal-deposit";

// Import core actions (kept)
import { transferAction } from "./actions/transfer";
import { priceQueryAction } from "./actions/price-query";

// Import legacy actions (deprecated - kept for backwards compatibility)
import { dragonSwapTradeAction } from "./actions/dragonswap";
import { fundingArbitrageAction } from "./actions/funding-arbitrage";
import { perpsTradeAction } from "./actions/perp-trading";
import { rebalanceEvaluatorAction } from "./actions/rebalance";
import { yeiFinanceAction } from './actions/yei-finance';
import { ilProtectionAction } from "./actions/il-protection";
import { ammOptimizeAction } from './actions/amm-optimize';
import { deltaNeutralAction } from './actions/delta-neutral';

// Import evaluators
import { ammRiskEvaluator } from './evaluators/amm-risk';
import { vaultMonitorEvaluator } from './evaluators/vault-monitor';
import { AMMManagerProvider_Instance } from './providers/amm-manager';

// Import utilities and types from environment
import {
  validateSeiConfig,
  seiChains,
  getSeiChainConfig,
  getTokenAddress,
  type SeiConfig,
  type SeiChain,
  type SeiNetworkName
} from './environment';

console.log("SEI YIELD-DELTA PLUGIN IS BEING INITIALIZED");

export const seiYieldDeltaPlugin: Plugin = {
    name: "sei-yield-delta",
    description: "Yield Delta vault query interface for SEI blockchain - query portfolio, vault metrics, projections, and yield history",
    actions: [
        // Primary vault query actions
        portfolioQueryAction,
        vaultMetricsAction,
        yieldHistoryAction,
        projectedReturnsAction,
        vaultListAction,
        positionDetailsAction,
        optimalDepositAction,

        // Core utility actions
        transferAction,
        priceQueryAction,

        // Legacy actions (deprecated - vaults handle these automatically)
        // Uncomment if needed for backwards compatibility:
        // dragonSwapTradeAction,
        // fundingArbitrageAction,
        // perpsTradeAction,
        // rebalanceEvaluatorAction,
        // yeiFinanceAction,
        // ilProtectionAction,
        // ammOptimizeAction,
        // deltaNeutralAction
    ],
    evaluators: [
        ammRiskEvaluator,
        vaultMonitorEvaluator
    ],
    providers: [
        evmWalletProvider as any,
        oracleProvider as any,
        vaultProvider as any,
        AMMManagerProvider_Instance as any
    ],
};

// Export new vault query actions
export {
    portfolioQueryAction,
    vaultMetricsAction,
    yieldHistoryAction,
    projectedReturnsAction,
    vaultListAction,
    positionDetailsAction,
    optimalDepositAction
};

// Export core actions
export {
    transferAction,
    priceQueryAction
};

// Export legacy actions (for backwards compatibility)
export {
    dragonSwapTradeAction,
    fundingArbitrageAction,
    perpsTradeAction,
    rebalanceEvaluatorAction,
    yeiFinanceAction,
    ilProtectionAction,
    ammOptimizeAction,
    deltaNeutralAction
};

// Export providers
export {
    evmWalletProvider,
    oracleProvider,
    vaultProvider,
    AMMManagerProvider_Instance
};

// Export provider classes
export { WalletProvider } from "./providers/wallet";
export { SeiOracleProvider } from "./providers/sei-oracle";
export { VaultProvider } from "./providers/vault-provider";

// Export evaluators
export { ammRiskEvaluator } from './evaluators/amm-risk';
export { vaultMonitorEvaluator } from './evaluators/vault-monitor';

// Export utilities and config types
export {
  validateSeiConfig,
  seiChains,
  getSeiChainConfig,
  getTokenAddress,
  type SeiConfig,
  type SeiChain,
  type SeiNetworkName
};

// Export vault types
export {
    VaultName,
    VaultDisplayNames,
    VaultStrategies,
    VaultRiskLevels,
    matchVaultName,
    isVaultName,
    isVaultInfo,
    isCustomerPortfolio,
    isVaultMetrics,
    STRATEGY_VAULT_ABI,
    CUSTOMER_DASHBOARD_ABI,
    VAULT_FACTORY_ABI
} from "./types/vault";

export type {
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
    VaultAddressMap,
    AIRebalanceParams,
    RiskLevel
} from "./types/vault";

// Export other types
export type {
    DragonSwapTradeParams,
    DragonSwapPoolInfo,
    ArbitrageOpportunity,
    ArbitragePosition,
    PriceFeed,
    FundingRate,
    PortfolioAsset,
    RebalanceStrategy,
    PortfolioAnalysis,
    RebalanceRecommendation
} from "./types";

// Default export
export default seiYieldDeltaPlugin;
