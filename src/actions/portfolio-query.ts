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

/**
 * Extract Ethereum address from message text
 * Supports formats like:
 * - "Check holdings for 0x1234..."
 * - "My wallet: 0x1234..."
 * - "0x1234..."
 */
function extractAddressFromMessage(text: string): string | null {
    // Regex to match Ethereum addresses (0x followed by 40 hex characters)
    const addressRegex = /0x[a-fA-F0-9]{40}/;
    const match = text.match(addressRegex);
    return match ? match[0] : null;
}

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
        const originalText = message.content?.text || "";

        elizaLogger.info(`[PORTFOLIO_QUERY] Validating message: "${originalText}"`);

        // Check if message contains an Ethereum address
        const hasAddress = extractAddressFromMessage(originalText) !== null;
        elizaLogger.info(`[PORTFOLIO_QUERY] Has address: ${hasAddress}`);

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
            "total value",
            "check holdings",
            "check portfolio",
            "check positions",
            "holdings for",
            "portfolio for",
            "positions for"
        ];

        // Validate if message has portfolio keywords OR contains a wallet address with context
        const hasKeywords = portfolioKeywords.some(keyword => content.includes(keyword));
        elizaLogger.info(`[PORTFOLIO_QUERY] Has keywords: ${hasKeywords}`);

        const hasAddressWithContext = hasAddress && (
            content.includes("check") ||
            content.includes("show") ||
            content.includes("portfolio") ||
            content.includes("holdings") ||
            content.includes("positions")
        );
        elizaLogger.info(`[PORTFOLIO_QUERY] Has address with context: ${hasAddressWithContext}`);

        const shouldValidate = hasAddressWithContext || hasKeywords;
        elizaLogger.info(`[PORTFOLIO_QUERY] Validation result: ${shouldValidate}`);

        return shouldValidate;
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

            const messageText = message.content?.text || "";
            elizaLogger.info(`Message text: "${messageText}"`);

            // Try to extract address from message first
            let targetAddress = extractAddressFromMessage(messageText);
            elizaLogger.info(`Extracted address from message: ${targetAddress || "none"}`);

            let isOwnWallet = false;

            // If no address in message, try to use agent's wallet
            if (!targetAddress) {
                elizaLogger.info("No address in message, trying to use agent's wallet");
                const walletProvider = await initWalletProvider(runtime);
                targetAddress = walletProvider.getAddress();
                isOwnWallet = true;
                elizaLogger.info(`Agent wallet address: ${targetAddress || "none"}`);

                if (!targetAddress) {
                    elizaLogger.warn("No wallet address available");
                    if (callback) {
                        callback({
                            text: "Please provide a wallet address to check. For example:\n• 'Check holdings for 0x1234...'\n• 'Show portfolio for 0x1234...'\n\nOr configure your own wallet to check your positions with 'what's my portfolio?'",
                            content: {
                                text: "No wallet address provided",
                                action: "PORTFOLIO_QUERY",
                                error: "No wallet address found"
                            }
                        });
                    }
                    return;
                }
            }

            elizaLogger.info(`Fetching portfolio for address: ${targetAddress}${isOwnWallet ? " (own wallet)" : " (provided address)"}`);

            // Get customer portfolio from vault provider
            elizaLogger.info(`Calling vaultProvider.getCustomerPortfolio with address: ${targetAddress}`);
            const portfolios = await vaultProvider.getCustomerPortfolio(runtime, targetAddress as `0x${string}`);
            elizaLogger.info(`Portfolio query returned ${portfolios.length} positions`);

            if (portfolios.length === 0) {
                const noPositionsText = isOwnWallet
                    ? "You don't have any positions in Yield Delta vaults yet. Use 'list vaults' to see available investment options."
                    : `Address ${targetAddress} doesn't have any positions in Yield Delta vaults.`;

                if (callback) {
                    callback({
                        text: noPositionsText,
                        content: {
                            text: "No positions found",
                            action: "PORTFOLIO_QUERY",
                            portfolios: [],
                            address: targetAddress
                        }
                    });
                }
                return;
            }

            // Calculate totals
            const totalValue = portfolios.reduce((sum, p) => sum + p.shareValue, 0);
            const totalGains = portfolios.reduce((sum, p) => sum + p.unrealizedGains, 0);

            // Format response
            const response = formatPortfolioResponse(portfolios, totalValue, totalGains, targetAddress, isOwnWallet);

            elizaLogger.info(`Portfolio query response generated for ${portfolios.length} positions`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "PORTFOLIO_QUERY",
                        portfolios,
                        address: targetAddress,
                        isOwnWallet,
                        summary: {
                            totalValue,
                            totalGains,
                            positionCount: portfolios.length
                        }
                    }
                });
            }

        } catch (error) {
            elizaLogger.error("=== Portfolio Query Error ===");
            elizaLogger.error(`Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
            elizaLogger.error(`Error message: ${error instanceof Error ? error.message : String(error)}`);
            if (error instanceof Error && error.stack) {
                elizaLogger.error(`Stack trace: ${error.stack}`);
            }
            elizaLogger.error(`Full error object: ${JSON.stringify(error, null, 2)}`);
            elizaLogger.error("=========================");

            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            const userFriendlyMessage = `I encountered an error while fetching your portfolio: ${errorMessage}\n\nPlease check the server logs for more details.`;

            if (callback) {
                callback({
                    text: userFriendlyMessage,
                    content: {
                        error: errorMessage,
                        action: "PORTFOLIO_QUERY",
                        errorDetails: error instanceof Error ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        } : { raw: String(error) }
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
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Check holdings for 0x1234567890123456789012345678901234567890" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Yield Delta Portfolio for 0x1234...7890:\n\nTotal Value: $3,200.00\n\nPositions:\n• Delta Neutral Vault: 800 shares ($1,600.00) +$80.00 gains ✓ Can withdraw\n• SEI Vault: 1,000 shares ($1,600.00) +$50.00 gains ⏳ 3 days lock remaining\n\nTotal Unrealized Gains: +$130.00\n\n1 of 2 positions available for withdrawal."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Show portfolio for 0xabcdef1234567890abcdef1234567890abcdef12" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Yield Delta Portfolio for 0xabcd...ef12:\n\nTotal Value: $7,800.00\n\nPositions:\n• USDC Vault: 5,000 shares ($5,000.00) +$100.00 gains ✓ Can withdraw\n• Blue Chip Vault: 1,400 shares ($2,800.00) +$150.00 gains ✓ Can withdraw\n\nTotal Unrealized Gains: +$250.00\n\nAll positions are available for withdrawal."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Check positions for 0x9876543210987654321098765432109876543210" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Address 0x9876...3210 doesn't have any positions in Yield Delta vaults."
                }
            }
        ]
    ]
};

function formatPortfolioResponse(
    portfolios: FormattedCustomerPortfolio[],
    totalValue: number,
    totalGains: number,
    address: string,
    isOwnWallet: boolean
): string {
    // Format header based on whether it's the user's own wallet or another address
    let response = "";
    if (isOwnWallet) {
        response = "Your Yield Delta Portfolio:\n\n";
    } else {
        // Show shortened address for readability
        const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
        response = `Yield Delta Portfolio for ${shortAddress}:\n\n`;
    }

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
    if (isOwnWallet) {
        if (canWithdrawCount === portfolios.length) {
            response += "\n\nAll your positions are available for withdrawal.";
        } else if (canWithdrawCount > 0) {
            response += `\n\n${canWithdrawCount} of ${portfolios.length} positions available for withdrawal.`;
        }
    } else {
        if (canWithdrawCount === portfolios.length) {
            response += "\n\nAll positions are available for withdrawal.";
        } else if (canWithdrawCount > 0) {
            response += `\n\n${canWithdrawCount} of ${portfolios.length} positions available for withdrawal.`;
        }
    }

    return response;
}
