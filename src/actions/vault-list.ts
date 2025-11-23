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
    VaultName,
    VaultDisplayNames,
    VaultStrategies,
    VaultRiskLevels,
    RiskLevel,
    FormattedVaultInfo
} from "../types/vault";

export const vaultListAction: Action = {
    name: "VAULT_LIST",
    similes: [
        "LIST_VAULTS",
        "SHOW_VAULTS",
        "AVAILABLE_VAULTS",
        "VAULT_OPTIONS",
        "INVESTMENT_OPTIONS"
    ],

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const content = message.content?.text?.toLowerCase() || "";

        const listKeywords = [
            "what vaults",
            "which vaults",
            "available vaults",
            "show all vaults",
            "list vaults",
            "list all",
            "show vaults",
            "what strategies",
            "which strategies",
            "what can i invest",
            "what are my options",
            "investment options",
            "vault options",
            "all vaults"
        ];

        return listKeywords.some(keyword => content.includes(keyword));
    },

    description: "List all available vaults with key metrics like APY, TVL, and risk level",

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<void> => {
        try {
            elizaLogger.info("Vault List Action triggered");

            // Get all vaults
            const vaults = await vaultProvider.getAllVaults(runtime);

            if (vaults.length === 0) {
                if (callback) {
                    callback({
                        text: "No vaults are currently available. Please check your configuration.",
                        content: {
                            text: "No vaults available",
                            action: "VAULT_LIST",
                            vaults: []
                        }
                    });
                }
                return;
            }

            // Get metrics for each vault
            const vaultData: VaultListItem[] = [];

            for (const vault of vaults) {
                try {
                    const vaultName = getVaultNameFromInfo(vault.name);
                    if (!vaultName) continue;

                    const address = vaultProvider.getVaultAddress(vaultName);
                    if (!address) continue;

                    const metrics = await vaultProvider.getVaultMetrics(runtime, address);

                    vaultData.push({
                        name: vaultName,
                        displayName: VaultDisplayNames[vaultName],
                        apy: metrics.apy,
                        tvl: metrics.totalValueLocked,
                        risk: VaultRiskLevels[vaultName],
                        strategy: VaultStrategies[vaultName]
                    });
                } catch (error) {
                    elizaLogger.warn(`Failed to get metrics for vault ${vault.name}: ${error}`);
                }
            }

            // Sort by APY descending
            vaultData.sort((a, b) => b.apy - a.apy);

            // Format response
            const response = formatVaultListResponse(vaultData);

            elizaLogger.info(`Vault list response generated for ${vaultData.length} vaults`);

            if (callback) {
                callback({
                    text: response,
                    content: {
                        text: response,
                        action: "VAULT_LIST",
                        vaults: vaultData
                    }
                });
            }

        } catch (error) {
            elizaLogger.error(`Error in vault list action: ${error instanceof Error ? error.message : String(error)}`);

            if (callback) {
                callback({
                    text: "I encountered an error while fetching the vault list. Please try again in a moment.",
                    content: {
                        error: error instanceof Error ? error.message : "Unknown error",
                        action: "VAULT_LIST"
                    }
                });
            }
        }
    },

    examples: [
        [
            {
                name: "{{user1}}",
                content: { text: "What vaults are available?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Available Yield Delta Vaults:\n\n🟡 SEI Hypergrowth Vault\n   APY: 24.8% | TVL: $456K | Risk: High\n   Strategy: Leveraged SEI exposure\n\n🟡 Arbitrage Vault\n   APY: 22.4% | TVL: $234K | Risk: Medium-High\n   Strategy: Cross-DEX arbitrage\n\n🟢 Yield Farming Vault\n   APY: 18.7% | TVL: $345K | Risk: Medium\n   Strategy: Optimized LP farming\n\n🔵 Concentrated Liquidity Vault\n   APY: 16.9% | TVL: $567K | Risk: Medium\n   Strategy: Active CL position management\n\n🔵 Blue Chip Vault\n   APY: 15.3% | TVL: $2.1M | Risk: Medium\n   Strategy: BTC/ETH diversified yield\n\n🔵 Delta Neutral Vault\n   APY: 12.5% | TVL: $1.23M | Risk: Low\n   Strategy: Delta-neutral yield with IL protection\n\n🟠 Hedge Vault\n   APY: 10.1% | TVL: $678K | Risk: Low\n   Strategy: Hedged positions with downside protection\n\n🟢 Stable Max Vault\n   APY: 8.2% | TVL: $890K | Risk: Very Low\n   Strategy: Stablecoin optimization\n\nUse 'vault metrics [name]' for detailed info on any vault."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Show all vaults" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Available Yield Delta Vaults:\n\n🟡 SEI Hypergrowth Vault\n   APY: 24.8% | TVL: $456K | Risk: High\n   Strategy: Leveraged SEI exposure\n\n🟡 Arbitrage Vault\n   APY: 22.4% | TVL: $234K | Risk: Medium-High\n   Strategy: Cross-DEX arbitrage\n\n🔵 Delta Neutral Vault\n   APY: 12.5% | TVL: $1.23M | Risk: Low\n   Strategy: Delta-neutral yield with IL protection\n\n🟢 Stable Max Vault\n   APY: 8.2% | TVL: $890K | Risk: Very Low\n   Strategy: Stablecoin optimization\n\nUse 'vault metrics [name]' for detailed info on any vault."
                }
            }
        ],
        [
            {
                name: "{{user1}}",
                content: { text: "Which strategies can I invest in?" }
            },
            {
                name: "{{agentName}}",
                content: {
                    text: "Available Yield Delta Vaults:\n\n🟡 SEI Hypergrowth Vault\n   APY: 24.8% | TVL: $456K | Risk: High\n   Strategy: Leveraged SEI exposure\n\n🔵 Blue Chip Vault\n   APY: 15.3% | TVL: $2.1M | Risk: Medium\n   Strategy: BTC/ETH diversified yield\n\n🔵 Delta Neutral Vault\n   APY: 12.5% | TVL: $1.23M | Risk: Low\n   Strategy: Delta-neutral yield with IL protection\n\nUse 'vault metrics [name]' for detailed info on any vault."
                }
            }
        ]
    ]
};

