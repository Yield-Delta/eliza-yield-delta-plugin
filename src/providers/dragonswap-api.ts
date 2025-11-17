import { elizaLogger } from "@elizaos/core";
import { WalletProvider } from "./wallet";

// DragonSwap router ABI for swap operations
export const DRAGONSWAP_ROUTER_ABI = [
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" }
    ],
    name: "swapExactETHForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "payable",
    type: "function"
  }
];

export interface DragonSwapTradeParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number;
  deadline?: number;
}

export interface DragonSwapPoolInfo {
  address: string;
  token0: string;
  token1: string;
  fee: number;
  liquidity: string;
  price: string;
}

export interface DragonSwapQuote {
  amountOut: string;
  priceImpact: number;
  route: string[];
  gasEstimate?: string;
}

export class DragonSwapProvider {
  private baseUrl: string;
  private graphqlUrl: string;
  private walletProvider?: WalletProvider;
  private routerAddress: `0x${string}`;

  constructor(apiUrl?: string, walletProvider?: WalletProvider, isTestnet: boolean = false) {
    this.baseUrl = apiUrl || (isTestnet
      ? 'https://api-testnet.dragonswap.app/v1'
      : 'https://api.dragonswap.app/v1');

    // DragonSwap V3 GraphQL API on Goldsky
    this.graphqlUrl = 'https://api.goldsky.com/api/public/project_clu1fg6ajhsho01x7ajld3f5a/subgraphs/dragonswap-v3-prod/1.0.5/gn';

    this.walletProvider = walletProvider;
    
    // Replace with actual DragonSwap router contract addresses
    this.routerAddress = isTestnet 
      ? '0x1234567890123456789012345678901234567890' as `0x${string}`  // Mock testnet router
      : '0x1234567890123456789012345678901234567890' as `0x${string}`; // Mock mainnet router
  }

  /**
   * Get pool information for a token pair
   */
  async getPoolInfo(tokenA: string, tokenB: string): Promise<DragonSwapPoolInfo | null> {
    try {
      // Try REST API first
      const response = await fetch(`${this.baseUrl}/pools/${tokenA.toLowerCase()}/${tokenB.toLowerCase()}`);
      if (response.ok) {
        return await response.json();
      }

      // Fallback to GraphQL subgraph
      elizaLogger.log(`REST API failed, trying GraphQL for ${tokenA}/${tokenB}`);
      const pools = await this.findPoolByTokens(tokenA, tokenB);

      if (pools && pools.length > 0) {
        // Return the pool with highest liquidity
        const bestPool = pools.sort((a, b) =>
          parseFloat(b.liquidity) - parseFloat(a.liquidity)
        )[0];

        return {
          address: bestPool.id,
          token0: bestPool.token0.id,
          token1: bestPool.token1.id,
          fee: bestPool.feeTier || 3000,
          liquidity: bestPool.liquidity,
          price: "0" // Would need additional calculation
        };
      }

      elizaLogger.warn(`DragonSwap pool info not found for ${tokenA}/${tokenB}`);
      return null;
    } catch (error) {
      elizaLogger.error(`Failed to get DragonSwap pool info:: ${error}`);
      return null;
    }
  }

