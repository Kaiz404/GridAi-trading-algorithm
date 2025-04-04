import { Keypair, VersionedTransaction, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import * as dotenv from "dotenv";

dotenv.config();

interface QuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;  // Amount in smallest units (e.g., lamports in Solana)
  slippageBps: number;
}

interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  outAmount: string;  // Amount in smallest units (e.g., lamports in Solana)
}

interface ExecuteResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit?: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
    categoryName: string;
    heuristicMaxSlippageBps: number;
  };
  simulationError: string | null;
}

// API Client
class V1ApiClient {
  private readonly baseUrl: string = "https://api.jup.ag/swap/v1";

  async getQuote(params: QuoteParams): Promise<QuoteResponse> {
    try {
      const url = new URL(`${this.baseUrl}/quote`);
      url.searchParams.append("inputMint", params.inputMint);
      url.searchParams.append("outputMint", params.outputMint);
      url.searchParams.append("amount", params.amount.toString());
      url.searchParams.append("slippageBps", params.slippageBps.toString());
      // You can add restrictIntermediateTokens for more stable routes
      url.searchParams.append("restrictIntermediateTokens", "true");

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: QuoteResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching quote:", error);
      throw error;
    }
  }

  async executeSwap(
    quoteResponse: QuoteResponse,
    userPublicKey: string,
    dynamicComputeUnitLimit: boolean,
    dynamicSlippage: boolean
  ): Promise<ExecuteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/swap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          //   "x-api-key": "YOUR_API_KEY",
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey,
          dynamicComputeUnitLimit, // Estimate compute units dynamically
          dynamicSlippage, // Estimate slippage dynamically
          // Priority fee optimization
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1000000, // Cap fee at 0.001 SOL
              global: false, // Use local fee market for better estimation
              priorityLevel: "veryHigh", // veryHigh === 75th percentile for better landing
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ExecuteResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error building transaction:", error);
      throw error;
    }
  }
}




interface SwapResult {
    success: boolean;
    signature?: string;
    outputAmount?: string;
    error?: string;
    txUrl?: string;
}

/**
 * Executes a token swap on Jupiter
 * @param inputMint The token mint address to swap from
 * @param outputMint The token mint address to swap to
 * @param amount Amount to swap (in smallest units like lamports)
 * @param slippageBps Optional - Slippage tolerance in basis points (100 = 1%)
 * @returns Promise with swap result containing success status and transaction signature
 */
export async function quoteAndSwap(
    inputMint: string, 
    outputMint: string, 
    amount: number,
    slippageBps: number = 500
  ): Promise<SwapResult> {
    const client = new V1ApiClient();
  
    const quoteParams: QuoteParams = {
      inputMint,
      outputMint,
      amount,
      slippageBps,
    };
  
    try {
      const quote = await client.getQuote(quoteParams);
  
      if (!quote.outAmount) {
        return {
          success: false,
          error: "No outAmount found in quote response"
        };
      }
  
      const PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
      if (!PRIVATE_KEY) {
        return {
          success: false,
          error: "Please provide your private key in the SOLANA_PRIVATE_KEY environment variable"
        };
      }
  
      const secretKey = bs58.decode(PRIVATE_KEY);
      const wallet = Keypair.fromSecretKey(secretKey);
      console.log("Using wallet public key:", wallet.publicKey.toBase58());
  
      const executeResponse = await client.executeSwap(
        quote,
        wallet.publicKey.toBase58(),
        true,
        true
      );
  
      if (executeResponse.simulationError !== null) {
        return {
          success: false,
          error: `Swap simulation failed: ${executeResponse.simulationError}`
        };
      }
  
      console.log("Swap transaction built successfully");
  
      const connection = new Connection(
        `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
        "confirmed"
      );
  
      // 1. Deserialize the transaction
      const transactionBinary = Buffer.from(
        executeResponse.swapTransaction,
        "base64"
      );
      const transaction = VersionedTransaction.deserialize(transactionBinary);
  
      // 2. Sign the transaction
      transaction.sign([wallet]);
  
      // 3. Serialize the transaction
      const signedTransactionBinary = transaction.serialize();
  
      // 4. Send the transaction
      console.log("Sending transaction to Solana network...");
      const signature = await connection.sendRawTransaction(
        signedTransactionBinary,
        {
          maxRetries: 2,
          skipPreflight: true,
        }
      );
  
      console.log(`Transaction sent with signature: ${signature}`);
      const txUrl = `https://solscan.io/tx/${signature}/`;
      console.log(`Check transaction status at: ${txUrl}`);
  
      // 5. Confirm the transaction
      const confirmation = await connection.confirmTransaction(
        signature,
        "processed"
      );
  
      if (confirmation.value.err) {
        console.error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        return {
          success: false,
          signature,
          error: JSON.stringify(confirmation.value.err),
          txUrl
        };
      }
      
      console.log(`Transaction successful: ${txUrl}`);
      return {
        success: true,
        signature,
        outputAmount: quote.outAmount,
        txUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Failed to process quote and swap:", errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

// quoteAndSwap().catch(console.error);