interface VaultListItem {
    name: VaultName;
    displayName: string;
    apy: number;
    tvl: number;
    risk: RiskLevel;
    strategy: string;
}

function getVaultNameFromInfo(infoName: string): VaultName | null {
    const lowerName = infoName.toLowerCase();

    for (const [key, value] of Object.entries(VaultDisplayNames)) {
        if (value.toLowerCase().includes(lowerName) || lowerName.includes(value.toLowerCase())) {
            return key as VaultName;
        }
    }

    // Try matching by key
    for (const vaultName of Object.values(VaultName)) {
        if (lowerName.includes(vaultName.replace(/-/g, " "))) {
            return vaultName;
        }
    }

    return null;
}

function getRiskEmoji(risk: RiskLevel): string {
    switch (risk) {
        case "Very Low":
            return "🟢";
        case "Low":
            return "🔵";
        case "Medium":
            return "🔵";
        case "Medium-High":
            return "🟡";
        case "High":
            return "🟡";
        default:
            return "⚪";
    }
}

function formatVaultListResponse(vaults: VaultListItem[]): string {
    if (vaults.length === 0) {
        return "No vaults are currently available.";
    }

    let response = "Available Yield Delta Vaults:\n";

    for (const vault of vaults) {
        const emoji = getRiskEmoji(vault.risk);
        const tvlFormatted = vault.tvl >= 1000000
            ? `$${(vault.tvl / 1000000).toFixed(2)}M`
            : `$${(vault.tvl / 1000).toFixed(0)}K`;

        response += `\n${emoji} ${vault.displayName}\n`;
        response += `   APY: ${vault.apy.toFixed(1)}% | TVL: ${tvlFormatted} | Risk: ${vault.risk}\n`;
        response += `   Strategy: ${vault.strategy}\n`;
    }

    response += "\nUse 'vault metrics [name]' for detailed info on any vault.";

    return response;
}
