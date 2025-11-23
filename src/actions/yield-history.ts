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
    VaultName,
    FormattedYieldHistory
} from "../types/vault";

export const yieldHistoryAction: Action = {
    name: "YIELD_HISTORY",
    similes: [
        "GET_YIELD_HISTORY",
        "VAULT_HISTORY",
        "HISTORICAL_PERFORMANCE",
        "PAST_RETURNS",
        "PERFORMANCE_HISTORY"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content?.text?.toLowerCase() || "";

        const historyKeywords = [
            "yield history",
            "historical",
            "past performance",
            "how has",
            "performed",
            "past returns",
            "performance history",
            "history for",
            "chart for",
            "trend",
            "over time",
            "last week",
            "last month",
            "30 day",
            "7 day"
        ];

        return historyKeywords.some(keyword => content.includes(keyword));
    },

    description: "Show historical yield performance for vaults",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            elizaLogger.info("Yield History Action triggered");

            const content = message.content?.text || "";

            // Extract vault name from message
            const vaultName = matchVaultName(content);

            if (!vaultName) {
                if (callback) {
                    callback({
                        text: "I couldn't identify which vault you're asking about. Please specify a vault name like 'Delta Neutral', 'Stable Max', 'SEI Hypergrowth', etc.",
                        content: {
                            text: "Vault not identified",
                            action: "YIELD_HISTORY",
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
                            action: "YIELD_HISTORY",
                            error: "Vault address missing"
                        }
                    });
                }
                return;
            }

            // Determine time range from message
            const days = extractTimeRange(content);
            const fromTimestamp = Math.floor(Date.now() / 1000) - (days * 86400);

            elizaLogger.info(`Fetching yield history for vault: ${vaultName}, last ${days} days`);

            // Get yield history
            const history = await vaultProvider.getYieldHistory(runtime, vaultAddress, fromTimestamp);

            if (history.length === 0) {
                if (callback) {
                    callback({
                        text: `No yield history available for ${VaultDisplayNames[vaultName]} in the selected time period.`,
                        content: {
                            text: "No history available",
                            action: "YIELD_HISTORY",
                            vaultName,
                            days
                        }
                    });
                }
                return;
            }

            // Calculate summary statistics
            const avgApy = history.reduce((sum, h) => sum + h.apy, 0) / history.length;
            const totalYield = history.reduce((sum, h) => sum + h.yieldGenerated, 0);
            const trend = calculateTrend(history);

            // Format response
            const response = formatYieldHistoryResponse(vaultName, days, history, avgApy, totalYield, trend);

            elizaLogger.info(`Yield history response generated for ${vaultName}`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "YIELD_HISTORY",
                        vaultName,
                        days,
                        history,
                        summary: {
                            avgApy,
                            totalYield,
                            trend
                        }
                    }
                });
            }

        } catch (error) {
            elizaLogger.error(`Error in yield history action: ${error instanceof Error ? error.message : String(error)}`);

            if (callback) {
                callback({
                    text: "I encountered an error while fetching yield history. Please try again in a moment.",
                    content: {
                        error: error instanceof Error ? error.message : "Unknown error",
                        action: "YIELD_HISTORY"
                    }
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "Show yield history for Delta Neutral" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Delta Neutral Vault - 30 Day Performance:\n\n📈 Summary:\n• Average APY: 11.8%\n• Total Yield: $12,450\n• Trend: ↗️ Improving\n\nRecent History:\n• Nov 22: APY 12.5%, Value $1.23M, Yield $420\n• Nov 21: APY 12.3%, Value $1.22M, Yield $415\n• Nov 20: APY 11.9%, Value $1.21M, Yield $398\n• Nov 19: APY 11.2%, Value $1.20M, Yield $372\n\nThe vault has shown consistent growth with improving yields over the past week."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "How has Stable Max performed?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Stable Max Vault - 30 Day Performance:\n\n📈 Summary:\n• Average APY: 8.1%\n• Total Yield: $6,800\n• Trend: ➡️ Stable\n\nRecent History:\n• Nov 22: APY 8.2%, Value $890K, Yield $200\n• Nov 21: APY 8.2%, Value $888K, Yield $199\n• Nov 20: APY 8.1%, Value $885K, Yield $198\n• Nov 19: APY 8.0%, Value $882K, Yield $196\n\nThe vault has maintained steady yields with minimal volatility."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Historical returns for Arbitrage vault last 7 days" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Arbitrage Vault - 7 Day Performance:\n\n📈 Summary:\n• Average APY: 23.1%\n• Total Yield: $1,850\n• Trend: ↗️ Improving\n\nRecent History:\n• Nov 22: APY 24.5%, Value $234K, Yield $320\n• Nov 21: APY 23.8%, Value $232K, Yield $295\n• Nov 20: APY 22.9%, Value $230K, Yield $280\n• Nov 19: APY 22.1%, Value $228K, Yield $265\n\nThe vault has shown strong improvement with increasing arbitrage opportunities."
                }
            }
        ]
    ]
};

