import dbConnect from "../database/index.ts";
import Grid from "../database/models/grid.model.ts";
import type { IGrid } from "../database/models/grid.model.ts";
import { Types } from "mongoose";

export async function createGrid(
  gridData: Omit<IGrid, "_id" | "totalBuys" | "totalSells" | "currentValue" | "levels" | "createdAt" | "updatedAt"> & 
  { levels?: Record<number, number> }
): Promise<IGrid> {
  await dbConnect();
  
  // Generate a new ObjectId for this grid
  const _id = new Types.ObjectId().toString();
  
  // Calculate grid levels if not provided
  if (!gridData.levels || Object.keys(gridData.levels).length === 0) {
    const levels: Record<number, number> = {};
    const { upperLimit, lowerLimit, gridCount } = gridData;
    
    const step = (upperLimit - lowerLimit) / gridCount;
    
    for (let i = 0; i <= gridCount; i++) {
      const price = lowerLimit + (step * i);
      levels[i] = price;
    }
    
    gridData.levels = levels;
  }
  
  const grid = await Grid.create({
    _id,
    ...gridData,
    totalBuys: 0,
    totalSells: 0,
    profit: 0,
    currentValue: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  return grid.toObject();
}

export async function getGridById(id: string): Promise<IGrid | null> {
  await dbConnect();
  
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  
  const grid = await Grid.findById(id);
  return grid ? grid.toObject() : null;
}

export async function getGrids(
  options: {
    limit?: number;
    skip?: number;
    sort?: { [key: string]: 1 | -1 };
  } = {}
): Promise<IGrid[]> {
  await dbConnect();
  
  const { limit = 100, skip = 0, sort = { _id: -1 } } = options;
  
  const grids = await Grid.find()
    .sort(sort)
    .skip(skip)
    .limit(limit);
  
  return grids.map(grid => grid.toObject());
}

// Example function to get all grids
export async function getAllGrids(): Promise<IGrid[]> {
  try {
    const grids = await getGrids();
    console.log("Fetched grids successfully:");
    console.log(JSON.stringify(grids, null, 2));
    return grids;
  } catch (error) {
    console.error("Error fetching grids:", error);
    return [];
  }
}

export async function updateGrid(
  id: string,
  updateData: Partial<Omit<IGrid, "_id" | "createdAt">>
): Promise<IGrid | null> {
  await dbConnect();
  
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  
  // Add updatedAt timestamp
  updateData.updatedAt = Date.now();
  
  const grid = await Grid.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true }
  );
  
  return grid ? grid.toObject() : null;
}

export async function deleteGrid(id: string): Promise<boolean> {
  await dbConnect();
  
  if (!Types.ObjectId.isValid(id)) {
    return false;
  }
  
  const result = await Grid.findByIdAndDelete(id);
  return !!result;
}


export async function updateGridCurrentPrice(
  id: string,
  currentPrice: number
): Promise<IGrid | null> {
  await dbConnect();
  
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  
  // Get the grid to find the appropriate grid index
  const grid = await Grid.findById(id);
  
  if (!grid) {
    return null;
  }
  
  // Find the current grid index based on price
  let currentGridIndex: number | null = null;
  
  const levels = Object.entries(grid.levels)
    .map(([key, value]) => ({ index: parseInt(key), price: value }))
    .sort((a, b) => a.price - b.price);
  
  for (let i = 0; i < levels.length - 1; i++) {
    if (currentPrice >= levels[i].price && currentPrice < levels[i + 1].price) {
      currentGridIndex = levels[i].index;
      break;
    }
  }
  
  // Update the grid with the new price and index
  const updatedGrid = await Grid.findByIdAndUpdate(
    id,
    { 
      $set: { 
        currentPrice,
        currentGridIndex,
        updatedAt: Date.now()
      } 
    },
    { new: true }
  );
  
  return updatedGrid ? updatedGrid.toObject() : null;
}

