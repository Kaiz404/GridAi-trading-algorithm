import { getAllGrids, incrementGridTrades } from "./grid.ts";
import { createTrade } from "./trade.ts";
import type { IGrid } from "./models/grid.model.ts";
import type { ITrade } from "./models/trade.model.ts";
import { Types } from "mongoose";

/**
 * Creates mock trades for all grids in the database
 * This is useful for testing and demonstration purposes
 */
export async function generateMockTradesForAllGrids(): Promise<void> {
  try {
    console.log("Starting mock trade generation...");

    // Get all grids
    const grids = await getAllGrids();
    
    if (grids.length === 0) {
      console.log("No grids found in the database to create mock trades for.");
      return;
    }

    console.log(`Found ${grids.length} grids. Creating mock trades...`);

    // Process each grid
    for (const grid of grids) {
      await generateMockTradesForGrid(grid);
    }

    console.log("Mock trade generation completed successfully!");
  } catch (error) {
    console.error("Error generating mock trades:", error);
  }
}

/**
 * Generates 5 mock trades for a specific grid
 * Alternates between buy and sell trades
 */
async function generateMockTradesForGrid(grid: IGrid): Promise<void> {
  try {
    console.log(`Generating mock trades for grid ${grid._id} (${grid.sourceTokenSymbol}/${grid.targetTokenSymbol})`);

    // Price range between lower and upper limit
    const priceRange = grid.upperLimit - grid.lowerLimit;
    
    // Get middle of the grid
    const middlePrice = grid.lowerLimit + (priceRange / 2);

    let buyCount = 0;
    let sellCount = 0;

    // Generate 5 trades for this grid
    for (let i = 0; i < 5; i++) {
      // Alternate between buy and sell
      const side = i % 2 === 0 ? "BUY" : "SELL";
      if (side === "BUY") buyCount++;
      else sellCount++;
      
      // Randomize price around the middle of the grid, but within grid limits
      const randomFactor = 0.8 + (Math.random() * 0.4); // between 0.8 and 1.2
      const price = Math.min(
        Math.max(middlePrice * randomFactor, grid.lowerLimit), 
        grid.upperLimit
      );

      // Determine which grid level this price falls into
      const levels = Object.entries(grid.levels)
        .map(([key, value]) => ({ index: parseInt(key), price: value }))
        .sort((a, b) => a.price - b.price);
      
      let gridLevel = 0;
      for (let j = 0; j < levels.length - 1; j++) {
        if (price >= levels[j].price && price < levels[j+1].price) {
          gridLevel = levels[j].index;
          break;
        }
      }

      // For demonstration, use a percentage of the total invested amount as the trade amount
      const baseTradeAmount = grid.quantityInvested * (0.05 + (Math.random() * 0.1)); // 5-15% of total
      
      // Calculate input and output amounts
      let inputAmount, outputAmount, profit;
      if (side === "BUY") {
        // When buying, we input target token (usually stablecoin) and output source token
        inputAmount = baseTradeAmount;
        outputAmount = inputAmount / price;
        profit = null; // Buy orders don't have profit
      } else {
        // When selling, we input source token and output target token
        outputAmount = baseTradeAmount;
        inputAmount = outputAmount / price;
        // Calculate a small profit (1-5% of the transaction)
        profit = Math.random() * 0.04 * outputAmount + 0.01 * outputAmount;
      }

      // Create a mock transaction hash
      const txHash = `mock-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      
      // Create timestamp between 1-30 days ago
      const now = new Date();
      const randomDaysAgo = Math.floor(Math.random() * 30) + 1;
      const timestamp = new Date(now);
      timestamp.setDate(now.getDate() - randomDaysAgo);
      
      // Create the trade object
      const tradeData: Omit<ITrade, "_id" | "createdAt" | "updatedAt"> = {
        gridId: new Types.ObjectId(grid._id),
        side,
        inputToken: side === "BUY" ? grid.targetTokenSymbol : grid.sourceTokenSymbol,
        outputToken: side === "BUY" ? grid.sourceTokenSymbol : grid.targetTokenSymbol,
        inputTokenId: side === "BUY" ? grid.targetTokenId : grid.sourceTokenId,
        outputTokenId: side === "BUY" ? grid.sourceTokenId : grid.targetTokenId,
        inputAmount: parseFloat(inputAmount.toFixed(6)),
        outputAmount: parseFloat(outputAmount.toFixed(6)),
        gridLevel,
        executedAt: timestamp,
        transactionHash: txHash,
        profit: side === "SELL" ? parseFloat(profit.toFixed(6)) : undefined
      };

      // Create the trade in the database
      const trade = await createTrade(tradeData);
      console.log(`Created ${side} trade at price $${price.toFixed(2)} for grid ${grid._id}`);
    }

    // Update grid trade counts
    if (buyCount > 0 || sellCount > 0) {
      await incrementGridTrades(grid._id, { buys: buyCount, sells: sellCount });
      console.log(`Updated grid statistics: ${buyCount} buys, ${sellCount} sells`);
    }

    console.log(`Successfully created 5 mock trades for grid ${grid._id}`);
  } catch (error) {
    console.error(`Error creating mock trades for grid ${grid._id}:`, error);
  }
}

/**
 * Helper function to get a human-readable token symbol from a token address
 * Note: This is a fallback; we now use the sourceTokenSymbol/targetTokenSymbol from the grid
 */
function getTokenSymbol(tokenId: string): string {
  // Common token mappings
  const tokenMap: Record<string, string> = {
    "So11111111111111111111111111111111111111112": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP",
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": "BONK",
    "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof": "RNDR"
  };
  
  return tokenMap[tokenId] || tokenId.substring(0, 8) + "...";
}

// Export the function for use in other modules
export default generateMockTradesForAllGrids;

generateMockTradesForAllGrids()
.then(() => {
    console.log("Mock trade generation script completed");
    process.exit(0);
})
.catch(error => {
    console.error("Error in mock trade generation script:", error);
    process.exit(1);
});