function extractTimeRange(content: string): number {
    const lowerContent = content.toLowerCase();

    // Check for specific day mentions
    const dayMatch = lowerContent.match(/(\d+)\s*day/);
    if (dayMatch) {
        return parseInt(dayMatch[1], 10);
    }

    // Check for week mentions
    if (lowerContent.includes("week")) {
        const weekMatch = lowerContent.match(/(\d+)\s*week/);
        if (weekMatch) {
            return parseInt(weekMatch[1], 10) * 7;
        }
        return 7;
    }

    // Check for month mentions
    if (lowerContent.includes("month")) {
        const monthMatch = lowerContent.match(/(\d+)\s*month/);
        if (monthMatch) {
            return parseInt(monthMatch[1], 10) * 30;
        }
        return 30;
    }

    // Default to 30 days
    return 30;
}

function calculateTrend(history: FormattedYieldHistory[]): string {
    if (history.length < 2) return "Stable";

    // Sort by timestamp descending (most recent first)
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);

    // Compare recent APY to older APY
    const recentCount = Math.min(3, Math.floor(sorted.length / 2));
    const recentAvg = sorted.slice(0, recentCount).reduce((sum, h) => sum + h.apy, 0) / recentCount;
    const olderAvg = sorted.slice(-recentCount).reduce((sum, h) => sum + h.apy, 0) / recentCount;

    const change = recentAvg - olderAvg;

    if (change > 0.5) return "Improving";
    if (change < -0.5) return "Declining";
    return "Stable";
}

function formatYieldHistoryResponse(
    vaultName: VaultName,
    days: number,
    history: FormattedYieldHistory[],
    avgApy: number,
    totalYield: number,
    trend: string
): string {
    const displayName = VaultDisplayNames[vaultName];

    // Trend emoji
    let trendEmoji: string;
    switch (trend) {
        case "Improving":
            trendEmoji = "↗️";
            break;
        case "Declining":
            trendEmoji = "↘️";
            break;
        default:
            trendEmoji = "➡️";
    }

    // Sort history by timestamp descending
    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);

    // Format recent history entries (show up to 5)
    const recentEntries = sortedHistory.slice(0, 5).map(h => {
        const date = new Date(h.timestamp * 1000);
        const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const valueFormatted = h.totalValue >= 1000000
            ? `$${(h.totalValue / 1000000).toFixed(2)}M`
            : `$${(h.totalValue / 1000).toFixed(0)}K`;
        const yieldFormatted = `$${h.yieldGenerated.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

        return `• ${dateStr}: APY ${h.apy.toFixed(1)}%, Value ${valueFormatted}, Yield ${yieldFormatted}`;
    });

    // Generate summary message based on trend
    let summaryMessage: string;
    switch (trend) {
        case "Improving":
            summaryMessage = "The vault has shown consistent growth with improving yields over the past week.";
            break;
        case "Declining":
            summaryMessage = "The vault has seen some yield reduction recently, which may recover as market conditions change.";
            break;
        default:
            summaryMessage = "The vault has maintained steady yields with minimal volatility.";
    }

    return `${displayName} - ${days} Day Performance:

📈 Summary:
• Average APY: ${avgApy.toFixed(1)}%
• Total Yield: $${totalYield.toLocaleString("en-US", { maximumFractionDigits: 0 })}
• Trend: ${trendEmoji} ${trend}

Recent History:
${recentEntries.join("\n")}

${summaryMessage}`;
}
