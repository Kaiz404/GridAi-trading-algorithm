import * as dotenv from "dotenv";
import { getAllGrids, getGridById, updateGridCurrentPrice, updateGridTokenAmounts, incrementGridTrades } from "./database/grid.ts";
import { createTrade } from "./database/trade.ts";
import getTokenPrices from "./jupiter/getTokenPrice.ts";
import { quoteAndSwap } from "./jupiter/swap.ts";
import { Types } from "mongoose";
import type { IGrid } from "./database/models/grid.model.ts";

dotenv.config();

/**
 * Main grid trading bot that monitors prices and executes trades
 */
class GridTradingBot {
  private grids: IGrid[] = [];
  private isRunning: boolean = false;
  private priceMonitorInterval: NodeJS.Timeout | null = null;
  private gridStateMap: Map<string, {
    currentGridIndex: number | null,
    lastCheckedPrice: number | null,
    tokenAmounts: {
      source: number,
      target: number
    }
  }> = new Map();

  /**
   * Initialize the bot by loading grid configurations from the database
   */
  async initialize() {
    try {
      console.log("Initializing GridAI trading bot...");
      
      // Load all grid configurations
      this.grids = await getAllGrids();
      console.log(`Loaded ${this.grids.length} grid configurations`);
      
      // Initialize state tracking for each grid
      for (const grid of this.grids) {
        this.gridStateMap.set(grid._id, {
          currentGridIndex: grid.currentGridIndex || null,
          lastCheckedPrice: grid.currentPrice || null,
          tokenAmounts: {
            source: grid.sourceTokenAmount || 0,
            target: grid.targetTokenAmount || 0
          }
        });
        
        console.log(`Initialized grid ${grid._id}: ${grid.sourceTokenSymbol}/${grid.targetTokenSymbol}`);
        console.log(`  Price range: ${grid.lowerLimit} - ${grid.upperLimit}`);
        console.log(`  Grid levels: ${grid.gridCount}`);
      }
      
      return true;
    } catch (error) {
      console.error("Error initializing grid trading bot:", error);
      return false;
    }
  }

