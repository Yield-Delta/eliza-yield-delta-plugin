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
    FormattedDepositRatio
} from "../types/vault";

export const optimalDepositAction: Action = {
    name: "OPTIMAL_DEPOSIT",
    similes: [
        "DEPOSIT_RATIO",
        "BEST_RATIO",
        "DEPOSIT_RECOMMENDATION",
        "HOW_TO_DEPOSIT"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content?.text?.toLowerCase() || "";

        const depositKeywords = [
            "optimal deposit",
            "best ratio",
            "deposit ratio",
            "how should i deposit",
            "deposit recommendation",
            "optimal ratio",
            "best way to deposit"
        ];

        return depositKeywords.some(keyword => content.includes(keyword));
    },

    description: "Get the optimal token deposit ratio for a vault",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            elizaLogger.info("Optimal Deposit Action triggered");

            const content = message.content?.text || "";

            // Extract vault name from message
            const vaultName = matchVaultName(content);

            if (!vaultName) {
                if (callback) {
                    callback({
                        text: "I couldn't identify which vault you're asking about. Please specify a vault name like 'Delta Neutral', 'Stable Max', 'SEI Hypergrowth', etc.",
                        content: {
                            text: "Vault not identified",
                            action: "OPTIMAL_DEPOSIT",
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
                            action: "OPTIMAL_DEPOSIT",
                            error: "Vault address missing"
                        }
                    });
                }
                return;
            }

            elizaLogger.info(`Fetching optimal deposit ratio for vault: ${vaultName}`);

            // Get optimal deposit ratio
            const ratio = await vaultProvider.getOptimalDepositRatio(runtime, vaultAddress);

            // Format response
            const response = formatOptimalDepositResponse(vaultName, ratio);

            elizaLogger.info(`Optimal deposit response generated for ${vaultName}`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "OPTIMAL_DEPOSIT",
                        vaultName,
                        ratio
                    }
                });
            }

        } catch (error) {
            elizaLogger.error(`Error in optimal deposit action: ${error instanceof Error ? error.message : String(error)}`);

            if (callback) {
                callback({
                    text: "I encountered an error while fetching the optimal deposit ratio. Please try again in a moment.",
                    content: {
                        error: error instanceof Error ? error.message : "Unknown error",
                        action: "OPTIMAL_DEPOSIT"
                    }
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What's the optimal deposit ratio for Delta Neutral?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Optimal Deposit for Delta Neutral Vault:\n\n📊 Current Optimal Ratio:\n• Token0 (SEI): 55%\n• Token1 (USDC): 45%\n\n💱 Current Price: 1 SEI = $0.45 USDC\n\n💡 Example Deposits:\n• For $1,000: 1,222 SEI + 450 USDC\n• For $5,000: 6,111 SEI + 2,250 USDC\n\nDepositing at the optimal ratio maximizes your LP position efficiency and minimizes unused tokens."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "How should I deposit into Stable Max vault?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Optimal Deposit for Stable Max Vault:\n\n📊 Current Optimal Ratio:\n• Token0 (USDT): 50%\n• Token1 (USDC): 50%\n\n💱 Current Price: 1 USDT = $1.00 USDC\n\n💡 Example Deposits:\n• For $1,000: 500 USDT + 500 USDC\n• For $5,000: 2,500 USDT + 2,500 USDC\n\nDepositing at the optimal ratio maximizes your LP position efficiency and minimizes unused tokens."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Best ratio for Blue Chip vault" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Optimal Deposit for Blue Chip Vault:\n\n📊 Current Optimal Ratio:\n• Token0 (BTC): 60%\n• Token1 (USDC): 40%\n\n💱 Current Price: 1 BTC = $45,000 USDC\n\n💡 Example Deposits:\n• For $10,000: 0.133 BTC + 4,000 USDC\n• For $50,000: 0.667 BTC + 20,000 USDC\n\nDepositing at the optimal ratio maximizes your LP position efficiency and minimizes unused tokens."
                }
            }
        ]
    ]
};

function formatOptimalDepositResponse(
    vaultName: VaultName,
    ratio: FormattedDepositRatio
): string {
    const displayName = VaultDisplayNames[vaultName];

    // Get token symbols based on vault
    const token0Symbol = getToken0Symbol(vaultName);
    const token1Symbol = "USDC";

    // Calculate example deposits
    const examples = calculateExampleDeposits(ratio, token0Symbol);

    return `Optimal Deposit for ${displayName}:

📊 Current Optimal Ratio:
• Token0 (${token0Symbol}): ${ratio.token0Ratio.toFixed(0)}%
• Token1 (${token1Symbol}): ${ratio.token1Ratio.toFixed(0)}%

💱 Current Price: 1 ${token0Symbol} = $${ratio.currentPrice.toFixed(2)} ${token1Symbol}

💡 Example Deposits:
• For $1,000: ${examples.small.token0} ${token0Symbol} + ${examples.small.token1} ${token1Symbol}
• For $5,000: ${examples.large.token0} ${token0Symbol} + ${examples.large.token1} ${token1Symbol}

Depositing at the optimal ratio maximizes your LP position efficiency and minimizes unused tokens.`;
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

interface ExampleDeposit {
    token0: string;
    token1: string;
}

interface ExampleDeposits {
    small: ExampleDeposit;
    large: ExampleDeposit;
}

function calculateExampleDeposits(
    ratio: FormattedDepositRatio,
    token0Symbol: string
): ExampleDeposits {
    const token0Percent = ratio.token0Ratio / 100;
    const token1Percent = ratio.token1Ratio / 100;
    const price = ratio.currentPrice;

    // Small deposit ($1,000)
    const smallToken0Value = 1000 * token0Percent;
    const smallToken1Value = 1000 * token1Percent;
    const smallToken0Amount = smallToken0Value / price;

    // Large deposit ($5,000)
    const largeToken0Value = 5000 * token0Percent;
    const largeToken1Value = 5000 * token1Percent;
    const largeToken0Amount = largeToken0Value / price;

    return {
        small: {
            token0: formatTokenAmount(smallToken0Amount, token0Symbol),
            token1: smallToken1Value.toLocaleString("en-US", { maximumFractionDigits: 0 })
        },
        large: {
            token0: formatTokenAmount(largeToken0Amount, token0Symbol),
            token1: largeToken1Value.toLocaleString("en-US", { maximumFractionDigits: 0 })
        }
    };
}

function formatTokenAmount(amount: number, symbol: string): string {
    if (symbol === "BTC" || symbol === "ETH") {
        return amount.toFixed(3);
    }
    return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
