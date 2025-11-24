import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  elizaLogger
} from "@elizaos/core";
import { SeiOracleProvider } from "../providers/sei-oracle";

/**
 * Price Query Action
 *
 * This action handles all cryptocurrency price queries by routing them
 * to the SEI Oracle Provider which fetches real-time prices from:
 * 1. CoinGecko API (primary - reliable, no geo-blocking)
 * 2. YEI Finance multi-oracle (API3, Pyth, Redstone)
 * 3. Pyth Network (on-chain oracle)
 * 4. Binance CEX prices (may be geo-blocked)
 */

const priceQueryTemplate = `Respond to cryptocurrency price queries with accurate, real-time data.

Recent messages:
{{recentMessages}}

Current message: "{{currentMessage}}"

Extract the cryptocurrency symbol(s) from the query and provide current price information.
Mention the data source for transparency.`;

export const priceQueryAction: Action = {
  name: "PRICE_QUERY",
  similes: [
    "GET_PRICE",
    "CHECK_PRICE",
    "CRYPTO_PRICE",
    "TOKEN_PRICE",
    "MARKET_PRICE"
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const content = message.content?.text?.toLowerCase() || '';

    // Keywords that indicate a price query
    const priceKeywords = [
      'price of', 'price for', 'current price', 'how much is',
      'what is the price', 'what\'s the price', 'whats the price',
      'sei price', 'btc price', 'eth price', 'usdc price',
      'trading at', 'worth', 'value of', 'quote'
    ];

    const hasKeyword = priceKeywords.some(keyword => content.includes(keyword));

    // Also check for common crypto symbols
    const cryptoSymbols = ['sei', 'btc', 'eth', 'usdc', 'usdt', 'sol', 'avax', 'atom'];
    const mentionsSymbol = cryptoSymbols.some(symbol => content.includes(symbol));

    // Valid if it has a price keyword OR mentions a crypto symbol with context words
    const contextWords = ['price', 'cost', 'worth', 'value', 'trading', 'quote'];
    const hasContext = contextWords.some(word => content.includes(word));

    return hasKeyword || (mentionsSymbol && hasContext);
  },

  description: "Get real-time cryptocurrency prices from oracle providers",

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<void> => {
    try {
      elizaLogger.info("Price Query Action triggered");

      const oracle = new SeiOracleProvider(runtime);
      const content = message.content?.text || '';

      // Extract symbols from the message
      const symbols = extractSymbols(content);

      if (symbols.length === 0) {
        if (callback) {
          callback({
            text: "I couldn't identify which cryptocurrency you're asking about. Please specify a symbol like SEI, BTC, ETH, or USDC.",
            content: {
              text: "I couldn't identify which cryptocurrency you're asking about. Please specify a symbol like SEI, BTC, ETH, or USDC.",
              action: 'PRICE_QUERY',
              error: 'No symbol identified'
            }
          });
        }
        return;
      }

      elizaLogger.info(`Fetching prices for symbols: ${symbols.join(', ')}`);

      // Fetch prices for all identified symbols
      const priceResults = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const price = await oracle.getPrice(symbol);
            return { symbol, price, error: null };
          } catch (error) {
            elizaLogger.error(`Failed to get price for ${symbol}: ${error}`);
            return { symbol, price: null, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        })
      );

      // Format the response
      let response = "";

      if (priceResults.length === 1) {
        const result = priceResults[0];
        if (result.price) {
          response = `The current price of ${result.symbol.toUpperCase()} is $${result.price.price.toFixed(4)} (Source: ${result.price.source}, updated ${formatTimestamp(result.price.timestamp)})`;
        } else {
          response = `I'm unable to fetch the current price for ${result.symbol.toUpperCase()} at the moment. ${result.error ? `Error: ${result.error}` : 'Please try again later.'}`;
        }
      } else {
        // Multiple symbols
        const successfulPrices = priceResults.filter(r => r.price !== null);
        const failedSymbols = priceResults.filter(r => r.price === null);

        if (successfulPrices.length > 0) {
          response = "Here are the current cryptocurrency prices:\n\n";
          successfulPrices.forEach(result => {
            if (result.price) {
              response += `${result.symbol.toUpperCase()}: $${result.price.price.toFixed(4)} (${result.price.source})\n`;
            }
          });

          if (failedSymbols.length > 0) {
            response += `\nUnable to fetch prices for: ${failedSymbols.map(r => r.symbol.toUpperCase()).join(', ')}`;
          }
        } else {
          response = "I'm unable to fetch cryptocurrency prices at the moment. Please try again later.";
        }
      }

      elizaLogger.info(`Price query response: ${response}`);

      if (callback) {
        callback({
          text: response,
          content: {
            text: response,
            action: 'PRICE_QUERY',
            prices: priceResults.filter(r => r.price !== null).map(r => ({
              symbol: r.symbol,
              price: r.price?.price,
              source: r.price?.source,
              timestamp: r.price?.timestamp
            }))
          }
        });
      }

    } catch (error) {
      elizaLogger.error(`Error in price query action: ${error instanceof Error ? error.message : String(error)}`);

      if (callback) {
        callback({
          text: "I encountered an error while fetching cryptocurrency prices. Please try again in a moment.",
          content: {
            error: error instanceof Error ? error.message : 'Unknown error',
            action: 'PRICE_QUERY'
          }
        });
      }
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What's the current price of SEI?" }
      },
      {
        name: "{{agentName}}",
        content: {
          text: "The current price of SEI is $0.1345 (Source: CoinGecko)"
        }
      }
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "How much is BTC and ETH trading at?" }
      },
      {
        name: "{{agentName}}",
        content: {
          text: "Here are the current cryptocurrency prices:\n\nBTC: $68,432.50 (CoinGecko)\nETH: $3,245.67 (CoinGecko)"
        }
      }
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "What is the price of SEI?" }
      },
      {
        name: "{{agentName}}",
        content: {
          text: "The current price of SEI is $0.1345 (Source: CoinGecko)"
        }
      }
    ]
  ]
};

/**
 * Extract cryptocurrency symbols from a text message
 */
function extractSymbols(text: string): string[] {
  const normalizedText = text.toUpperCase();
  const knownSymbols = ['BTC', 'ETH', 'SEI', 'USDC', 'USDT', 'SOL', 'AVAX', 'ATOM', 'DAI'];

  const foundSymbols = knownSymbols.filter(symbol => {
    // Match whole words or with common separators
    const regex = new RegExp(`\\b${symbol}\\b|${symbol}[/\\s,.]`, 'i');
    return regex.test(normalizedText);
  });

  // Remove duplicates and return
  return [...new Set(foundSymbols)];
}

/**
 * Format timestamp for human-readable display
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}
