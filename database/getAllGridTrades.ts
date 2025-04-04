import { getAllGrids } from "../database/grid.ts";
import { getTradesByGridId, getTradeSummaryByGridId } from "../database/trade.ts";
import type { IGrid } from "./models/grid.model.ts";
import type { ITrade } from "./models/trade.model.ts";

/**
 * Fetches and prints all transactions from all grid IDs in the database
 * Includes summary statistics for each grid
 */
export async function printAllTransactions(): Promise<void> {
  try {
    console.log("=== Fetching All Grid Trading Transactions ===");
    
    // Step 1: Get all grids
    const grids = await getAllGrids();
    
    if (grids.length === 0) {
      console.log("No grids found in the database.");
      return;
    }
    
    console.log(`Found ${grids.length} grids in the database.\n`);
    
    // For each grid, get and display its trades
    for (let i = 0; i < grids.length; i++) {
      const grid = grids[i];
      
      console.log(`\n===== Grid ${i + 1}/${grids.length} =====`);
      console.log(`Grid ID: ${grid._id}`);
      console.log(`Trading Pair: ${grid.sourceTokenSymbol} / ${grid.targetTokenSymbol}`);
      console.log(`Range: ${grid.lowerLimit} to ${grid.upperLimit} USDC`);
      console.log(`Grid Count: ${grid.gridCount}`);
      
      // Get trades for this grid
      const trades = await getTradesByGridId(grid._id);
      
      if (trades.length === 0) {
        console.log("No trades found for this grid.");
        continue;
      }
      
      console.log("Getting trades... Done!");
      // Get trade summary
      const summary = await getTradeSummaryByGridId(grid._id);
      
      console.log(`\nTrade Summary:`);
      console.log(`- Total Buys: ${summary.totalBuys}`);
      console.log(`- Total Sells: ${summary.totalSells}`);
      console.log(`- Total Profit: ${summary.totalProfit.toFixed(6)} USDC`);
      
      console.log(`\nIndividual Trades (${trades.length}):`);
      
      // Print trades table header
      console.log("\n| # | Type | Price | Amount | Profit | Timestamp |");
      console.log("|---|------|-------|--------|--------|-----------|");
      
      // Print each trade
      trades.forEach((trade, index) => {
        const price = (trade.outputAmount / trade.inputAmount).toFixed(4);
        const tradeAmount = trade.side === "BUY" 
          ? trade.outputAmount.toFixed(4)
          : trade.inputAmount.toFixed(4);
        const profit = trade.profit ? trade.profit.toFixed(4) : "N/A";
        const timestamp = trade.executedAt 
          ? new Date(trade.executedAt).toISOString().replace('T', ' ').slice(0, 19)
          : new Date(trade.createdAt).toISOString().replace('T', ' ').slice(0, 19);
          
        console.log(`| ${index + 1} | ${trade.side} | ${price} | ${tradeAmount} | ${profit} | ${timestamp} |`);
      });
      
      console.log("\n");
    }
    
    console.log("=== All Transactions Fetched Successfully ===");
    
  } catch (error) {
    console.error("Error fetching transactions:", error);
  }
}

/**
 * Helper function to get a human-readable token symbol from a token address
 */
function getTokenSymbol(tokenId: string): string {
  // Common token mappings
  const tokenMap: Record<string, string> = {
    "So11111111111111111111111111111111111111112": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": "JUP"
  };
  
  return tokenMap[tokenId] || tokenId.substring(0, 8) + "...";
}

// Example usage:
printAllTransactions().catch(console.error);



