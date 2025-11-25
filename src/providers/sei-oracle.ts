import {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  elizaLogger,
} from "@elizaos/core";
import { createPublicClient, http } from 'viem';
import { seiChains } from './wallet';

export interface PriceFeed {
  symbol: string;
  price: number;
  timestamp: number;
  source: string;
  confidence: number;
}

export interface FundingRate {
  symbol: string;
  rate: number; // Annual percentage
  timestamp: number;
  exchange: string;
  nextFundingTime: number;
}

export interface OracleConfig {
  pythPriceFeeds: Record<string, string>; // symbol -> price feed ID
  chainlinkFeeds: Record<string, string>; // symbol -> feed address
  cexApis: {
    binance: string;
    bybit: string;
    okx: string;
  };
  updateInterval: number; // seconds
}

interface YeiOracleConfig {
  api3ContractAddress: string;
  pythContractAddress: string;
  redstoneContractAddress: string;
}

interface YeiMultiOracleAddresses {
  SEI?: string;
  USDC?: string;
  USDT?: string;
  ETH?: string;
  BTC?: string;
}

export class SeiOracleProvider {
  private runtime: IAgentRuntime;
  private config: OracleConfig;
  private priceCache: Map<string, PriceFeed> = new Map();
  private fundingRateCache: Map<string, FundingRate[]> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  private yeiConfig: YeiOracleConfig;
  private yeiMultiOracleAddresses: YeiMultiOracleAddresses;

  // Runtime chain configuration from environment
  private runtimeChain: ReturnType<typeof createPublicClient>['chain'];

  // Cached public client to avoid recreating it for each query
  private runtimeClient: ReturnType<typeof createPublicClient> | null = null;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;

    // Get the chain configuration from runtime settings (like WalletProvider does)
    const network = runtime.getSetting("SEI_NETWORK") || "sei-testnet";
    const networkMap: Record<string, keyof typeof seiChains> = {
      "sei-mainnet": "mainnet",
      "sei-testnet": "testnet"
    };
    const chainKey = networkMap[network] || "testnet";
    this.runtimeChain = seiChains[chainKey];

    elizaLogger.info(`SeiOracleProvider: Configured for ${network} (chain: ${chainKey})`);

    // Get oracle addresses from runtime settings with fallback to defaults
    const api3Address = runtime.getSetting("YEI_API3_CONTRACT") || "0x2880aB155794e7179c9eE2e38200202908C17B43";
    const pythAddress = runtime.getSetting("YEI_PYTH_CONTRACT") || "0x2880aB155794e7179c9eE2e38200202908C17B43";
    const redstoneAddress = runtime.getSetting("YEI_REDSTONE_CONTRACT") || "0x1111111111111111111111111111111111111111";

    this.yeiConfig = {
      api3ContractAddress: api3Address,
      pythContractAddress: pythAddress,
      redstoneContractAddress: redstoneAddress
    };

    // Initialize YEI Finance Multi-Oracle addresses with defaults
    this.yeiMultiOracleAddresses = {
      SEI: runtime.getSetting("YEI_SEI_ORACLE") || "0xa2aCDc40e5ebCE7f8554E66eCe6734937A48B3f3",
      USDC: runtime.getSetting("YEI_USDC_ORACLE") || "0xEAb459AD7611D5223A408A2e73b69173F61bb808",
      USDT: runtime.getSetting("YEI_USDT_ORACLE") || "0x284db472a483e115e3422dd30288b24182E36DdB",
      ETH: runtime.getSetting("YEI_ETH_ORACLE") || "0x3E45Fb956D2Ba2CB5Fa561c40E5912225E64F7B2",
      BTC: runtime.getSetting("YEI_BTC_ORACLE")
    };

