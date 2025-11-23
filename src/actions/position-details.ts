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
    FormattedPosition,
    FormattedVaultInfo
} from "../types/vault";

export const positionDetailsAction: Action = {
    name: "POSITION_DETAILS",
    similes: [
        "GET_POSITION",
        "LP_POSITION",
        "TICK_RANGE",
        "LIQUIDITY_DETAILS",
        "POSITION_INFO"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content?.text?.toLowerCase() || "";

        const positionKeywords = [
            "position for",
            "position of",
            "tick range",
            "liquidity details",
            "position info",
            "position details",
            "lp position",
            "current position",
            "show position",
            "concentrated liquidity",
            "price range"
        ];

        return positionKeywords.some(keyword => content.includes(keyword));
    },

    description: "Show current vault position details including tick ranges and liquidity for advanced users",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            elizaLogger.info("Position Details Action triggered");

            const content = message.content?.text || "";

            // Extract vault name from message
            const vaultName = matchVaultName(content);

            if (!vaultName) {
                if (callback) {
                    callback({
                        text: "I couldn't identify which vault you're asking about. Please specify a vault name like 'Delta Neutral', 'Stable Max', 'SEI Hypergrowth', etc.",
                        content: {
                            text: "Vault not identified",
                            action: "POSITION_DETAILS",
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
                            action: "POSITION_DETAILS",
                            error: "Vault address missing"
                        }
                    });
                }
                return;
            }

            elizaLogger.info(`Fetching position details for vault: ${vaultName}`);

            // Get position and vault info
            const position = await vaultProvider.getCurrentPosition(runtime, vaultAddress);
            const info = await vaultProvider.getVaultInfo(runtime, vaultAddress);

            // Format response
            const response = formatPositionDetailsResponse(vaultName, position, info);

            elizaLogger.info(`Position details response generated for ${vaultName}`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "POSITION_DETAILS",
                        vaultName,
                        position,
                        vaultInfo: info
                    }
                });
            }

        } catch (error) {
            elizaLogger.error(`Error in position details action: ${error instanceof Error ? error.message : String(error)}`);

            if (callback) {
                callback({
                    text: "I encountered an error while fetching position details. Please try again in a moment.",
                    content: {
                        error: error instanceof Error ? error.message : "Unknown error",
                        action: "POSITION_DETAILS"
                    }
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "Show position for Delta Neutral" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Delta Neutral Vault - Current Position:\n\n📍 Tick Range:\n• Lower: -887220 (price: $0.38)\n• Upper: -886380 (price: $0.52)\n• Current: -886800 (price: $0.45)\n\n💧 Liquidity:\n• Total Liquidity: 1,234,567,890\n• Token0 (SEI): 50,000\n• Token1 (USDC): 22,500\n\n💰 Uncollected Fees:\n• SEI: 125.5\n• USDC: 56.2\n\nPosition is 65% in range. Rebalance expected when price moves outside ±5% of current range."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "What's the current tick range for Blue Chip vault?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Blue Chip Vault - Current Position:\n\n📍 Tick Range:\n• Lower: -200100 (price: $42,500)\n• Upper: -199500 (price: $48,200)\n• Current: -199800 (price: $45,100)\n\n💧 Liquidity:\n• Total Liquidity: 2,567,890,123\n• Token0 (BTC): 25.5\n• Token1 (USDC): 1,150,000\n\n💰 Uncollected Fees:\n• BTC: 0.125\n• USDC: 5,625\n\nPosition is 78% in range. Rebalance expected when price moves outside ±8% of current range."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Liquidity details for Concentrated Liquidity vault" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Concentrated Liquidity Vault - Current Position:\n\n📍 Tick Range:\n• Lower: -887000 (price: $0.40)\n• Upper: -886500 (price: $0.48)\n• Current: -886750 (price: $0.44)\n\n💧 Liquidity:\n• Total Liquidity: 3,456,789,012\n• Token0 (SEI): 75,000\n• Token1 (USDC): 33,000\n\n💰 Uncollected Fees:\n• SEI: 250.8\n• USDC: 110.4\n\nPosition is 82% in range. Rebalance expected when price moves outside ±3% of current range."
                }
            }
        ]
    ]
};

function formatPositionDetailsResponse(
    vaultName: VaultName,
    position: FormattedPosition,
    info: FormattedVaultInfo
): string {
    const displayName = VaultDisplayNames[vaultName];

    // Calculate in-range percentage (simplified)
    const priceRange = position.priceUpper - position.priceLower;
    const currentFromLower = position.currentPrice - position.priceLower;
    const inRangePercent = Math.min(100, Math.max(0, (currentFromLower / priceRange) * 100));

    // Determine token symbols based on vault type
    const token0Symbol = getToken0Symbol(vaultName);
    const token1Symbol = "USDC";

    // Format liquidity
    const liquidityFormatted = position.liquidity.toLocaleString("en-US", { maximumFractionDigits: 0 });

    // Determine rebalance threshold based on vault type
    const rebalanceThreshold = getRebalanceThreshold(vaultName);

    return `${displayName} - Current Position:

📍 Tick Range:
• Lower: ${position.tickLower} (price: $${position.priceLower.toFixed(2)})
• Upper: ${position.tickUpper} (price: $${position.priceUpper.toFixed(2)})
• Current: ${Math.round((position.tickLower + position.tickUpper) / 2)} (price: $${position.currentPrice.toFixed(2)})

💧 Liquidity:
• Total Liquidity: ${liquidityFormatted}
• Token0 (${token0Symbol}): ${position.tokensOwed0.toLocaleString("en-US", { maximumFractionDigits: 2 })}
• Token1 (${token1Symbol}): ${position.tokensOwed1.toLocaleString("en-US", { maximumFractionDigits: 2 })}

💰 Uncollected Fees:
• ${token0Symbol}: ${position.tokensOwed0.toFixed(1)}
• ${token1Symbol}: ${position.tokensOwed1.toFixed(1)}

Position is ${inRangePercent.toFixed(0)}% in range. Rebalance expected when price moves outside ±${rebalanceThreshold}% of current range.`;
}

function getToken0Symbol(vaultName: VaultName): string {
    switch (vaultName) {
        case VaultName.BLUE_CHIP:
            return "BTC";
        case VaultName.SEI:
        case VaultName.DELTA_NEUTRAL:
        case VaultName.SEI_HYPERGROWTH:
        case VaultName.CONCENTRATED_LIQUIDITY:
        case VaultName.YIELD_FARMING:
        case VaultName.ARBITRAGE:
            return "SEI";
        case VaultName.HEDGE:
            return "ETH";
        case VaultName.STABLE_MAX:
        case VaultName.USDC:
            return "USDT";
        default:
            return "SEI";
    }
}

function getRebalanceThreshold(vaultName: VaultName): number {
    switch (vaultName) {
        case VaultName.CONCENTRATED_LIQUIDITY:
            return 3;
        case VaultName.DELTA_NEUTRAL:
            return 5;
        case VaultName.STABLE_MAX:
            return 2;
        case VaultName.BLUE_CHIP:
            return 8;
        case VaultName.SEI_HYPERGROWTH:
            return 10;
        default:
            return 5;
    }
}
