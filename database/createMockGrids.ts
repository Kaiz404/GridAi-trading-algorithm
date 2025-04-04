import { createGrid } from "./grid.ts";
import { Types } from "mongoose";
import type { IGrid } from "./models/grid.model.ts";

/**
 * Creates mock grid trading configurations in the database
 * This is useful for testing and demonstration purposes
 */
export async function generateMockGrids(): Promise<void> {
  try {
    console.log("Starting mock grid generation...");
    
    // Create various popular trading pairs
    const tradingPairs = [
      // SOL/USDC pair
      {
        sourceTokenSymbol: "SOL",
        targetTokenSymbol: "USDC",
        sourceTokenId: "So11111111111111111111111111111111111111112",
        targetTokenId: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        upperLimit: 120,
        lowerLimit: 110,
        gridCount: 30,
        quantityInvested: 1000
      },
      // JUP/USDC pair
      {
        sourceTokenSymbol: "SOL",
        targetTokenSymbol: "TRUMP",
        sourceTokenId: "So11111111111111111111111111111111111111112",
        targetTokenId: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
        upperLimit: 9.8,
        lowerLimit: 8.8,
        gridCount: 40,
        quantityInvested: 500
      },
      // BONK/USDC pair (narrow range)
      {
        sourceTokenSymbol: "SOL",
        targetTokenSymbol: "Fartcoin",
        sourceTokenId: "So11111111111111111111111111111111111111112",
        targetTokenId: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump",
        upperLimit: 0.56,
        lowerLimit: 0.35,
        gridCount: 30,
        quantityInvested: 200
      },
      // RNDR/SOL pair
      {
        sourceTokenSymbol: "SOL",
        targetTokenSymbol: "JUP",
        sourceTokenId: "So11111111111111111111111111111111111111112",
        targetTokenId: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        upperLimit: 0.41,
        lowerLimit: 0.35,
        gridCount: 25,
        quantityInvested: 50
      }
    ];

    console.log(`Creating ${tradingPairs.length} mock grids...`);

    // Create each grid
    for (const pairConfig of tradingPairs) {
      try {
        // Calculate grid levels
        const levels: Record<number, number> = {};
        const { upperLimit, lowerLimit, gridCount } = pairConfig;
        
        const step = (upperLimit - lowerLimit) / gridCount;
        
        for (let i = 0; i <= gridCount; i++) {
          const price = lowerLimit + (step * i);
          levels[i] = Number(price.toFixed(6)); // Ensure we don't get floating point precision issues
        }

        // Create the grid data
        const gridData: Omit<IGrid, "_id" | "totalBuys" | "totalSells" | "currentValue" | "createdAt" | "updatedAt"> = {
          ...pairConfig,
          levels,
          // Generate some random current values for demo purposes
          currentPrice: lowerLimit + Math.random() * (upperLimit - lowerLimit),
          currentGridIndex: Math.floor(Math.random() * gridCount),
          sourceTokenAmount: Math.random() * 10,
          targetTokenAmount: Math.random() * 1000
        };

        // Create the grid in the database
        const createdGrid = await createGrid(gridData);
        
        console.log(`Created grid for ${pairConfig.sourceTokenSymbol}/${pairConfig.targetTokenSymbol} with ID: ${createdGrid._id}`);
      } catch (error) {
        console.error(`Error creating grid for ${pairConfig.sourceTokenSymbol}/${pairConfig.targetTokenSymbol}:`, error);
      }
    }

    console.log("Mock grid generation completed successfully!");
  } catch (error) {
    console.error("Error generating mock grids:", error);
  }
}

/**
 * Helper function to update a specific grid with realistic market data
 */
async function updateGridWithMarketData(gridId: string): Promise<void> {
  // In a real application, this would fetch current market prices
  // and update the grid's current price, token amounts, etc.
  // For this mock data generator, we'll skip this step
}

// Export the function for use in other modules
export default generateMockGrids;

// Execute the function
generateMockGrids()
  .then(() => {
    console.log("Mock grid generation script completed");
  })
  .catch(error => {
    console.error("Error in mock grid generation script:", error);
  });

