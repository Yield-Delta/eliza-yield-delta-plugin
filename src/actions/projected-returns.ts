import {
    Action,
    IAgentRuntime,
    Memory,
    State,
    HandlerCallback,
    elizaLogger
} from "@elizaos/core";
import { vaultProvider } from "../providers/vault-provider";
import { SeiOracleProvider } from "../providers/sei-oracle";
import {
    matchVaultName,
    VaultDisplayNames,
    VaultName,
    FormattedProjectedReturns
} from "../types/vault";

export const projectedReturnsAction: Action = {
    name: "PROJECTED_RETURNS",
    similes: [
        "CALCULATE_RETURNS",
        "ESTIMATE_YIELD",
        "PROJECT_EARNINGS",
        "FORECAST_RETURNS",
        "DEPOSIT_CALCULATOR"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content?.text?.toLowerCase() || "";

        const projectionKeywords = [
            "what would i earn",
            "how much would i make",
            "calculate returns",
            "project",
            "estimate",
            "if i deposit",
            "depositing",
            "projected returns",
            "expected return",
            "forecast",
            "would i get",
            "yield for"
        ];

        // Check for amount mentions
        const hasAmount = /\d+/.test(content);

        return projectionKeywords.some(keyword => content.includes(keyword)) && hasAmount;
    },

    description: "Calculate projected returns for a deposit amount over a specified period",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            elizaLogger.info("Projected Returns Action triggered");

            const content = message.content?.text || "";

            // Extract vault name from message
            const vaultName = matchVaultName(content);

            if (!vaultName) {
                if (callback) {
                    callback({
                        text: "I couldn't identify which vault you're asking about. Please specify a vault name like 'Delta Neutral', 'Stable Max', 'SEI Hypergrowth', etc.",
                        content: {
                            text: "Vault not identified",
                            action: "PROJECTED_RETURNS",
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
                            action: "PROJECTED_RETURNS",
                            error: "Vault address missing"
                        }
                    });
                }
                return;
            }

            // Extract amount and days from message
            const { amount, currency, days } = extractDepositParams(content);

            if (amount <= 0) {
                if (callback) {
                    callback({
                        text: "Please specify a deposit amount. For example: 'What would I earn depositing 1000 SEI into Delta Neutral for 30 days?'",
                        content: {
                            text: "Amount not specified",
                            action: "PROJECTED_RETURNS",
                            error: "No amount found"
                        }
                    });
                }
                return;
            }

            elizaLogger.info(`Calculating projections for ${amount} ${currency} in ${vaultName} for ${days} days`);

            // Get vault metrics for current APY context
            const metrics = await vaultProvider.getVaultMetrics(runtime, vaultAddress);

            // Calculate projected returns
            // Note: The contract expects USD value, so we need to convert SEI to USD
            let depositUsdValue = amount; // Default to amount if already in USD

            if (currency === "SEI") {
                // Get real-time SEI price from oracle
                const oracleProvider = new SeiOracleProvider(runtime);
                const seiPrice = await oracleProvider.getPrice("SEI");
                const seiPriceValue = seiPrice?.price || 0.45; // Fallback to 0.45 if oracle fails
                depositUsdValue = amount * seiPriceValue;
                elizaLogger.info(`Converting ${amount} SEI to USD using price $${seiPriceValue}: $${depositUsdValue}`);
            }

            const projections = await vaultProvider.calculateProjectedReturns(
                runtime,
                vaultAddress,
                depositUsdValue,
                days
            );

            // Format response
            const response = formatProjectedReturnsResponse(
                vaultName,
                amount,
                currency,
                days,
                depositUsdValue,
                projections,
                metrics.apy
            );

            elizaLogger.info(`Projected returns response generated for ${vaultName}`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "PROJECTED_RETURNS",
                        vaultName,
                        depositAmount: amount,
                        currency,
                        days,
                        projections,
                        currentApy: metrics.apy
                    }
                });
            }

        } catch (error) {
            elizaLogger.error(`Error in projected returns action: ${error instanceof Error ? error.message : String(error)}`);

            if (callback) {
                callback({
                    text: "I encountered an error while calculating projected returns. Please try again in a moment.",
                    content: {
                        error: error instanceof Error ? error.message : "Unknown error",
                        action: "PROJECTED_RETURNS"
                    }
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What would I earn depositing 1000 SEI into Delta Neutral for 30 days?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Projected Returns for 1,000 SEI in Delta Neutral Vault (30 days):\n\n💰 Deposit: 1,000 SEI ($450.00)\n\n📊 Projections (based on current 12.5% APY):\n• Projected Value: $454.62\n• Gross Yield: $4.62\n• Management Fees: -$0.19\n• Net Yield: $4.43\n\n📤 On Withdrawal:\n• Withdrawal Fee: -$0.45\n• Final Value: $454.17\n\n⚠️ Note: Projections based on current APY. Actual returns may vary based on market conditions."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Calculate returns for 5000 USDC in Stable Max" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Projected Returns for 5,000 USDC in Stable Max Vault (30 days):\n\n💰 Deposit: 5,000 USDC ($5,000.00)\n\n📊 Projections (based on current 8.2% APY):\n• Projected Value: $5,033.70\n• Gross Yield: $33.70\n• Management Fees: -$1.23\n• Net Yield: $32.47\n\n📤 On Withdrawal:\n• Withdrawal Fee: -$2.50\n• Final Value: $5,030.97\n\n⚠️ Note: Projections based on current APY. Actual returns may vary based on market conditions."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "How much would I make with 10000 in Arbitrage for 90 days?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Projected Returns for 10,000 USD in Arbitrage Vault (90 days):\n\n💰 Deposit: 10,000 USD ($10,000.00)\n\n📊 Projections (based on current 22.4% APY):\n• Projected Value: $10,552.05\n• Gross Yield: $552.05\n• Management Fees: -$24.66\n• Net Yield: $527.39\n\n📤 On Withdrawal:\n• Withdrawal Fee: -$20.00\n• Final Value: $10,507.39\n\n⚠️ Note: Projections based on current APY. Actual returns may vary based on market conditions."
                }
            }
        ]
    ]
};

