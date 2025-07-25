# Sui Blockchain Agent

A simple AI agent built with LangChain that can interact with the Sui blockchain to check balances, view transactions, and manage your Sui wallet.

## Features

- 🔍 Check SUI token balances
- 📋 View owned objects and NFTs
- 📊 Get transaction history
- 🤖 Natural language interaction using OpenAI GPT
- 🔗 Built with LangChain for extensible agent capabilities

## Prerequisites

1. **Node.js** (v18 or higher)
2. **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/account/api-keys)
3. **Sui Wallet** (optional) - For checking your own balance and making transactions

## Setup

1. **Clone or download this project**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Then edit `.env` and add your keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   SUI_NETWORK=testnet
   SUI_PRIVATE_KEY=your_sui_private_key_here  # Optional
   ```

## Usage

### Quick Demo
```bash
npm start
```

This will run a demo query showing your SUI balance.

### Interactive Mode
```bash
npm start -- --interactive
```

This starts an interactive chat where you can ask questions like:

- "What's my SUI balance?"
- "Show me my recent transactions"
- "What objects do I own?"
- "Check the balance of address 0x123..."

### Example Queries

The agent understands natural language questions about Sui:

- **Balance checks:** "What's my current SUI balance?"
- **Transaction history:** "Show me my last 5 transactions"
- **Owned objects:** "What NFTs or objects do I own?"
- **Address lookup:** "Check the balance of 0xabc123..."

## How It Works

1. **LangChain Agent** - Uses OpenAI GPT as the reasoning engine
2. **Sui Agent Kit** - Provides blockchain tools and functionality
3. **Natural Language** - Converts your questions into blockchain queries
4. **Real-time Data** - Fetches live data from the Sui network

## Architecture

```
User Input (Natural Language)
        ↓
LangChain Agent (GPT reasoning)
        ↓
Sui Agent Kit Tools
        ↓
Sui Blockchain Network
        ↓
Formatted Response
```

## Available Tools

The agent has access to these Sui blockchain tools:

- `getBalance` - Get SUI token balance for any address
- `getOwnedObjects` - List all objects owned by an address
- `getTransactionHistory` - View recent transaction history
- And more from the Sui Agent Kit

## Development

- **Start with auto-reload:** `npm run dev`
- **View logs:** The agent runs in verbose mode showing all tool calls

## Troubleshooting

### Common Issues

1. **"OpenAI API key not found"**
   - Make sure you've set `OPENAI_API_KEY` in your `.env` file

2. **"Network connection failed"**
   - Check your internet connection
   - Verify the `SUI_NETWORK` setting (testnet/mainnet/devnet)

3. **"Private key invalid"**
   - The `SUI_PRIVATE_KEY` is optional for read-only operations
   - Only needed if you want to make transactions

### Getting Help

If you encounter issues:
1. Check that all dependencies are installed (`npm install`)
2. Verify your `.env` file has the correct API keys
3. Make sure you're connected to the internet
4. Try running in verbose mode to see detailed logs

## Next Steps

Once you have the basic agent working, you can:

- Add more Sui-specific tools (NFT minting, DEX trading, etc.)
- Create a web interface instead of CLI
- Add memory so the agent remembers conversation context
- Integrate with other blockchains or APIs

## Resources

- [LangChain Documentation](https://js.langchain.com/)
- [Sui Documentation](https://docs.sui.io/)
- [OpenAI API](https://platform.openai.com/docs) # SuiAgent
