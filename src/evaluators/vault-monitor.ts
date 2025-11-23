import {
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
    type Evaluator
} from "@elizaos/core";
import { vaultProvider } from "../providers/vault-provider";
import { formatUnits } from "viem";
import { VaultName, VaultDisplayNames } from "../types/vault";

/**
 * Vault Monitor Evaluator
 *
 * Periodically checks vault health and reports on:
 * - TVL changes
 * - APY performance
 * - Share price changes
 * - Alert on anomalies
 *
 * This is a READ-ONLY evaluator for monitoring purposes.
 * It does NOT execute any transactions or rebalancing.
 */

interface VaultHealthReport {
    vaultName: string;
    tvl: number;
    apy: number;
    pricePerShare: number;
    totalYield: number;
    status: "healthy" | "warning" | "critical";
    alerts: string[];
}

interface MonitoringReport {
    timestamp: number;
    overallStatus: "healthy" | "warning" | "critical";
    vaults: VaultHealthReport[];
    summary: string;
}

// Thresholds for health checks
const HEALTH_THRESHOLDS = {
    MIN_APY: 10, // Minimum expected APY (10%)
    TARGET_APY: 15, // Target APY (15%)
    MAX_APY_DEVIATION: 5, // Max deviation from target (5%)
    PRICE_PER_SHARE_MIN: 0.95, // Minimum price per share (shouldn't go below initial)
    TVL_WARNING_THRESHOLD: 1000, // Warn if TVL below this ($1000)
};

export const vaultMonitorEvaluator: Evaluator = {
    name: "VAULT_MONITOR",
    similes: ["MONITOR_VAULT", "CHECK_VAULT", "VAULT_HEALTH", "VAULT_STATUS"],
    description: "Monitors vault health, performance metrics, and generates alerts for anomalies",

    validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
        // This evaluator can run on any message or be triggered periodically
        // For now, allow it to run when explicitly requested or on a schedule
        const text = (message.content.text || "").toLowerCase();

        const monitorKeywords = [
            "monitor",
            "check vault",
            "vault health",
            "vault status",
            "how are the vaults",
            "vault performance",
            "check all vaults"
        ];

        return monitorKeywords.some(keyword => text.includes(keyword));
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ): Promise<any> => {
        try {
            elizaLogger.info("Running vault health monitoring...");

            // Initialize provider
            await vaultProvider.initialize(runtime);

            // Get all vaults
            const allVaults = await vaultProvider.getAllVaults(runtime);

            if (allVaults.length === 0) {
                return {
                    success: false,
                    data: {
                        message: "No vaults found. Please check vault configuration."
                    }
                };
            }

            const vaultReports: VaultHealthReport[] = [];
            let criticalCount = 0;
            let warningCount = 0;

            // Check each vault
            for (const vault of allVaults) {
                try {
                    const metrics = await vaultProvider.getVaultMetrics(
                        runtime,
                        vault.token0 // Using token0 as vault address for now
                    );

                    const report = evaluateVaultHealth(vault.name, metrics);
                    vaultReports.push(report);

                    if (report.status === "critical") criticalCount++;
                    else if (report.status === "warning") warningCount++;

                } catch (error) {
                    elizaLogger.warn(`Failed to monitor vault ${vault.name}: ${error}`);
                    vaultReports.push({
                        vaultName: vault.name,
                        tvl: 0,
                        apy: 0,
                        pricePerShare: 0,
                        totalYield: 0,
                        status: "critical",
                        alerts: ["Failed to fetch vault data"]
                    });
                    criticalCount++;
                }
            }

            // Determine overall status
            const overallStatus = criticalCount > 0
                ? "critical"
                : warningCount > 0
                ? "warning"
                : "healthy";

            // Generate summary
            const summary = generateSummary(vaultReports, overallStatus);

            const report: MonitoringReport = {
                timestamp: Date.now(),
                overallStatus,
                vaults: vaultReports,
                summary
            };

            elizaLogger.info(`Vault monitoring complete - Status: ${overallStatus}, Total: ${vaultReports.length}, Critical: ${criticalCount}, Warning: ${warningCount}`);

            return {
                success: true,
                data: report
            };

        } catch (error) {
            elizaLogger.error(`Error in vault monitor evaluator: ${error}`);
            return {
                success: false,
                data: {
                    error: error instanceof Error ? error.message : "Unknown error",
                    message: "Failed to monitor vault health"
                }
            };
        }
    },

    examples: [
        {
            context: "User wants to check overall vault health",
            messages: [
                {
                    name: "{{user1}}",
                    content: {
                        text: "How are all the vaults doing?"
                    }
                },
                {
                    name: "{{agentName}}",
                    content: {
                        text: "Checking vault health across all vaults...",
                        action: "VAULT_MONITOR"
                    }
                }
            ],
            outcome: "Vault health report generated with status for all vaults"
        },
        {
            context: "Scheduled health check",
            messages: [
                {
                    name: "{{user1}}",
                    content: {
                        text: "Monitor vault health"
                    }
                },
                {
                    name: "{{agentName}}",
                    content: {
                        text: "Running scheduled vault health check...",
                        action: "VAULT_MONITOR"
                    }
                }
            ],
            outcome: "Comprehensive health report with alerts if any issues detected"
        }
    ],

    alwaysRun: false // Set to true if you want this to run on every message
};

