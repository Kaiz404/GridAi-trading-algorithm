import { model, Schema  } from 'mongoose';
import type { Model } from 'mongoose';
import mongoose from "mongoose";

export interface IGrid {
    _id: string;
    sourceTokenSymbol: string;
    targetTokenSymbol: string;
    sourceTokenId: string;
    targetTokenId: string;
    upperLimit: number;
    lowerLimit: number;
    gridCount: number;
    quantityInvested: number;
    levels: Record<number, number>; // Dictionary where keys are strings and values are prices (numbers)
    totalBuys: number;
    totalSells: number;
    profit: number; // Total profit in percentage
    currentValue: number;  // Current value of the grid in USDC
    currentPrice?: number;
    currentGridIndex?: number;
    sourceTokenAmount?: number; // Amount of source token in the grid
    targetTokenAmount?: number; // Amount of target token in the grid
    createdAt: number;
    updatedAt: number;
}

const gridSchema = new Schema<IGrid>(
    {
        _id: { type: String, required: true },
        sourceTokenSymbol: { type: String, required: true },
        targetTokenSymbol: { type: String, required: true },
        sourceTokenId: { type: String, required: true },
        targetTokenId: { type: String, required: true },
        upperLimit: { type: Number, required: true },
        lowerLimit: { type: Number, required: true },
        gridCount: { type: Number, required: true },
        quantityInvested: { type: Number, required: true },
        levels: { type: Object, default: {} },
        totalBuys: { type: Number, default: 0 },
        totalSells: { type: Number, default: 0 },
        profit: { type: Number, default: 0 }, // Total profit in percentage
        currentValue: { type: Number, default: 0 },
        currentPrice: { type: Number, default: null },
        currentGridIndex: { type: Number, default: null },
        sourceTokenAmount: { type: Number, default: null },
        targetTokenAmount: { type: Number, default: null },
        createdAt: { type: Number, default: Date.now },
        updatedAt: { type: Number, default: Date.now }
    }, 
    { 
        timestamps: { 
            createdAt: 'createdAt', 
            updatedAt: 'updatedAt',
            currentTime: () => Date.now()
        } 
    }
)

const Grid: Model<IGrid> = mongoose.models.Grid || model<IGrid>('Grid', gridSchema);

export default Grid;