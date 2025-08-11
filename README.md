# SUI Agent Kit

A clean, focused Sui blockchain agent built with the official [@getnimbus/sui-agent-kit](https://www.npmjs.com/package/@getnimbus/sui-agent-kit) and LangChain, enhanced with custom transaction analysis tools.

## ✨ Features

- 🔍 Check SUI and USDC token balances
- 📋 View owned objects and NFTs
- 📊 Get detailed transaction history with time-based filtering
- 💰 Calculate SUI/USDC summaries for specific time periods
- 🔐 Wallet management and operations
- 🤖 Natural language interaction using OpenAI GPT
- 🔗 Built with Sui Agent Kit for reliable blockchain operations
- 🛠️ Access to all Sui Agent Kit tools + custom transaction analysis tools
- ⏰ Time-based transaction filtering (today, yesterday, last week, etc.)

## 🚀 Quick Start

### 1. **Install Dependencies**
```bash
npm install
```

### 2. **Set up Environment Variables**
```bash
cp env.example .env
```

Then edit `.env` and add your keys:
```env
OPENAI_API_KEY=your_openai_api_key_here
SUI_NETWORK=testnet
SUI_PRIVATE_KEY=your_sui_private_key_here  # Optional
SUI_RPC_URL=your_custom_rpc_url  # Optional
```

### 3. **Start the Agent**
```bash
npm start
```

## 📱 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run the agent in demo mode |
| `npm start -- --interactive` | Interactive chat mode |
| `npm run dev` | Development mode with auto-reload |

## 🔧 Prerequisites

1. **Node.js** (v18 or higher)
2. **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/account/api-keys)
3. **Sui Wallet** (optional) - For checking your own balance and making transactions

## 💬 Interactive Mode

```bash
npm start -- --interactive
```

This starts an interactive chat where you can ask questions like:

- "What's my SUI balance?"
- "Show me my recent transactions"
- "How much SUI did I send last week?"
- "Calculate my SUI summary from yesterday"
- "What objects do I own?"
- "Get network information"
- "Check gas prices"

## 🎯 What the Agent Can Do

The agent automatically gets access to all tools provided by the Sui Agent Kit, plus custom transaction analysis tools:

### **Core Sui Agent Kit Tools**
- **Balance Management** - Check SUI and custom token balances
- **Transaction Operations** - Send tokens, transfer objects
- **Object Management** - List owned objects, get details, transfer NFTs
- **DeFi Integration** - Interact with DEX platforms, check liquidity pools
- **Network Information** - Get status, gas prices, statistics

### **Custom Transaction Analysis Tools**
- **Transaction History** - View detailed transaction history with time filtering
- **SUI Summary Calculator** - Calculate total SUI/USDC sent/received in time periods

## 🕒 Time-Based Transaction Filtering

The custom tools support intelligent time filtering:

| Filter | Description | Example |
|--------|-------------|---------|
| `today` | Today's transactions | "Show my transactions from today" |
| `yesterday` | Yesterday's transactions | "My transactions from yesterday" |
| `last week` | Last 7 days | "Last week's transactions" |
| `last month` | Last 30 days | "Transactions from last month" |
| `last X days` | Custom time range | "Last 14 days" |
| `this month` | Current month | "This month's activity" |

## 📊 Transaction Analysis Examples

### **Transaction History**
- "Show me my transaction history" → Lists all past transactions
- "What transactions did I make yesterday?" → Yesterday's transactions only
- "My activity from last week" → Last 7 days of transactions

### **SUI Summary & Analytics**
- "How much SUI did I send last week?" → Total SUI sent in last 7 days
- "Calculate my SUI summary from yesterday" → Yesterday's totals
- "My SUI flow in last 30 days" → Monthly summary with net flow

## 🏗️ Architecture

```
User Input (Natural Language)
        ↓
LangChain Agent with Sui Agent Kit + Custom Tools
        ↓
├── Sui Agent Kit (Core blockchain operations)
└── Custom Transaction Tools (History & Analytics)
        ↓
Sui Network (Testnet/Mainnet)
        ↓
Formatted Response with Transaction Data
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | Your OpenAI API key |
| `SUI_NETWORK` | ❌ | Network to use (default: testnet) |
| `SUI_PRIVATE_KEY` | ❌ | Your Sui private key for wallet operations |
| `SUI_RPC_URL` | ❌ | Custom RPC URL (uses default if not set) |

### Networks

- **testnet** - Sui testnet (default)
- **mainnet** - Sui mainnet
- **devnet** - Sui devnet

## 🚀 Development

- **Start with auto-reload:** `npm run dev`
- **View logs:** The agent runs in verbose mode showing all tool calls
- **Interactive testing:** `npm start -- --interactive`

## 🔧 Troubleshooting

### Common Issues

1. **"OpenAI API key not found"**
   - Make sure you've set `OPENAI_API_KEY` in your `.env` file

2. **"Network connection failed"**
   - Check your internet connection
   - Verify the `SUI_NETWORK` setting
   - Check if the RPC URL is accessible

3. **"Private key invalid"**
   - The `SUI_PRIVATE_KEY` is optional for read-only operations
   - Only needed if you want to make transactions

4. **Transaction data discrepancies**
   - Use `get_transaction_history` for detailed transaction lists
   - Use `get_sui_summary` for calculated totals
   - Cross-reference both tools for complete understanding

## 📚 Resources

- [Sui Agent Kit Documentation](https://www.npmjs.com/package/@getnimbus/sui-agent-kit)
- [LangChain Documentation](https://js.langchain.com/)
- [Sui Documentation](https://docs.sui.io/)
- [OpenAI API](https://platform.openai.com/docs)

## 🎉 Next Steps

Once you have the basic agent working, you can:

- **Add more custom tools** for specific use cases
- **Integrate with additional Sui protocols** and services
- **Create a web interface** instead of CLI
- **Enhance transaction analytics** with charts and graphs
- **Add more token type support** beyond SUI and USDC
- **Extend with additional blockchain operations**

---

**🎯 Your SUI Agent is now powered by the official Sui Agent Kit with enhanced transaction analysis capabilities!**