export async function updateGridTokenAmounts(
  id: string,
  sourceTokenAmount: number,
  targetTokenAmount: number
): Promise<IGrid | null> {
  return updateGrid(id, { 
    sourceTokenAmount, 
    targetTokenAmount,
    updatedAt: Date.now()
  });
}

export async function updateGridCurrentValue(
  id: string,
  currentValue: number
): Promise<IGrid | null> {
  await dbConnect();
  
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  
  const grid = await Grid.findByIdAndUpdate(
    id,
    { 
      $set: { 
        currentValue,
        updatedAt: Date.now()
      } 
    },
    { new: true }
  );
  
  return grid ? grid.toObject() : null;
}

export async function incrementGridTrades(
  id: string, 
  { buys = 0, sells = 0 }: { buys?: number, sells?: number }
): Promise<IGrid | null> {
  await dbConnect();
  
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  
  const updateObj: { totalBuys?: number, totalSells?: number } = {};
  
  if (buys > 0) {
    updateObj.totalBuys = buys;
  }
  
  if (sells > 0) {
    updateObj.totalSells = sells;
  }
  
  const grid = await Grid.findByIdAndUpdate(
    id,
    { 
      $inc: updateObj,
      $set: { updatedAt: Date.now() }
    },
    { new: true }
  );
  
  return grid ? grid.toObject() : null;
}

export async function getActiveGridsCount(): Promise<number> {
  await dbConnect();
  return Grid.countDocuments();
}

export async function getTotalValueAcrossGrids(): Promise<number> {
  await dbConnect();
  
  const result = await Grid.aggregate([
    { $group: { _id: null, totalValue: { $sum: "$currentValue" } } }
  ]);
  
  return result.length > 0 ? result[0].totalValue : 0;
}

/**
 * Updates a grid's price limits and optionally the grid count, then recalculates grid levels
 * 
 * @param id The ID of the grid to update
 * @param upperLimit The new upper price limit
 * @param lowerLimit The new lower price limit
 * @param gridCount Optional - The new number of grid levels
 * @returns The updated grid or null if not found/invalid
 */
export async function updateGridPriceLimits(
  id: string,
  upperLimit: number,
  lowerLimit: number,
  gridCount?: number
): Promise<IGrid | null> {
  await dbConnect();
  
  if (!Types.ObjectId.isValid(id)) {
    console.error("Invalid grid ID format");
    return null;
  }
  
  if (upperLimit <= lowerLimit) {
    console.error("Upper limit must be greater than lower limit");
    return null;
  }
  
  try {
    // First retrieve the existing grid
    const existingGrid = await Grid.findById(id);
    
    if (!existingGrid) {
      console.error(`Grid with ID ${id} not found`);
      return null;
    }
    
    // Use provided grid count or fall back to existing
    const newGridCount = gridCount !== undefined ? gridCount : existingGrid.gridCount;
    
    // Validate grid count
    if (newGridCount < 2) {
      console.error("Grid count must be at least 2");
      return null;
    }
    
    // Recalculate grid levels with the new parameters
    const levels: Record<number, number> = {};
    const step = (upperLimit - lowerLimit) / newGridCount;
    
    for (let i = 0; i <= newGridCount; i++) {
      const price = lowerLimit + (step * i);
      levels[i] = Number(price.toFixed(6)); // Fix precision issues
    }
    
    // Find the current grid index based on current price (if available)
    let currentGridIndex: number | null = null;
    if (existingGrid.currentPrice) {
      const currentPrice = existingGrid.currentPrice;
      
      // If current price is outside new range, set to closest boundary
      if (currentPrice <= lowerLimit) {
        currentGridIndex = 0;
      } else if (currentPrice >= upperLimit) {
        currentGridIndex = newGridCount;
      } else {
        // Find the appropriate grid level
        for (let i = 0; i < newGridCount; i++) {
          if (currentPrice >= levels[i] && currentPrice < levels[i + 1]) {
            currentGridIndex = i;
            break;
          }
        }
      }
    }
    
    // Build update data object
    const updateData: Partial<IGrid> = {
      upperLimit,
      lowerLimit,
      levels,
      currentGridIndex,
      updatedAt: Date.now()
    };
    
    // If grid count changed, update that too
    if (gridCount !== undefined) {
      updateData.gridCount = newGridCount;
      
      // Optional: Adjust the token distribution if grid count changed
      // This is a simplified approach; a real implementation might need to rebalance holdings
      if (existingGrid.sourceTokenAmount || existingGrid.targetTokenAmount) {
        console.log(`Grid count changed from ${existingGrid.gridCount} to ${newGridCount}. Token distribution may need rebalancing.`);
      }
    }
    
    // Update the grid with new parameters
    const updatedGrid = await Grid.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!updatedGrid) {
      console.error(`Failed to update grid ${id}`);
      return null;
    }
    
    console.log(`Successfully updated grid ${id}:`);
    console.log(`- Price range: ${lowerLimit} - ${upperLimit}`);
    console.log(`- Grid levels: ${newGridCount}`);
    
    return updatedGrid.toObject();
  } catch (error) {
    console.error(`Error updating grid ${id}:`, error);
    return null;
  }
}