  /**
   * Start the grid trading bot
   */
  async start() {
    if (this.isRunning) {
      console.log("Grid trading bot is already running");
      return;
    }

    try {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("Failed to initialize grid bot");
      }

      console.log("Starting GridAI trading bot...");
      this.isRunning = true;

      // Start monitoring prices at regular intervals
      this.priceMonitorInterval = setInterval(() => {
        this.monitorPricesAndExecuteTrades().catch(err => {
          console.error("Error in price monitoring loop:", err);
        });
      }, 5000); // Check prices every second

      console.log("Grid trading bot started successfully!");
    } catch (error) {
      console.error("Error starting grid trading bot:", error);
      this.stop();
    }
  }

  /**
   * Stop the grid trading bot
   */
  stop() {
    console.log("Stopping GridAI trading bot...");
    
    this.isRunning = false;
    
    if (this.priceMonitorInterval) {
      clearInterval(this.priceMonitorInterval);
      this.priceMonitorInterval = null;
    }
    
    console.log("Grid trading bot stopped");
  }

  /**
   * Monitor prices for all tokens and execute trades when conditions are met
   */
  private async monitorPricesAndExecuteTrades() {
    if (!this.isRunning || this.grids.length === 0) return;

    try {
      // Get unique list of tokens to check prices for
      const uniqueTokenIds = [...new Set(this.grids.map(grid => grid.targetTokenId))];
      
      // Fetch prices for all tokens at once
      const priceResponse = await getTokenPrices(uniqueTokenIds);
      
      if (!priceResponse.success) {
        console.error("Failed to fetch token prices:", priceResponse.error);
        return;
      }
      
      const tokenPrices = priceResponse.data.data;
      
      // Process each grid
      for (const grid of this.grids) {
        await this.processGrid(grid, tokenPrices);
      }
    } catch (error) {
      console.error("Error in monitoring prices:", error);
    }
  }

  /**
   * Process a single grid with current price data
   */
  private async processGrid(grid: IGrid, tokenPrices: any) {
    try {
      // Get current price for the grid's source token
      const currentPrice = tokenPrices[grid.targetTokenId]?.price;
      
      if (!currentPrice) {
        console.log(`No price data available for ${grid.sourceTokenSymbol}`);
        return;
      }

      // Format price for better readability
      const formattedPrice = parseFloat(currentPrice).toFixed(6);
      
      // Get grid state from our tracking map
      const gridState = this.gridStateMap.get(grid._id);
      if (!gridState) {
        console.error(`No state found for grid ${grid._id}`);
        return;
      }
      
      // Update state with latest price
      const lastPrice = gridState.lastCheckedPrice;
      gridState.lastCheckedPrice = parseFloat(currentPrice);
      
      // Find the current grid level based on price
      const newGridIndex = this.findGridLevelIndex(grid, parseFloat(currentPrice));
      const previousGridIndex = gridState.currentGridIndex;

      // If this is the first check or we're initializing, just record the level without trading
      if (previousGridIndex === null) {
        console.log(`Initializing grid ${grid._id} at level ${newGridIndex} with price ${formattedPrice}`);
        gridState.currentGridIndex = newGridIndex;
        
        // Update grid in database with current price and level
        await updateGridCurrentPrice(grid._id, parseFloat(currentPrice));
        return;
      }
      
      // If level has changed, execute trade based on direction
      if (newGridIndex !== previousGridIndex) {
        console.log(`Price ${formattedPrice} moved from level ${previousGridIndex} to ${newGridIndex} for ${grid.sourceTokenSymbol}/${grid.targetTokenSymbol}`);
        
        // Price moved up - execute SELL orders
        if (newGridIndex > previousGridIndex) {
          console.log(`Price moved up from level ${previousGridIndex} to ${newGridIndex}`);
          // Execute trades for all levels between previous and new index
          for (let i = previousGridIndex + 1; i <= newGridIndex; i++) {
            await this.executeSellTrade(grid, i);
          }
        } 
        // Price moved down - execute BUY orders
        else if (newGridIndex < previousGridIndex) {
          console.log(`Price moved down from level ${previousGridIndex} to ${newGridIndex}`);
          // Execute trades for all levels between new and previous index
          for (let i = previousGridIndex; i > newGridIndex; i--) {
            await this.executeBuyTrade(grid, i);
          }
        }
        
        // Update grid state with new index
        gridState.currentGridIndex = newGridIndex;
        
        // Update grid in database with current price and level
        await updateGridCurrentPrice(grid._id, parseFloat(currentPrice));
      }
    } catch (error) {
      console.error(`Error processing grid ${grid._id}:`, error);
    }
  }

  /**
   * Find the grid level index for a given price
   */
  private findGridLevelIndex(grid: IGrid, price: number): number {
    // If price is above the highest grid level, return the highest index
    if (price >= grid.upperLimit) {
      return grid.gridCount;
    }
    
    // If price is below the lowest grid level, return the lowest index
    if (price <= grid.lowerLimit) {
      return 0;
    }
    
    // Find the matching grid level
    const levels = Object.entries(grid.levels)
      .map(([key, value]) => ({ index: parseInt(key), price: value }))
      .sort((a, b) => a.price - b.price);
    
    for (let i = 0; i < levels.length - 1; i++) {
      if (price >= levels[i].price && price < levels[i + 1].price) {
        return levels[i].index;
      }
    }
    
    // Fallback to the middle grid level
    return Math.floor(grid.gridCount / 2);
  }

  /**
   * Execute a BUY trade when price crosses down a grid level
   */
  private async executeBuyTrade(grid: IGrid, levelIndex: number): Promise<void> {
    try {
      console.log(`Executing BUY at level ${levelIndex} for ${grid.sourceTokenSymbol}/${grid.targetTokenSymbol}`);
      
      // Get the price for this level
      const levelPrice = grid.levels[levelIndex.toString()];
      if (!levelPrice) {
        console.error(`No price found for level ${levelIndex}`);
        return;
      }
      
      // Calculate the amount to buy based on the grid configuration
      // For a grid with N levels, we allocate quantity/N for each level
      const usdInvestmentPerLevel = grid.quantityInvested / grid.gridCount;

      // Convert USD amount to equivalent SOL amount
      // If SOL is $100 and we want to invest $10 per level, we get 0.1 SOL
      const sourceTokenAmount = usdInvestmentPerLevel / levelPrice;

      // Log the calculation for clarity
      console.log(`Level ${levelIndex} - Price: $${levelPrice}`);
      console.log(`USD per level: $${usdInvestmentPerLevel.toFixed(2)}`);
      console.log(`SOL to buy: ${sourceTokenAmount.toFixed(6)} SOL`);
      


      const gridState = this.gridStateMap.get(grid._id);
      if (!gridState) return;
      
      console.log(`BUY: ${usdInvestmentPerLevel.toFixed(6)} ${grid.targetTokenSymbol} → ${sourceTokenAmount.toFixed(6)} ${grid.sourceTokenSymbol} at price ${levelPrice}`);
      
      // Execute the swap
      const swapResult = await quoteAndSwap(
        grid.sourceTokenId,  // from targetToken (e.g., USDC)
        grid.targetTokenId,  // to sourceToken (e.g., SOL)
        Math.floor(usdInvestmentPerLevel * 1000000), // Convert to smallest units (e.g., lamports)
        100 // 1% slippage
      );
      
      if (!swapResult.success) {
        // console.error(`Swap failed: ${swapResult.error}`);
        return;
      }
      
      // Update token balances
      gridState.tokenAmounts.source += sourceTokenAmount;
      gridState.tokenAmounts.target -= usdInvestmentPerLevel;
      
      // Update database with new token amounts
      await updateGridTokenAmounts(
        grid._id,
        gridState.tokenAmounts.source,
        gridState.tokenAmounts.target
      );
      
      // Increment the buy count for this grid
      await incrementGridTrades(grid._id, { buys: 1 });
      
      // Record the trade in the database
      await createTrade({
        gridId: new Types.ObjectId(grid._id),
        side: "BUY",
        inputToken: grid.targetTokenSymbol,
        outputToken: grid.sourceTokenSymbol,
        inputTokenId: grid.targetTokenId,
        outputTokenId: grid.sourceTokenId,
        inputAmount: sourceTokenAmount,
        outputAmount: usdInvestmentPerLevel,
        gridLevel: levelIndex,
        executedAt: new Date(),
        transactionHash: swapResult.signature,
        profit: undefined // BUY orders don't have profit
      });
      
      console.log(`BUY trade executed successfully for grid ${grid._id} at level ${levelIndex}`);
      console.log(`Transaction: ${swapResult.txUrl}`);
    } catch (error) {
      console.error(`Error executing BUY trade for grid ${grid._id}:`, error);
    }
  }

  /**
   * Execute a SELL trade when price crosses up a grid level
   */
  private async executeSellTrade(grid: IGrid, levelIndex: number): Promise<void> {
    try {
      console.log(`Executing SELL at level ${levelIndex} for ${grid.sourceTokenSymbol}/${grid.targetTokenSymbol}`);
      
      // Get the price for this level
      const levelPrice = grid.levels[levelIndex.toString()];
      if (!levelPrice) {
        console.error(`No price found for level ${levelIndex}`);
        return;
      }
      
      // Calculate the amount to sell based on the grid configuration
      const baseAmount = grid.quantityInvested / grid.gridCount / levelPrice;
      const sourceTokenAmount = baseAmount;    // should be in usdc for demo
      const targetTokenAmount = sourceTokenAmount * levelPrice; // Convert to target token
      
      const gridState = this.gridStateMap.get(grid._id);
      if (!gridState) return;
      
      console.log(`SELL: ${sourceTokenAmount.toFixed(6)} ${grid.sourceTokenSymbol} → ${targetTokenAmount.toFixed(6)} ${grid.targetTokenSymbol} at price ${levelPrice}`);
      
      // Execute the swap
      const swapResult = await quoteAndSwap(
        grid.sourceTokenId,  // from sourceToken (e.g., SOL)
        grid.targetTokenId,  // to targetToken (e.g., USDC)
        Math.floor(sourceTokenAmount * 1000000), // Convert to smallest units (e.g., lamports)
        100 // 1% slippage
      );
      
      if (!swapResult.success) {
        // console.error(`Swap failed: ${swapResult.error}`);
        return;
      }
      
      // Calculate profit
      // For sells, we compare with the buy price from the previous level
      const buyPrice = levelIndex > 0 ? grid.levels[(levelIndex - 1).toString()] : grid.lowerLimit;
      const sellPrice = levelPrice;
      const profit = (sellPrice - buyPrice) * sourceTokenAmount;
      
      // Update token balances
      gridState.tokenAmounts.source -= sourceTokenAmount;
      gridState.tokenAmounts.target += targetTokenAmount;
      
      // Update database with new token amounts
      await updateGridTokenAmounts(
        grid._id,
        gridState.tokenAmounts.source,
        gridState.tokenAmounts.target
      );

      // Increment the sell count for this grid
      await incrementGridTrades(grid._id, { sells: 1 });
      
      // Record the trade in the database
      await createTrade({
        gridId: new Types.ObjectId(grid._id),
        side: "SELL",
        inputToken: grid.sourceTokenSymbol,
        outputToken: grid.targetTokenSymbol,
        inputTokenId: grid.sourceTokenId,
        outputTokenId: grid.targetTokenId,
        inputAmount: sourceTokenAmount,
        outputAmount: targetTokenAmount,
        gridLevel: levelIndex,
        executedAt: new Date(),
        transactionHash: swapResult.signature,
        profit: profit
      });
      
      console.log(`SELL trade executed successfully for grid ${grid._id} at level ${levelIndex}`);
      console.log(`Transaction: ${swapResult.txUrl}`);
      console.log(`Profit: ${profit.toFixed(6)} ${grid.targetTokenSymbol}`);
    } catch (error) {
      console.error(`Error executing SELL trade for grid ${grid._id}:`, error);
    }
  }
}

/**
 * Main function to run the grid trading bot
 */
async function main() {
  try {
    console.log("Starting GridAI Trading Bot...");
    
    const bot = new GridTradingBot();
    await bot.start();
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('Received SIGINT signal. Shutting down...');
      bot.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM signal. Shutting down...');
      bot.stop();
      process.exit(0);
    });
    
    console.log("Grid trading bot is now running. Press CTRL+C to stop.");
  } catch (error) {
    console.error("Error in main function:", error);
    process.exit(1);
  }
}

// Start the bot
main().catch(console.error);