/**
 * Evaluate health of a single vault
 */
function evaluateVaultHealth(
    vaultName: string,
    metrics: any
): VaultHealthReport {
    const alerts: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";

    // Check TVL
    if (metrics.totalValueLocked < HEALTH_THRESHOLDS.TVL_WARNING_THRESHOLD) {
        alerts.push(`Low TVL: $${metrics.totalValueLocked.toFixed(2)}`);
        status = "warning";
    }

    // Check APY
    if (metrics.apy < HEALTH_THRESHOLDS.MIN_APY) {
        alerts.push(`APY below minimum: ${metrics.apy.toFixed(2)}% (expected >${HEALTH_THRESHOLDS.MIN_APY}%)`);
        status = "critical";
    } else if (Math.abs(metrics.apy - HEALTH_THRESHOLDS.TARGET_APY) > HEALTH_THRESHOLDS.MAX_APY_DEVIATION) {
        alerts.push(`APY deviating from target: ${metrics.apy.toFixed(2)}% (target: ${HEALTH_THRESHOLDS.TARGET_APY}%)`);
        if (status === "healthy") status = "warning";
    }

    // Check price per share (shouldn't decrease significantly)
    if (metrics.pricePerShare < HEALTH_THRESHOLDS.PRICE_PER_SHARE_MIN) {
        alerts.push(`Share price below minimum: ${metrics.pricePerShare.toFixed(4)}`);
        status = "critical";
    }

    // Check fees (informational)
    if (metrics.managementFeeRate > 2) {
        alerts.push(`High management fee: ${metrics.managementFeeRate.toFixed(2)}%`);
    }

    return {
        vaultName,
        tvl: metrics.totalValueLocked,
        apy: metrics.apy,
        pricePerShare: metrics.pricePerShare,
        totalYield: metrics.totalYieldGenerated,
        status,
        alerts
    };
}

/**
 * Generate a human-readable summary
 */
function generateSummary(
    reports: VaultHealthReport[],
    overallStatus: string
): string {
    const totalTVL = reports.reduce((sum, r) => sum + r.tvl, 0);
    const avgAPY = reports.reduce((sum, r) => sum + r.apy, 0) / reports.length;
    const totalYield = reports.reduce((sum, r) => sum + r.totalYield, 0);

    const healthyCount = reports.filter(r => r.status === "healthy").length;
    const warningCount = reports.filter(r => r.status === "warning").length;
    const criticalCount = reports.filter(r => r.status === "critical").length;

    let summary = `Vault Monitoring Report\n`;
    summary += `${"=".repeat(50)}\n\n`;
    summary += `Overall Status: ${overallStatus.toUpperCase()} ${getStatusEmoji(overallStatus)}\n\n`;

    summary += `📊 Summary:\n`;
    summary += `  Total Vaults: ${reports.length}\n`;
    summary += `  Healthy: ${healthyCount} | Warnings: ${warningCount} | Critical: ${criticalCount}\n`;
    summary += `  Total TVL: $${totalTVL.toLocaleString()}\n`;
    summary += `  Average APY: ${avgAPY.toFixed(2)}%\n`;
    summary += `  Total Yield Generated: $${totalYield.toLocaleString()}\n\n`;

    // Report on each vault
    summary += `📈 Vault Details:\n`;
    for (const report of reports) {
        summary += `\n${getStatusEmoji(report.status)} ${report.vaultName}:\n`;
        summary += `  TVL: $${report.tvl.toLocaleString()} | APY: ${report.apy.toFixed(2)}%\n`;
        summary += `  Price/Share: ${report.pricePerShare.toFixed(4)} | Yield: $${report.totalYield.toLocaleString()}\n`;

        if (report.alerts.length > 0) {
            summary += `  ⚠️  Alerts:\n`;
            report.alerts.forEach(alert => {
                summary += `     - ${alert}\n`;
            });
        }
    }

    // Add recommendations
    if (criticalCount > 0) {
        summary += `\n⚠️  CRITICAL: ${criticalCount} vault(s) need immediate attention!\n`;
    }
    if (warningCount > 0) {
        summary += `\n⚡ WARNING: ${warningCount} vault(s) showing concerning metrics.\n`;
    }
    if (overallStatus === "healthy") {
        summary += `\n✅ All vaults operating within normal parameters.\n`;
    }

    return summary;
}

/**
 * Get emoji for status
 */
function getStatusEmoji(status: string): string {
    switch (status) {
        case "healthy":
            return "✅";
        case "warning":
            return "⚠️";
        case "critical":
            return "🚨";
        default:
            return "❓";
    }
}

/**
 * Helper function to format vault report for display
 */
export function formatVaultReport(report: MonitoringReport): string {
    return report.summary;
}

/**
 * Check if any vaults need attention
 */
export function hasAlerts(report: MonitoringReport): boolean {
    return report.overallStatus !== "healthy";
}

/**
 * Get critical vaults only
 */
export function getCriticalVaults(report: MonitoringReport): VaultHealthReport[] {
    return report.vaults.filter(v => v.status === "critical");
}