export async function getAllGridSummary(): Promise<{
  grids: IGrid[];
  totalProfit: number;
  totalInvested: number;
  profitPercentage: number;
  totalBuys: number;
  totalSells: number;
}> {
  await dbConnect();
  
  // Fetch all grids
  const grids = await Grid.find();
  
  // Calculate summary data
  let totalProfit = 0;
  let totalInvested = 0;
  let totalBuys = 0;
  let totalSells = 0;
  
  grids.forEach(grid => {
    totalProfit += grid.profit || 0;
    // Assuming quantityInvested exists on grid model as the initial investment
    totalInvested += grid.quantityInvested || 0;
    totalBuys += grid.totalBuys || 0;
    totalSells += grid.totalSells || 0;
  });
  
  // Calculate profit percentage (handle division by zero)
  const profitPercentage = totalInvested > 0 
    ? (totalProfit / totalInvested) * 100 
    : 0;
  
  return {
    grids: grids.map(grid => grid.toObject()),
    totalProfit,
    totalInvested,
    profitPercentage,
    totalBuys,
    totalSells
  };
}


// Example function to set up a grid trading configuration for SOL/USDC
export async function setupSOLUSDCGrid(): Promise<void> {
  try {
    // Define token addresses for SOL and USDC
    const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
    const USDC_TOKEN_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const penguin_tariff = "giqkyxukexs2wnmadekq1jrpelcf97nu7zhz1dh4zyvm";

    // Grid configuration parameters
    const gridConfig = {
      sourceTokenSymbol: "SOL",
      targetTokenSymbol: "PT",
      sourceTokenId: SOL_TOKEN_ADDRESS,
      targetTokenId: penguin_tariff,
      upperLimit: 0.004,  // Upper price limit ($110)
      lowerLimit: 0.0025,   // Lower price limit ($90)
      gridCount: 20,      // Number of grid levels
      quantityInvested: 0.05  // Amount in SOL to invest in each grid level
    };
    
    // Call the createGrid function
    const createdGrid = await createGrid(gridConfig);
    
    console.log("Grid created successfully:");
    console.log(JSON.stringify(createdGrid, null, 2));
    
  } catch (error) {
    console.error("Error creating grid:", error);
  }
}

// Call the function
// setupSOLUSDCGrid().catch(console.error);


// getAllGrids().catch(console.error);

// Update SOL/USDC grid with new price range and more grid levels
// updateGridPriceLimits("67edf9f861d2cfdefceb4068", 130.0, 110.0, 20)
//   .then(updatedGrid => {
//     if (updatedGrid) {
//       console.log("Grid updated successfully:");
//       console.log(JSON.stringify(updatedGrid, null, 2));
//     } else {
//       console.log("Failed to update grid");
//     }
//   })
//   .catch(error => {
//     console.error("Error:", error);
//   });


