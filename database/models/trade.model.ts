import { model, Schema, Types  } from 'mongoose';
import type { Model} from 'mongoose';
import mongoose from "mongoose";

export interface ITrade {
  _id: string;
  gridId: Types.ObjectId | string; // Reference to the Grid
  side: "BUY" | "SELL"; // Trade side (BUY or SELL)
  inputToken: string; // Token being traded (input token)
  outputToken: string; // Token being received (output token)
  inputTokenId: string;
  outputTokenId: string;
  inputAmount: number;
  outputAmount: number;
  gridLevel: number;
  executedAt?: Date;
  transactionHash?: string; // If you're using blockchain
  profit?: number; // For SELL trades, calculated profit
  createdAt: Date;
  updatedAt: Date;
}

const tradeSchema = new Schema<ITrade>(
  {
    gridId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Grid', 
      required: true 
    },
    side: { 
      type: String, 
      enum: ["BUY", "SELL"],
      required: true 
    },
    inputToken: { 
      type: String, 
      required: true 
    },
    outputToken: { 
      type: String, 
      required: true 
    },
    inputTokenId: { 
      type: String, 
      required: true 
    },
    outputTokenId: { 
      type: String, 
      required: true 
    },
    inputAmount: { 
      type: Number, 
      required: true 
    },
    outputAmount: { 
      type: Number, 
      required: true 
    },
    gridLevel: { 
      type: Number, 
      required: true 
    },
    executedAt: { 
      type: Date 
    },
    transactionHash: { 
      type: String 
    },
    profit: { 
      type: Number 
    },
  },
  { 
    timestamps: true 
  }
);

// Index for faster queries
tradeSchema.index({ gridId: 1, createdAt: -1 });
tradeSchema.index({ status: 1 });

const Trade: Model<ITrade> = mongoose.models.Trade || model<ITrade>('Trade', tradeSchema);

export default Trade;