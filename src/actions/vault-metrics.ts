import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { vaultProvider } from "../providers/vault-provider";
import {
    matchVaultName,
    VaultDisplayNames,
    VaultStrategies,
    VaultName,
    FormattedVaultMetrics
} from "../types/vault";

export const vaultMetricsAction: Action = {
    name: "VAULT_METRICS",
    similes: [
        "GET_VAULT_METRICS",
        "VAULT_STATS",
        "VAULT_PERFORMANCE",
        "VAULT_APY",
        "VAULT_TVL",
        "VAULT_FEES"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content?.text?.toLowerCase() || "";

        const metricsKeywords = [
            "apy of",
            "apy for",
            "tvl for",
            "tvl of",
            "fees for",
            "fees of",
            "vault stats",
            "vault metrics",
            "vault performance",
            "how is the",
            "performing",
            "what's the apy",
            "what is the apy",
            "yield for",
            "returns for"
        ];

        // Check for vault name mentions combined with metric keywords
        const vaultKeywords = [
            "delta neutral", "stable max", "hypergrowth", "blue chip",
            "hedge", "yield farming", "arbitrage", "concentrated",
            "sei vault", "usdc vault"
        ];

        const hasMetricKeyword = metricsKeywords.some(keyword => content.includes(keyword));
        const hasVaultKeyword = vaultKeywords.some(keyword => content.includes(keyword));

        return hasMetricKeyword || (hasVaultKeyword && (
            content.includes("apy") ||
            content.includes("tvl") ||
            content.includes("fee") ||
            content.includes("stat") ||
            content.includes("metric") ||
            content.includes("perform")
        ));
    },

    description: "Get performance metrics for specific vaults including APY, TVL, and fees",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            elizaLogger.info("Vault Metrics Action triggered");

            const content = message.content?.text || "";

            // Extract vault name from message
            const vaultName = matchVaultName(content);

            if (!vaultName) {
                if (callback) {
                    callback({
                        text: "I couldn't identify which vault you're asking about. Please specify a vault name like 'Delta Neutral', 'Stable Max', 'SEI Hypergrowth', etc.",
                        content: {
                            text: "Vault not identified",
                            action: "VAULT_METRICS",
                            error: "No vault name found"
                        }
                    });
                }
                return;
            }

            // Get vault address
            const vaultAddress = vaultProvider.getVaultAddress(vaultName);

            if (!vaultAddress) {
                if (callback) {
                    callback({
                        text: `The ${VaultDisplayNames[vaultName]} address is not configured. Please check your environment configuration.`,
                        content: {
                            text: "Vault address not configured",
                            action: "VAULT_METRICS",
                            error: "Vault address missing"
                        }
                    });
                }
                return;
            }

            elizaLogger.info(`Fetching metrics for vault: ${vaultName} at ${vaultAddress}`);

            // Get vault metrics and info
            const metrics = await vaultProvider.getVaultMetrics(runtime, vaultAddress);
            const info = await vaultProvider.getVaultInfo(runtime, vaultAddress);

            // Format response
            const response = formatVaultMetricsResponse(vaultName, metrics, info.strategy || VaultStrategies[vaultName]);

            elizaLogger.info(`Vault metrics response generated for ${vaultName}`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "VAULT_METRICS",
                        vaultName,
                        metrics,
                        strategy: info.strategy
                    }
                });
            }

        } catch (error) {
            elizaLogger.error(`Error in vault metrics action: ${error instanceof Error ? error.message : String(error)}`);

            if (callback) {
                callback({
                    text: "I encountered an error while fetching vault metrics. Please try again in a moment.",
                    content: {
                        error: error instanceof Error ? error.message : "Unknown error",
                        action: "VAULT_METRICS"
                    }
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What's the APY of Delta Neutral vault?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Delta Neutral Vault Metrics:\n\n📊 Performance:\n• APY: 12.5%\n• Total Yield Generated: $45,230\n\n💰 TVL & Shares:\n• Total Value Locked: $1,234,567\n• Total Shares: 50,000\n• Price per Share: $24.69\n\n💸 Fees:\n• Management: 0.5%\n• Performance: 10%\n• Withdrawal: 0.1%\n\nStrategy: Delta-neutral yield farming with IL protection"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Show TVL for Stable Max" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Stable Max Vault Metrics:\n\n📊 Performance:\n• APY: 8.2%\n• Total Yield Generated: $28,450\n\n💰 TVL & Shares:\n• Total Value Locked: $890,000\n• Total Shares: 88,500\n• Price per Share: $10.06\n\n💸 Fees:\n• Management: 0.3%\n• Performance: 5%\n• Withdrawal: 0.05%\n\nStrategy: Stablecoin optimization"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "What are the fees for Arbitrage vault?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Arbitrage Vault Metrics:\n\n📊 Performance:\n• APY: 22.4%\n• Total Yield Generated: $15,600\n\n💰 TVL & Shares:\n• Total Value Locked: $234,000\n• Total Shares: 9,200\n• Price per Share: $25.43\n\n💸 Fees:\n• Management: 1%\n• Performance: 15%\n• Withdrawal: 0.2%\n\nStrategy: Cross-DEX arbitrage"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "How is the SEI Hypergrowth vault performing?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "SEI Hypergrowth Vault Metrics:\n\n📊 Performance:\n• APY: 24.8%\n• Total Yield Generated: $32,100\n\n💰 TVL & Shares:\n• Total Value Locked: $456,000\n• Total Shares: 18,200\n• Price per Share: $25.05\n\n💸 Fees:\n• Management: 1.5%\n• Performance: 20%\n• Withdrawal: 0.3%\n\nStrategy: Leveraged SEI exposure"
                }
            }
        ]
    ]
};

function formatVaultMetricsResponse(
    vaultName: VaultName,
    metrics: FormattedVaultMetrics,
    strategy: string
): string {
    const displayName = VaultDisplayNames[vaultName];

    const tvlFormatted = metrics.totalValueLocked >= 1000000
        ? `$${(metrics.totalValueLocked / 1000000).toFixed(2)}M`
        : `$${metrics.totalValueLocked.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

    const sharesFormatted = metrics.totalShares.toLocaleString("en-US", { maximumFractionDigits: 0 });
    const pricePerShareFormatted = metrics.pricePerShare.toFixed(2);
    const yieldFormatted = metrics.totalYieldGenerated.toLocaleString("en-US", { maximumFractionDigits: 0 });

    return `${displayName} Metrics:

📊 Performance:
• APY: ${metrics.apy.toFixed(1)}%
• Total Yield Generated: $${yieldFormatted}

💰 TVL & Shares:
• Total Value Locked: ${tvlFormatted}
• Total Shares: ${sharesFormatted}
• Price per Share: $${pricePerShareFormatted}

💸 Fees:
• Management: ${metrics.managementFeeRate.toFixed(1)}%
• Performance: ${metrics.performanceFeeRate.toFixed(0)}%
• Withdrawal: ${metrics.withdrawalFeeRate.toFixed(2)}%

Strategy: ${strategy}`;
}