interface DepositParams {
    amount: number;
    currency: string;
    days: number;
}

function extractDepositParams(content: string): DepositParams {
    const lowerContent = content.toLowerCase();

    // Extract amount
    const amountMatch = content.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
    let amount = 0;
    if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    }

    // Extract currency
    let currency = "USD";
    if (lowerContent.includes("sei") && !lowerContent.includes("usdc")) {
        currency = "SEI";
    } else if (lowerContent.includes("usdc")) {
        currency = "USDC";
    } else if (lowerContent.includes("usdt")) {
        currency = "USDT";
    }

    // Extract days
    let days = 30; // Default
    const dayMatch = lowerContent.match(/(\d+)\s*day/);
    if (dayMatch) {
        days = parseInt(dayMatch[1], 10);
    } else if (lowerContent.includes("week")) {
        const weekMatch = lowerContent.match(/(\d+)\s*week/);
        days = weekMatch ? parseInt(weekMatch[1], 10) * 7 : 7;
    } else if (lowerContent.includes("month")) {
        const monthMatch = lowerContent.match(/(\d+)\s*month/);
        days = monthMatch ? parseInt(monthMatch[1], 10) * 30 : 30;
    } else if (lowerContent.includes("year")) {
        const yearMatch = lowerContent.match(/(\d+)\s*year/);
        days = yearMatch ? parseInt(yearMatch[1], 10) * 365 : 365;
    }

    return { amount, currency, days };
}

function formatProjectedReturnsResponse(
    vaultName: VaultName,
    amount: number,
    currency: string,
    days: number,
    depositUsdValue: number,
    projections: FormattedProjectedReturns,
    currentApy: number
): string {
    const displayName = VaultDisplayNames[vaultName];
    const amountFormatted = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const depositValueFormatted = depositUsdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const grossYield = projections.projectedYield;
    const netYield = grossYield - projections.managementFees;
    const finalValue = projections.projectedValue - projections.withdrawalFees;

    return `Projected Returns for ${amountFormatted} ${currency} in ${displayName} (${days} days):

💰 Deposit: ${amountFormatted} ${currency} ($${depositValueFormatted})

📊 Projections (based on current ${currentApy.toFixed(1)}% APY):
• Projected Value: $${projections.projectedValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
• Gross Yield: $${grossYield.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
• Management Fees: -$${projections.managementFees.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
• Net Yield: $${netYield.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

📤 On Withdrawal:
• Withdrawal Fee: -$${projections.withdrawalFees.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
• Final Value: $${finalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

⚠️ Note: Projections based on current APY. Actual returns may vary based on market conditions.`;
}