  /**
   * Get a quote for a token swap
   */
  async getQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<DragonSwapQuote | null> {
    try {
      const response = await fetch(`${this.baseUrl}/quote`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tokenIn: tokenIn.toLowerCase(),
          tokenOut: tokenOut.toLowerCase(),
          amountIn
        })
      });

      if (!response.ok) {
        elizaLogger.warn(`DragonSwap quote failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return {
        amountOut: data.amountOut,
        priceImpact: data.priceImpact || 0,
        route: data.route || [tokenIn, tokenOut],
        gasEstimate: data.gasEstimate || "200000"
      };
    } catch (error) {
      elizaLogger.error(`Failed to get DragonSwap quote:: ${error}`);
      return null;
    }
  }

  /**
   * Execute a token swap on DragonSwap
   */
  async executeSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    minAmountOut: string,
    walletAddress: string,
    slippage: number = 0.5
  ): Promise<string | null> {
    if (!this.walletProvider) {
      throw new Error("Wallet provider not configured for DragonSwap execution");
    }

    try {
      elizaLogger.log(`Executing DragonSwap trade: ${amountIn} ${tokenIn} → ${tokenOut}`);

      // Get the optimal route
      const quote = await this.getQuote(tokenIn, tokenOut, amountIn);
      if (!quote) {
        throw new Error("Failed to get swap quote from DragonSwap");
      }

      // Calculate minimum amount out with slippage
      const minAmountOutWithSlippage = (
        parseFloat(quote.amountOut) * (1 - slippage / 100)
      ).toString();

      // Build transaction parameters
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
      const path = quote.route;

      // Execute the swap transaction
      const txParams = {
        to: this.routerAddress,
        data: this.buildSwapCalldata({
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          minAmountOut: minAmountOutWithSlippage,
          deadline
        }),
        value: tokenIn.toLowerCase() === '0x0' ? BigInt(amountIn) : BigInt(0),
        gas: BigInt(quote.gasEstimate || "250000")
      };

      // Get wallet client for transaction execution
      const walletClient = this.walletProvider.getEvmWalletClient();
      const txHash = await walletClient.sendTransaction({
        account: walletClient.account,
        ...txParams
      } as any);
      elizaLogger.log(`DragonSwap transaction sent: ${txHash}`);
      
      return txHash;
    } catch (error) {
      elizaLogger.error(`DragonSwap execution failed:: ${error}`);
      throw error;
    }
  }

  /**
   * Get available tokens on DragonSwap
   */
  async getSupportedTokens(): Promise<Record<string, any>> {
    try {
      const response = await fetch(`${this.baseUrl}/tokens`);
      if (!response.ok) {
        elizaLogger.warn("Failed to fetch DragonSwap tokens");
        return {};
      }
      return await response.json();
    } catch (error) {
      elizaLogger.error(`Failed to get DragonSwap supported tokens:: ${error}`);
      return {};
    }
  }

  /**
   * Get liquidity information for a token pair
   */
  async getLiquidity(tokenA: string, tokenB: string): Promise<{
    totalLiquidity: string;
    token0Reserve: string;
    token1Reserve: string;
  } | null> {
    try {
      const poolInfo = await this.getPoolInfo(tokenA, tokenB);
      if (!poolInfo) return null;

      return {
        totalLiquidity: poolInfo.liquidity,
        token0Reserve: "0", // Would need to fetch from contract
        token1Reserve: "0"  // Would need to fetch from contract
      };
    } catch (error) {
      elizaLogger.error(`Failed to get DragonSwap liquidity:: ${error}`);
      return null;
    }
  }

  /**
   * Check if a token pair has sufficient liquidity
   */
  async hasInsufficientLiquidity(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<boolean> {
    try {
      const quote = await this.getQuote(tokenIn, tokenOut, amountIn);
      if (!quote) return true;

      // Consider high price impact as insufficient liquidity
      return quote.priceImpact > 5; // 5% threshold
    } catch (error) {
      elizaLogger.error(`Failed to check DragonSwap liquidity:: ${error}`);
      return true;
    }
  }

  /**
   * Query DragonSwap GraphQL API
   */
  private async queryGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        elizaLogger.warn(`GraphQL query failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const result = await response.json();
      if (result.errors) {
        elizaLogger.error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        return null;
      }

      return result.data;
    } catch (error) {
      elizaLogger.error(`GraphQL query error:: ${error}`);
      return null;
    }
  }

  /**
   * Get pool data from GraphQL subgraph
   */
  async getPoolDataFromSubgraph(poolAddress: string): Promise<any> {
    const query = `
      query GetPool($poolAddress: String!) {
        pool(id: $poolAddress) {
          id
          token0 {
            id
            symbol
            name
            decimals
          }
          token1 {
            id
            symbol
            name
            decimals
          }
          liquidity
          sqrtPrice
          tick
          feeTier
          volumeUSD
          txCount
        }
      }
    `;

    return await this.queryGraphQL(query, { poolAddress: poolAddress.toLowerCase() });
  }

  /**
   * Get top pools by volume
   */
  async getTopPools(limit: number = 10): Promise<any[]> {
    const query = `
      query GetTopPools($limit: Int!) {
        pools(first: $limit, orderBy: volumeUSD, orderDirection: desc) {
          id
          token0 {
            symbol
          }
          token1 {
            symbol
          }
          volumeUSD
          liquidity
          feeTier
        }
      }
    `;

    const data = await this.queryGraphQL(query, { limit });
    return data?.pools || [];
  }

  /**
   * Get token price from GraphQL
   */
  async getTokenPrice(tokenAddress: string): Promise<number | null> {
    const query = `
      query GetToken($tokenAddress: String!) {
        token(id: $tokenAddress) {
          derivedETH
          volume
          volumeUSD
          txCount
        }
      }
    `;

    const data = await this.queryGraphQL(query, { tokenAddress: tokenAddress.toLowerCase() });
    if (data?.token?.derivedETH) {
      return parseFloat(data.token.derivedETH);
    }
    return null;
  }

  /**
   * Get recent swaps for a pool
   */
  async getRecentSwaps(poolAddress: string, limit: number = 10): Promise<any[]> {
    const query = `
      query GetSwaps($poolAddress: String!, $limit: Int!) {
        swaps(
          first: $limit,
          orderBy: timestamp,
          orderDirection: desc,
          where: { pool: $poolAddress }
        ) {
          id
          timestamp
          amount0
          amount1
          amountUSD
          sender
          recipient
        }
      }
    `;

    const data = await this.queryGraphQL(query, { poolAddress: poolAddress.toLowerCase(), limit });
    return data?.swaps || [];
  }

  /**
   * Search pools by token symbols
   */
  async findPoolByTokens(token0Symbol: string, token1Symbol: string): Promise<any[]> {
    const query = `
      query FindPools($token0: String!, $token1: String!) {
        pools(
          where: {
            or: [
              { and: [{ token0_contains_nocase: $token0 }, { token1_contains_nocase: $token1 }] },
              { and: [{ token0_contains_nocase: $token1 }, { token1_contains_nocase: $token0 }] }
            ]
          }
        ) {
          id
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
          liquidity
          volumeUSD
          feeTier
        }
      }
    `;

    const data = await this.queryGraphQL(query, { token0: token0Symbol, token1: token1Symbol });
    return data?.pools || [];
  }

  /**
   * Get liquidity positions for an address
   */
  async getUserPositions(userAddress: string): Promise<any[]> {
    const query = `
      query GetPositions($userAddress: String!) {
        positions(where: { owner: $userAddress }) {
          id
          liquidity
          token0 {
            symbol
          }
          token1 {
            symbol
          }
          pool {
            id
            feeTier
          }
        }
      }
    `;

    const data = await this.queryGraphQL(query, { userAddress: userAddress.toLowerCase() });
    return data?.positions || [];
  }

  /**
   * Build calldata for swap transaction
   */
  private buildSwapCalldata(params: DragonSwapTradeParams & { 
    minAmountOut: string; 
    deadline: number 
  }): `0x${string}` {
    // This would typically use a library like ethers or viem to encode the function call
    // For now, return a mock calldata
    
    // In a real implementation, you would:
    // 1. Use the router ABI to encode the function call
    // 2. Handle different swap types (ETH vs ERC20)
    // 3. Properly encode the path array
    
    elizaLogger.log(`Building DragonSwap swap calldata for ${params.amountIn} of token ${params.tokenIn}`);
    
    // Mock calldata - in real implementation, use proper ABI encoding
    return "0x38ed173900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002" as `0x${string}`;
  }

  /**
   * Estimate gas for a swap transaction
   */
  async estimateGas(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<string> {
    try {
      // In a real implementation, you would simulate the transaction
      // For now, return a reasonable gas estimate
      const isNativeSwap = tokenIn.toLowerCase() === '0x0' || tokenOut.toLowerCase() === '0x0';
      return isNativeSwap ? "150000" : "200000";
    } catch (error) {
      elizaLogger.error(`Failed to estimate DragonSwap gas:: ${error}`);
      return "250000"; // Safe fallback
    }
  }

  /**
   * Get current gas price for transactions
   */
  async getGasPrice(): Promise<string> {
    try {
      if (this.walletProvider) {
        // Use wallet provider to get current gas price
        return "1000000000"; // 1 gwei fallback
      }
      return "1000000000";
    } catch (error) {
      elizaLogger.error(`Failed to get gas price:: ${error}`);
      return "1000000000";
    }
  }

  /**
   * Validate a token address format
   */
  private isValidTokenAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address) || address === '0x0';
  }

  /**
   * Get trading fee for a token pair
   */
  async getTradingFee(tokenA: string, tokenB: string): Promise<number> {
    try {
      const poolInfo = await this.getPoolInfo(tokenA, tokenB);
      return poolInfo?.fee || 0.003; // 0.3% default
    } catch (error) {
      elizaLogger.error(`Failed to get DragonSwap trading fee:: ${error}`);
      return 0.003; // Default 0.3%
    }
  }
}

// Export for backward compatibility
export { DragonSwapProvider as DragonSwapAPI };
