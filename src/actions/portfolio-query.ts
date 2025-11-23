import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { vaultProvider } from "../providers/vault-provider";
import { WalletProvider, initWalletProvider } from "../providers/wallet";
import { FormattedCustomerPortfolio } from "../types/vault";

export const portfolioQueryAction: Action = {
    name: "PORTFOLIO_QUERY",
    similes: [
        "GET_PORTFOLIO",
        "CHECK_PORTFOLIO",
        "MY_POSITIONS",
        "SHOW_BALANCE",
        "MY_INVESTMENTS",
        "VAULT_BALANCE"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content?.text?.toLowerCase() || "";

        const portfolioKeywords = [
            "my portfolio",
            "my positions",
            "my balance",
            "my deposits",
            "my investments",
            "what do i have",
            "how much do i have",
            "show my",
            "what's my",
            "what are my",
            "my gains",
            "can i withdraw",
            "withdrawal status",
            "my shares",
            "my holdings",
            "portfolio value",
            "total value"
        ];

        return portfolioKeywords.some(keyword => content.includes(keyword));
    },

    description: "Query user's vault portfolio including positions, balances, and withdrawal status",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            elizaLogger.info("Portfolio Query Action triggered");

            // Get user's wallet address
            const walletProvider = await initWalletProvider(runtime);
            const userAddress = walletProvider.getAddress();

            if (!userAddress) {
                if (callback) {
                    callback({
                        text: "I couldn't find your wallet address. Please make sure your wallet is configured.",
                        content: {
                            text: "Wallet not configured",
                            action: "PORTFOLIO_QUERY",
                            error: "No wallet address found"
                        }
                    });
                }
                return;
            }

            elizaLogger.info(`Fetching portfolio for address: ${userAddress}`);

            // Get customer portfolio from vault provider
            const portfolios = await vaultProvider.getCustomerPortfolio(runtime, userAddress);

            if (portfolios.length === 0) {
                if (callback) {
                    callback({
                        text: "You don't have any positions in Yield Delta vaults yet. Use 'list vaults' to see available investment options.",
                        content: {
                            text: "No positions found",
                            action: "PORTFOLIO_QUERY",
                            portfolios: []
                        }
                    });
                }
                return;
            }

            // Calculate totals
            const totalValue = portfolios.reduce((sum, p) => sum + p.shareValue, 0);
            const totalGains = portfolios.reduce((sum, p) => sum + p.unrealizedGains, 0);

            // Format response
            const response = formatPortfolioResponse(portfolios, totalValue, totalGains);

            elizaLogger.info(`Portfolio query response generated for ${portfolios.length} positions`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "PORTFOLIO_QUERY",
                        portfolios,
                        summary: {
                            totalValue,
                            totalGains,
                            positionCount: portfolios.length
                        }
                    }
                });
            }

        } catch (error) {
            elizaLogger.error(`Error in portfolio query action: ${error instanceof Error ? error.message : String(error)}`);

            if (callback) {
                callback({
                    text: "I encountered an error while fetching your portfolio. Please try again in a moment.",
                    content: {
                        error: error instanceof Error ? error.message : "Unknown error",
                        action: "PORTFOLIO_QUERY"
                    }
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What's my portfolio?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Your Yield Delta Portfolio:\n\nTotal Value: $5,234.56\n\nPositions:\n• Delta Neutral Vault: 1,000 shares ($2,100.00) +$100.00 gains ✓ Can withdraw\n• Stable Max Vault: 500 shares ($1,534.56) +$34.56 gains ⏳ 2 days lock remaining\n• SEI Hypergrowth: 800 shares ($1,600.00) +$200.00 gains ✓ Can withdraw\n\nTotal Unrealized Gains: +$334.56"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Show my positions" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Your Yield Delta Portfolio:\n\nTotal Value: $3,500.00\n\nPositions:\n• Delta Neutral Vault: 500 shares ($1,500.00) +$50.00 gains ✓ Can withdraw\n• USDC Vault: 2,000 shares ($2,000.00) +$20.00 gains ✓ Can withdraw\n\nTotal Unrealized Gains: +$70.00"
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Can I withdraw?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Your Yield Delta Portfolio:\n\nTotal Value: $2,100.00\n\nPositions:\n• Delta Neutral Vault: 1,000 shares ($2,100.00) +$100.00 gains ✓ Can withdraw\n\nTotal Unrealized Gains: +$100.00\n\nAll your positions are available for withdrawal."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "How much do I have deposited?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Your Yield Delta Portfolio:\n\nTotal Value: $10,500.00\n\nPositions:\n• Blue Chip Vault: 2,000 shares ($5,200.00) +$200.00 gains ✓ Can withdraw\n• SEI Vault: 1,500 shares ($3,300.00) +$150.00 gains ⏳ 5 days lock remaining\n• Arbitrage Vault: 1,000 shares ($2,000.00) +$100.00 gains ✓ Can withdraw\n\nTotal Unrealized Gains: +$450.00"
                }
            }
        ]
    ]
};

function formatPortfolioResponse(
    portfolios: FormattedCustomerPortfolio[],
    totalValue: number,
    totalGains: number
): string {
    let response = "Your Yield Delta Portfolio:\n\n";
    response += `Total Value: $${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
    response += "Positions:\n";

    for (const position of portfolios) {
        const sharesFormatted = position.shareBalance.toLocaleString("en-US", { maximumFractionDigits: 0 });
        const valueFormatted = position.shareValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const gainsFormatted = position.unrealizedGains >= 0
            ? `+$${position.unrealizedGains.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `-$${Math.abs(position.unrealizedGains).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        let withdrawStatus: string;
        if (position.canWithdraw) {
            withdrawStatus = "✓ Can withdraw";
        } else {
            const daysRemaining = Math.ceil(position.lockTimeRemaining / 86400);
            withdrawStatus = `⏳ ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} lock remaining`;
        }

        response += `• ${position.vaultName}: ${sharesFormatted} shares ($${valueFormatted}) ${gainsFormatted} gains ${withdrawStatus}\n`;
    }

    response += `\nTotal Unrealized Gains: ${totalGains >= 0 ? "+" : ""}$${totalGains.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Add withdrawal summary if relevant
    const canWithdrawCount = portfolios.filter(p => p.canWithdraw).length;
    if (canWithdrawCount === portfolios.length) {
        response += "\n\nAll your positions are available for withdrawal.";
    } else if (canWithdrawCount > 0) {
        response += `\n\n${canWithdrawCount} of ${portfolios.length} positions available for withdrawal.`;
    }

    return response;
}