    this.config = {
      pythPriceFeeds: {
        'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'SEI': '0x53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb',
        'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
      },
      // Chainlink is not available on SEI - these feeds are disabled
      chainlinkFeeds: {},
      cexApis: {
        binance: 'https://fapi.binance.com/fapi/v1',
        bybit: 'https://api.bybit.com/v5',
        okx: 'https://www.okx.com/api/v5',
      },
      updateInterval: 30, // 30 seconds
    };
  }

  /**
   * Get or create cached runtime public client with polling disabled
   */
  private getRuntimeClient() {
    if (!this.runtimeClient) {
      this.runtimeClient = createPublicClient({
        chain: this.runtimeChain,
        transport: http(),
        pollingInterval: 0, // Disable automatic polling
      });
    }
    return this.runtimeClient;
  }

  async get(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<string | null> {
    try {
      // If no message content, return provider description
      if (!message?.content?.text) {
        return "SEI Oracle Provider: Real-time price data and funding rates for assets on the SEI blockchain using Pyth, Chainlink, and CEX APIs.";
      }
      
      const text = message.content.text.toLowerCase();
      
      if (text.includes('price') || text.includes('quote')) {
        return await this.handlePriceQuery(text);
      }
      
      if (text.includes('funding') || text.includes('rate')) {
        return await this.handleFundingRateQuery(text);
      }
      
      return null;
    } catch (error) {
      elizaLogger.error(`Oracle provider error: ${error}`);
      return null;
    }
  }

  private async handlePriceQuery(text: string): Promise<string> {
    const symbols = this.extractSymbols(text);
    const prices: PriceFeed[] = [];

    for (const symbol of symbols) {
      const price = await this.getPrice(symbol);
      if (price) prices.push(price);
    }

    if (prices.length === 0) {
      return "No price data available for the requested symbols.";
    }

    return prices.map(p => 
      `${p.symbol}: $${p.price.toFixed(4)} (${p.source})`
    ).join('\n');
  }

  private async handleFundingRateQuery(text: string): Promise<string> {
    const symbols = this.extractSymbols(text);
    const fundingData: string[] = [];

    for (const symbol of symbols) {
      const rates = await this.getFundingRates(symbol);
      if (rates.length > 0) {
        const ratesText = rates.map(r => 
          `${r.exchange}: ${(r.rate * 100).toFixed(4)}%`
        ).join(', ');
        fundingData.push(`${symbol}: ${ratesText}`);
      }
    }

    return fundingData.length > 0 
      ? fundingData.join('\n')
      : "No funding rate data available.";
  }

  async getPrice(symbol: string): Promise<PriceFeed | null> {
    try {
      // Check cache first - compare with runtime cache if available
      const cached = this.priceCache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.config.updateInterval * 1000) {
        return cached;
      }

      // Try runtime cache first if available - disabled due to cacheManager not available
      // if (this.runtime.cacheManager) {
      //   try {
      //     const runtimeCached = await this.runtime.cacheManager.get(`price_${symbol}`);
      //     if (runtimeCached && Date.now() - runtimeCached.timestamp < this.config.updateInterval * 1000) {
      //       this.priceCache.set(symbol, runtimeCached);
      //       return runtimeCached;
      //     }
      //   } catch (error) {
      //     // Cache error, continue with fetch
      //   }
      // }

      // **PRIORITY ORDER: Real-time price sources**
      // 1. YEI Finance Multi-Oracle (PRIMARY - token-specific contracts with getLatestPrice)
      // 2. CoinGecko (fallback - reliable, no geo-blocking, instant response)
      // 3. YEI Finance legacy multi-oracle (API3, Pyth, Redstone - for supported symbols)
      // 4. Pyth Network (on-chain oracle)
      // 5. Binance CEX API (may be geo-blocked in some regions)

      let price: PriceFeed | null = null;

      // Priority 1: YEI Finance Multi-Oracle (PRIMARY - direct token-specific contracts)
      price = await this.getYeiMultiOraclePrice(symbol);
      if (price) {
        elizaLogger.info(`Using YEI Multi-Oracle price for ${symbol}: $${price.price}`);
      }

      // Priority 2: CoinGecko API (fallback - most reliable, no geo-blocking)
      if (!price) {
        price = await this.getCoinGeckoPrice(symbol);
        if (price) {
          elizaLogger.info(`Using CoinGecko price for ${symbol}: $${price.price}`);
        }
      }

      // Priority 3: Try YEI Finance legacy multi-oracle approach (for YEI-supported symbols)
      if (!price) {
        const yeiSupportedSymbols = ['BTC', 'ETH', 'SEI', 'USDC', 'USDT'];
        if (yeiSupportedSymbols.includes(symbol.toUpperCase())) {
          try {
            const yeiPrice = await this.getYeiPrice(symbol);
            if (yeiPrice && yeiPrice > 0) {
              price = {
                symbol,
                price: yeiPrice,
                source: 'yei-legacy-oracle',
                timestamp: Date.now(),
                confidence: 0.95
              };
              elizaLogger.info(`Using YEI legacy oracle price for ${symbol}: $${price.price}`);
            }
          } catch (error) {
            elizaLogger.warn(`YEI legacy oracle failed for ${symbol}: ${error}`);
          }
        }
      }

      // Priority 4: Pyth Network (on-chain oracle)
      if (!price) {
        price = await this.getPythPrice(symbol);
        if (price) {
          elizaLogger.info(`Using Pyth price for ${symbol}: $${price.price}`);
        }
      }

      // Priority 5: Binance CEX API (may be geo-blocked)
      if (!price) {
        price = await this.getCexPrice(symbol);
        if (price) {
          elizaLogger.info(`Using Binance CEX price for ${symbol}: $${price.price}`);
        }
      }

      if (price && !isNaN(price.price) && price.price > 0) {
        this.priceCache.set(symbol, price);
        // Also cache in runtime if available - disabled due to cacheManager not available
        // if (this.runtime.cacheManager) {
        //   try {
        //     await this.runtime.cacheManager.set(`price_${symbol}`, price);
        //   } catch (error) {
        //     // Cache error, continue
        //   }
        // }
        return price;
      }

      return null;
    } catch (error) {
      elizaLogger.error(`Failed to get price for ${symbol}: ${error}`);
      return null;
    }
  }

  async getFundingRates(symbol: string): Promise<FundingRate[]> {
    try {
      // Check runtime cache first - disabled due to cacheManager not available
      // if (this.runtime.cacheManager) {
      //   try {
      //     const runtimeCached = await this.runtime.cacheManager.get(`funding_rates_${symbol}`);
      //     if (runtimeCached && Array.isArray(runtimeCached) && runtimeCached.length > 0) {
      //       return runtimeCached;
      //     }
      //   } catch (cacheError) {
      //     elizaLogger.warn("Cache retrieval failed for funding rates:", cacheError);
      //   }
      // }

      // Check internal cache as fallback
      const cached = this.fundingRateCache.get(symbol);
      if (cached && cached.length > 0 && Date.now() - cached[0]?.timestamp < this.config.updateInterval * 1000) {
        return cached;
      }

      const rates = await Promise.all([
        this.getBinanceFundingRate(symbol),
        this.getBybitFundingRate(symbol),
        this.getOkxFundingRate(symbol),
      ]);

      const validRates = rates.filter(r => r !== null) as FundingRate[];
      
      if (validRates.length > 0) {
        this.fundingRateCache.set(symbol, validRates);
        
        // Cache in runtime cache manager as well - disabled due to cacheManager not available
        // if (this.runtime.cacheManager) {
        //   try {
        //     await this.runtime.cacheManager.set(`funding_rates_${symbol}`, validRates);
        //   } catch (cacheError) {
        //     elizaLogger.warn("Cache storage failed for funding rates:", cacheError);
        //   }
        // }
      }

      return validRates;
    } catch (error) {
      elizaLogger.error(`Failed to get funding rates for ${symbol}: ${error}`);
      return [];
    }
  }

  private async getPythPrice(symbol: string): Promise<PriceFeed | null> {
    try {
      const feedId = this.config.pythPriceFeeds[symbol];
      if (!feedId) return null;

      // Use runtime chain configuration
      const publicClient = this.getRuntimeClient();

      // Pyth EVM uses getPriceUnsafe which returns a Price struct
      const result = await publicClient.readContract({
        address: '0x2880aB155794e7179c9eE2e38200202908C17B43' as `0x${string}`,
        abi: [
          {
            name: 'getPriceUnsafe',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'id', type: 'bytes32' }],
            outputs: [
              {
                name: 'price',
                type: 'tuple',
                components: [
                  { name: 'price', type: 'int64' },
                  { name: 'conf', type: 'uint64' },
                  { name: 'expo', type: 'int32' },
                  { name: 'publishTime', type: 'uint256' }
                ]
              }
            ]
          }
        ] as const,
        functionName: 'getPriceUnsafe',
        args: [feedId as `0x${string}`]
      }) as { price: bigint; conf: bigint; expo: number; publishTime: bigint };

      if (!result || result.price === BigInt(0)) {
        return null; // Invalid price data
      }

      // Calculate price: price * 10^expo
      const priceValue = Number(result.price) * Math.pow(10, result.expo);
      const confidence = Number(result.conf) * Math.pow(10, result.expo);
      const timestamp = Number(result.publishTime) * 1000; // Convert to milliseconds

      // Validate price data
      if (isNaN(priceValue) || priceValue <= 0) {
        return null;
      }

      return {
        symbol,
        price: priceValue,
        timestamp,
        source: 'pyth',
        confidence
      };
    } catch (error) {
      elizaLogger.error(`Pyth price fetch error for ${symbol}: ${error}`);
      return null;
    }
  }

  private async getCoinGeckoPrice(symbol: string): Promise<PriceFeed | null> {
    try {
      // Map symbols to CoinGecko IDs
      const coinGeckoIds: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SEI': 'sei-network',
        'USDC': 'usd-coin',
        'USDT': 'tether',
        'SOL': 'solana',
        'AVAX': 'avalanche-2',
        'ATOM': 'cosmos',
        'DAI': 'dai'
      };

      const coinId = coinGeckoIds[symbol.toUpperCase()];
      if (!coinId) {
        return null;
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
      );

      if (response.ok) {
        const data = await response.json() as Record<string, { usd: number }>;
        const price = data[coinId]?.usd;

        // Validate price data
        if (!price || isNaN(price) || price <= 0) {
          return null;
        }

        return {
          symbol,
          price,
          timestamp: Date.now(),
          source: 'CoinGecko',
          confidence: 0.95
        };
      }

      return null;
    } catch (error) {
      elizaLogger.error(`CoinGecko price fetch error for ${symbol}: ${error}`);
      return null;
    }
  }

  private async getCexPrice(symbol: string): Promise<PriceFeed | null> {
    try {
      // Only try for supported symbols
      const supportedSymbols = ['BTC', 'ETH', 'SEI', 'USDC', 'SOL', 'AVAX'];
      if (!supportedSymbols.includes(symbol)) {
        return null;
      }

      const response = await fetch(
        `${this.config.cexApis.binance}/ticker/price?symbol=${symbol}USDT`
      );

      if (response.ok) {
        const data = await response.json() as { price: string };
        const price = parseFloat(data.price);

        // Validate price data
        if (isNaN(price) || price <= 0) {
          return null;
        }

        return {
          symbol,
          price,
          timestamp: Date.now(),
          source: 'Binance',
          confidence: 0.95
        };
      }

      return null;
    } catch (error) {
      elizaLogger.error(`CEX price fetch error for ${symbol}: ${error}`);
      return null;
    }
  }

  /**
   * Get price from YEI Finance Multi-Oracle contract
   * Uses token-specific oracle addresses with getLatestPrice() interface
   */
  private async getYeiMultiOraclePrice(symbol: string): Promise<PriceFeed | null> {
    try {
      const oracleAddress = this.yeiMultiOracleAddresses[symbol.toUpperCase() as keyof YeiMultiOracleAddresses];

      if (!oracleAddress) {
        elizaLogger.debug(`No YEI Multi-Oracle address configured for ${symbol}`);
        return null;
      }

      const publicClient = this.getRuntimeClient();

      // YEI Finance Multi-Oracle ABI for getLatestPrice()
      const result = await publicClient.readContract({
        address: oracleAddress as `0x${string}`,
        abi: [
          {
            name: 'getLatestPrice',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [
              { name: 'price', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' },
              { name: 'decimals', type: 'uint8' }
            ]
          }
        ] as const,
        functionName: 'getLatestPrice'
      }) as [bigint, bigint, number];

      const price = result[0];
      const timestamp = result[1];
      const decimals = result[2];

      // Validate price data
      if (!price || price === BigInt(0)) {
        elizaLogger.warn(`YEI Multi-Oracle returned zero price for ${symbol}`);
        return null;
      }

      // Calculate formatted price: price / (10 ** decimals)
      const formattedPrice = Number(price) / Math.pow(10, decimals);
      const timestampMs = Number(timestamp) * 1000; // Convert to milliseconds

      // Validate that price is recent (within 1 hour)
      const now = Date.now();
      if (now - timestampMs > 3600000) {
        elizaLogger.warn(`YEI Multi-Oracle price too old for ${symbol}: ${Math.floor((now - timestampMs) / 1000)}s ago`);
        // Still return the price but log the warning
      }

      elizaLogger.info(`YEI Multi-Oracle price for ${symbol}: $${formattedPrice.toFixed(6)} (decimals: ${decimals}, age: ${Math.floor((now - timestampMs) / 1000)}s)`);

      return {
        symbol,
        price: formattedPrice,
        timestamp: timestampMs,
        source: 'YEI Multi-Oracle',
        confidence: 0.98
      };
    } catch (error) {
      elizaLogger.error(`YEI Multi-Oracle price fetch error for ${symbol}: ${error}`);
      return null;
    }
  }

  private async getBinanceFundingRate(symbol: string): Promise<FundingRate | null> {
    try {
      const response = await fetch(
        `${this.config.cexApis.binance}/premiumIndex?symbol=${symbol}USDT`
      );
      
      if (response.ok) {
        const data = await response.json() as { lastFundingRate: string; nextFundingTime: string };
        return {
          symbol,
          rate: parseFloat(data.lastFundingRate) * 8760, // Convert to annual
          timestamp: Date.now(),
          exchange: 'Binance',
          nextFundingTime: parseInt(data.nextFundingTime)
        };
      }

      return null;
    } catch (error) {
      elizaLogger.error(`Binance funding rate error for ${symbol}: ${error}`);
      return null;
    }
  }

  private async getBybitFundingRate(symbol: string): Promise<FundingRate | null> {
    try {
      const response = await fetch(
        `${this.config.cexApis.bybit}/market/tickers?category=linear&symbol=${symbol}USDT`
      );
      
      if (response.ok) {
        const data = await response.json() as { result: { list: Array<{ fundingRate: string; nextFundingTime: string }> } };
        const ticker = data.result.list[0];
        
        return {
          symbol,
          rate: parseFloat(ticker.fundingRate) * 8760, // Convert to annual
          timestamp: Date.now(),
          exchange: 'Bybit',
          nextFundingTime: parseInt(ticker.nextFundingTime)
        };
      }

      return null;
    } catch (error) {
      elizaLogger.error(`Bybit funding rate error for ${symbol}: ${error}`);
      return null;
    }
  }

  private async getOkxFundingRate(symbol: string): Promise<FundingRate | null> {
    try {
      const response = await fetch(
        `${this.config.cexApis.okx}/public/funding-rate?instId=${symbol}-USDT-SWAP`
      );
      
      if (response.ok) {
        const data = await response.json() as { data: Array<{ fundingRate: string; fundingTime: string; nextFundingTime: string }> };
        const fundingData = data.data[0];
        
        return {
          symbol,
          rate: parseFloat(fundingData.fundingRate) * 8760, // Convert to annual
          timestamp: parseInt(fundingData.fundingTime),
          exchange: 'OKX',
          nextFundingTime: parseInt(fundingData.nextFundingTime)
        };
      }

      return null;
    } catch (error) {
      elizaLogger.error(`OKX funding rate error for ${symbol}: ${error}`);
      return null;
    }
  }

  private extractSymbols(text: string): string[] {
    const symbols = ['BTC', 'ETH', 'SEI', 'USDC', 'SOL', 'AVAX'];
    return symbols.filter(symbol => 
      text.toUpperCase().includes(symbol)
    );
  }

  startPriceUpdates(): void {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(async () => {
      try {
        // Update cached prices for major symbols
        const symbols = ['BTC', 'ETH', 'SEI'];
        await Promise.all(symbols.map(symbol => this.getPrice(symbol)));
        await Promise.all(symbols.map(symbol => this.getFundingRates(symbol)));
      } catch (error) {
        elizaLogger.error(`Price update error: ${error}`);
      }
    }, this.config.updateInterval * 1000);
  }

  /**
   * YEI Finance Multi-Oracle Strategy
   * Implements API3, Pyth Network, and Redstone oracles with sophisticated fallback logic
   */
  private async getYeiPrice(symbol: string): Promise<number> {
    // Priority 1: API3 dAPI (Primary oracle for YEI Finance)
    try {
      const api3Price = await this.getAPI3Price(symbol);
      if (api3Price && api3Price > 0) {
        elizaLogger.log(`YEI API3 price for ${symbol}: ${api3Price}`);
        return api3Price;
      }
    } catch (error) {
      elizaLogger.error(`YEI API3 price fetch failed for ${symbol}: ${error}`);
    }

    // Priority 2: Pyth Network (Backup with 100+ publishers)
    try {
      const pythPrice = await this.getPythPrice(symbol);
      if (pythPrice && pythPrice.price > 0) {
        elizaLogger.log(`YEI Pyth price for ${symbol}: ${pythPrice.price}`);
        return pythPrice.price;
      }
    } catch (error) {
      elizaLogger.error(`YEI Pyth price fetch failed for ${symbol}: ${error}`);
    }

    // Priority 3: Redstone Classic (USDT/USDC fallback)
    try {
      const redstonePrice = await this.getRedstonePrice(symbol);
      if (redstonePrice && redstonePrice > 0) {
        elizaLogger.log(`YEI Redstone price for ${symbol}: ${redstonePrice}`);
        return redstonePrice;
      }
    } catch (error) {
      elizaLogger.error(`YEI Redstone price fetch failed for ${symbol}: ${error}`);
    }

    throw new Error(`All YEI oracle sources failed for ${symbol}`);
  }

  /**
   * API3 dAPI Integration for YEI Finance
   */
  private async getAPI3Price(symbol: string): Promise<number> {
    const dApiId = this.getAPI3dApiId(symbol);
    const publicClient = this.getRuntimeClient();

    const result = await publicClient.readContract({
      address: this.yeiConfig.api3ContractAddress as `0x${string}`,
      abi: [
        {
          inputs: [{ name: "dApiId", type: "bytes32" }],
          name: "readDataFeed",
          outputs: [
            { name: "value", type: "int224" },
            { name: "timestamp", type: "uint32" }
          ],
          stateMutability: "view",
          type: "function"
        }
      ] as const,
      functionName: "readDataFeed",
      args: [dApiId]
    });

    const price = Number(result[0]) / 1e18; // Assuming 18 decimals
    const timestamp = Number(result[1]);

    // Validate price data (should be recent and reasonable)
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 3600) { // More than 1 hour old
      throw new Error(`API3 price data too old for ${symbol}`);
    }

    return price;
  }

  /**
   * Redstone Classic Oracle Integration
   */
  private async getRedstonePrice(symbol: string): Promise<number> {
    const publicClient = this.getRuntimeClient();

    // Only support USDT and USDC for Redstone Classic
    if (!['USDT', 'USDC'].includes(symbol)) {
      throw new Error(`Redstone feed not available for ${symbol}`);
    }

    const feedId = this.stringToBytes32(`${symbol}/USD`);

    const result = await publicClient.readContract({
      address: this.yeiConfig.redstoneContractAddress as `0x${string}`,
      abi: [
        {
          inputs: [{ name: "feedId", type: "bytes32" }],
          name: "getLatestRoundData",
          outputs: [
            { name: "price", type: "int256" },
            { name: "timestamp", type: "uint256" }
          ],
          stateMutability: "view",
          type: "function"
        }
      ] as const,
      functionName: "getLatestRoundData",
      args: [feedId]
    });

    return Number(result[0]) / 1e8; // Assuming 8 decimals for USD pairs
  }

  /**
   * Get API3 dAPI ID for symbol
   */
  private getAPI3dApiId(symbol: string): `0x${string}` {
    const dApiIds: Record<string, string> = {
      'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', 
      'SEI': '0x53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb',
      'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a'
    };

    const dApiId = dApiIds[symbol.toUpperCase()];
    if (!dApiId) {
      throw new Error(`No API3 dAPI ID configured for ${symbol}`);
    }

    return dApiId as `0x${string}`;
  }


  /**
   * Convert string to bytes32 for Redstone
   */
  private stringToBytes32(str: string): `0x${string}` {
    const hex = Buffer.from(str).toString('hex').padEnd(64, '0');
    return `0x${hex}` as `0x${string}`;
  }

  stopPriceUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

let oracleInstance: SeiOracleProvider | null = null;

export const oracleProvider = {
  name: "seiOracle",
  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    // Create or reuse singleton instance
    if (!oracleInstance) {
      oracleInstance = new SeiOracleProvider(runtime);
      // Start automatic price updates
      oracleInstance.startPriceUpdates();
      elizaLogger.info("SEI Oracle Provider initialized and price updates started");
    }
    return oracleInstance.get(runtime, message, state);
  }
};