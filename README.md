# GridAI - Automated Grid Trading Bot for Solana

GridAI is an automated grid trading bot built for the Solana blockchain. It creates a grid of buy and sell orders within a specified price range and executes trades automatically as the market price moves between grid levels, potentially generating profits from market volatility.

## Features

- **Automated Grid Trading**: Automatically executes trades when price crosses predefined grid levels
- **24/7 Operation**: Designed to be deployed on Google App Engine for continuous trading
- **Jupiter DEX Integration**: Utilizes Jupiter's API for optimal token swaps on Solana
- **MongoDB Database**: Records and tracks all trades, grid configurations and performance
- **Flexible Configuration**: Create custom grids with adjustable price ranges and grid counts
- **Multiple Trading Pairs**: Supports various token pairs on Solana

## Architecture

- **Core Trading Engine**: Monitors token prices and executes trades when conditions are met
- **Database Layer**: Stores grid configurations and trade history in MongoDB
- **Jupiter API Integration**: For token pricing and optimal swap execution
- **Google App Engine Deployment**: For reliable 24/7 operation

## Prerequisites

- Node.js 18+
- MongoDB Atlas account
- Solana wallet with SOL for gas fees
- Jupiter API access
- Google Cloud Platform account (for App Engine deployment)

## Installation & Setup

1. Clone the repository
```bash
git clone <repository-url>
cd GridAi-trading-algorithm
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables by creating a `.env` file:
```
NEXT_PUBLIC_MONGODB_URI="your-mongodb-connection-string"
RPC_URL="https://api.mainnet-beta.solana.com"
SOLANA_PRIVATE_KEY="your-solana-private-key"
SOLANA_PUBLIC_KEY="your-solana-public-key"
HELIUS_API_KEY="your-helius-api-key"
```

## Usage

### Running the Trading Bot Locally

```bash
npm start
```

### Testing with Mock Data

You can generate mock grid configurations:
```bash
node --loader ts-node/esm database/createMockGrids.ts
```

And generate mock trades for testing:
```bash
node --loader ts-node/esm database/writeMockTrades.ts
```

### Deploying to Google App Engine

1. Ensure you have the Google Cloud SDK installed and configured

2. Deploy the application:
```bash
gcloud app deploy
```

## How Grid Trading Works

Grid trading works by:
1. Defining a price range (upper and lower limits)
2. Dividing the range into multiple grid levels
3. Placing buy orders at lower grid levels and sell orders at higher grid levels
4. As price moves up and down within the range, the bot automatically:
   - Buys when price moves down and crosses a grid level
   - Sells when price moves up and crosses a grid level
5. Each successful buy/sell cycle generates a small profit

## Database Schema

The application uses two main collections:

### Grid Model
Stores the grid trading configuration and current state:
- Trading pair information
- Price range and grid levels
- Token amounts
- Trading statistics

### Trade Model
Records individual trade executions:
- Buy/Sell information
- Token amounts and prices
- Profit calculation
- Blockchain transaction details

## Project Structure

- `index.ts`: Main application entry point and grid trading bot implementation
- `database/`: MongoDB database connection and models
- `jupiter/`: Jupiter API integration for pricing and swaps
- `app.yaml`: Google App Engine configuration

## Disclaimer

This software is for educational and demonstration purposes only. Use at your own risk. Trading cryptocurrencies involves significant risk and can result in the loss of your invested capital. You should not invest more than you can afford to lose.