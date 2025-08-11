import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { SuiAgentKit, createSuiTools } from '@getnimbus/sui-agent-kit';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { DynamicTool } from '@langchain/core/tools';
import { MIST_PER_SUI } from '@mysten/sui/utils';

console.log('🚀 SUI Agent Kit - Powered by @getnimbus/sui-agent-kit\n');

// Initialize the Sui Agent Kit with correct constructor syntax
// According to docs: new SuiAgentKit(privateKey, rpcUrl, openaiApiKey)
const suiAgentKit = new SuiAgentKit(
  process.env.SUI_PRIVATE_KEY,
  process.env.SUI_RPC_URL || (process.env.SUI_NETWORK === 'mainnet' ? 'https://fullnode.mainnet.sui.io:443' : 'https://fullnode.testnet.sui.io:443'),
  process.env.OPENAI_API_KEY
);

// Initialize Sui Client for transaction history
const network = process.env.SUI_NETWORK || 'testnet';
const rpcUrl = process.env.SUI_RPC_URL || (network === 'mainnet' ? 'https://fullnode.mainnet.sui.io:443' : 'https://fullnode.testnet.sui.io:443');
const suiClient = new SuiClient({ url: rpcUrl });

// Helper function to convert MIST to SUI
const mistToSui = (mistAmount) => {
  return Number(mistAmount) / Number(MIST_PER_SUI);
};

// Helper function to format token amounts
const formatTokenAmount = (amount, coinType) => {
  if (coinType.includes('::sui::SUI')) {
    // Convert MIST to SUI for native SUI tokens
    const suiAmount = mistToSui(Math.abs(amount));
    return `${suiAmount.toFixed(9)} SUI`;
  } else if (coinType.includes('usdc') || coinType.includes('USDC')) {
    // USDC typically has 6 decimals
    const usdcAmount = Math.abs(amount) / 1000000;
    return `${usdcAmount.toFixed(2)} USDC`;
  } else {
    // For other tokens, show raw amount
    return `${Math.abs(amount)} tokens`;
  }
};

// Initialize the LLM with tool calling capabilities
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo',
  temperature: 0
});

// Create conversation memory
const memory = new BufferMemory({
  memoryKey: 'chat_history',
  returnMessages: true,
  inputKey: 'input',
  outputKey: 'output'
});

// Create custom transaction history tool using DynamicTool
const customTransactionTools = [
  new DynamicTool({
    name: 'get_transaction_history',
    description: 'Get the actual transaction history (list of transactions) for the user wallet, not just current balances. Accepts time filters like "last 7 days", "this month", "last week", "today", "yesterday", or specific date ranges.',
    func: async (input) => {
      try {
        // Parse time filter from input
        let timeFilter = 'all'; // default: show all transactions
        let daysBack = 0;
        let startDate = null;
        let endDate = new Date();
        
        if (input) {
          const inputLower = input.toLowerCase().trim();
          
          // Parse common time expressions
          if (inputLower.includes('today')) {
            timeFilter = 'today';
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
          } else if (inputLower.includes('yesterday')) {
            timeFilter = 'yesterday';
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
          } else if (inputLower.includes('week') || inputLower.includes('7 days')) {
            timeFilter = 'last week';
            daysBack = 7;
            startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);
          } else if (inputLower.includes('month') || inputLower.includes('30 days')) {
            timeFilter = 'last month';
            daysBack = 30;
            startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);
          } else if (inputLower.includes('3 months') || inputLower.includes('90 days')) {
            timeFilter = 'last 3 months';
            daysBack = 90;
            startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);
          } else if (inputLower.includes('year') || inputLower.includes('365 days')) {
            timeFilter = 'last year';
            daysBack = 365;
            startDate = new Date();
            startDate.setDate(startDate.getDate() - daysBack);
          } else if (inputLower.includes('days')) {
            // Extract number of days (e.g., "last 14 days")
            const daysMatch = inputLower.match(/(\d+)\s*days?/);
            if (daysMatch) {
              daysBack = parseInt(daysMatch[1]);
              timeFilter = `last ${daysBack} days`;
              startDate = new Date();
              startDate.setDate(startDate.getDate() - daysBack);
            }
          }
        }
        
        // First get the wallet address
        const walletAddress = await suiAgentKit.getWalletAddress();
        console.log(`Getting transactions for wallet: ${walletAddress.substring(0, 10)}... (${timeFilter})`);
        
        // Get transactions with error handling - include ALL transaction data
        let allTxs = [];
        
        try {
          const sentTxs = await suiClient.queryTransactionBlocks({
            filter: { FromAddress: walletAddress },
            options: {
              showEffects: true,
              showBalanceChanges: true,
              showObjectChanges: true,
              showEvents: true,
              showInput: true
            },
            limit: 50, // Increased limit for better filtering
            order: 'descending'
          });
          allTxs = [...(sentTxs.data || [])];
        } catch (sentError) {
          console.log('Error getting sent transactions:', sentError.message);
        }

        try {
          const receivedTxs = await suiClient.queryTransactionBlocks({
            filter: { ToAddress: walletAddress },
            options: {
              showEffects: true,
              showBalanceChanges: true,
              showObjectChanges: true,
              showEvents: true,
              showInput: true
            },
            limit: 50, // Increased limit for better filtering
            order: 'descending'
          });
          allTxs = [...allTxs, ...(receivedTxs.data || [])];
        } catch (receivedError) {
          console.log('Error getting received transactions:', receivedError.message);
        }

        if (allTxs.length === 0) {
          return `No transaction history found for wallet address: ${walletAddress}`;
        }

        // Remove duplicates and sort by timestamp
        let uniqueTxs = allTxs.filter((tx, index, self) => 
          index === self.findIndex(t => t.digest === tx.digest)
        ).sort((a, b) => 
          Number(b.timestampMs || 0) - Number(a.timestampMs || 0)
        );
        
        // Apply time filter if specified
        if (startDate && timeFilter !== 'all') {
          const startTimestamp = startDate.getTime();
          uniqueTxs = uniqueTxs.filter(tx => {
            const txTimestamp = Number(tx.timestampMs || 0);
            return txTimestamp >= startTimestamp;
          });
          console.log(`Filtered to ${uniqueTxs.length} transactions from ${timeFilter}`);
        }
        
        // Limit results for display
        const displayTxs = uniqueTxs.slice(0, 10);

        // Format each transaction with comprehensive details
        const transactions = displayTxs.map((tx, index) => {
          const timestamp = tx.timestampMs ? new Date(Number(tx.timestampMs)).toLocaleString() : 'Unknown';
          const status = tx.effects?.status?.status || 'Unknown';
          
          // Determine transaction type and description
          let transactionType = 'Transaction';
          let transactionDetails = [];
          
          // Check for balance changes (token transfers)
          if (tx.balanceChanges && tx.balanceChanges.length > 0) {
            const changes = tx.balanceChanges.map(change => {
              const amount = Number(change.amount);
              let ownerAddress = '';
              
              if (typeof change.owner === 'string') {
                ownerAddress = change.owner;
              } else if (change.owner && change.owner.AddressOwner) {
                ownerAddress = change.owner.AddressOwner;
              } else if (change.owner && typeof change.owner === 'object') {
                ownerAddress = JSON.stringify(change.owner);
              }
              
              const shortAddress = ownerAddress.length > 8 ? ownerAddress.substring(0, 8) + '...' : ownerAddress;
              
              if (change.coinType.includes('::sui::SUI')) {
                const suiAmount = Math.abs(amount) / 1000000000;
                if (amount < 0) {
                  return `Sent ${suiAmount.toFixed(9)} SUI to ${shortAddress}`;
                } else {
                  return `Received ${suiAmount.toFixed(9)} SUI from ${shortAddress}`;
                }
              } else if (change.coinType.includes('usdc') || change.coinType.includes('USDC')) {
                const usdcAmount = Math.abs(amount) / 1000000;
                if (amount < 0) {
                  return `Sent ${usdcAmount.toFixed(2)} USDC to ${shortAddress}`;
                } else {
                  return `Received ${usdcAmount.toFixed(2)} USDC from ${shortAddress}`;
                }
              } else {
                return `${amount < 0 ? 'Sent' : 'Received'} ${Math.abs(amount)} ${change.coinType.split('::').pop()}`;
              }
            });
            transactionDetails.push(...changes);
          }
          
          // Check for object changes (NFTs, objects, smart contracts)
          if (tx.objectChanges && tx.objectChanges.length > 0) {
            const objectChanges = tx.objectChanges.map(change => {
              if (change.type === 'created') {
                return `Created ${change.objectType || 'object'}`;
              } else if (change.type === 'transferred') {
                return `Transferred ${change.objectType || 'object'}`;
              } else if (change.type === 'mutated') {
                return `Modified ${change.objectType || 'object'}`;
              } else if (change.type === 'deleted') {
                return `Deleted ${change.objectType || 'object'}`;
              }
              return `Object change: ${change.type}`;
            });
            transactionDetails.push(...objectChanges);
          }
          
          // Check for events (DeFi, smart contract interactions)
          if (tx.events && tx.events.length > 0) {
            const events = tx.events.map(event => {
              if (event.type.includes('swap') || event.type.includes('Swap')) {
                return 'Token swap';
              } else if (event.type.includes('stake') || event.type.includes('Stake')) {
                return 'Staking operation';
              } else if (event.type.includes('liquidity') || event.type.includes('Liquidity')) {
                return 'Liquidity operation';
              } else if (event.type.includes('mint') || event.type.includes('Mint')) {
                return 'Token minting';
              } else if (event.type.includes('burn') || event.type.includes('Burn')) {
                return 'Token burning';
              }
              return `Event: ${event.type.split('::').pop()}`;
            });
            transactionDetails.push(...events);
          }
          
          // Check for smart contract calls
          if (tx.transaction && tx.transaction.data && tx.transaction.data.sender === walletAddress) {
            if (tx.transaction.data.transactions && tx.transaction.data.transactions.length > 0) {
              const calls = tx.transaction.data.transactions.map(t => {
                if (t.kind === 'MoveCall') {
                  return `Called ${t.target.split('::').pop()}`;
                } else if (t.kind === 'TransferObjects') {
                  return 'Object transfer';
                } else if (t.kind === 'SplitCoins') {
                  return 'Coin splitting';
                } else if (t.kind === 'MergeCoins') {
                  return 'Coin merging';
                }
                return `Operation: ${t.kind}`;
              });
              transactionDetails.push(...calls);
            }
          }
          
          // If no specific details found, show generic info
          if (transactionDetails.length === 0) {
            transactionDetails.push('Blockchain operation');
          }
          
          // Create main transaction summary
          const mainSummary = transactionDetails[0] || 'Transaction';
          
          return `${index + 1}. **${mainSummary}**
   • Time: ${timestamp}
   • Status: ${status}
   • Tx ID: ${tx.digest.substring(0, 12)}...
   ${transactionDetails.length > 1 ? `• Additional: ${transactionDetails.slice(1).join(', ')}` : ''}`;
        });

        // Create time filter summary
        let timeSummary = '';
        if (timeFilter !== 'all') {
          timeSummary = `\n⏰ **Time Filter:** ${timeFilter}`;
          if (startDate) {
            timeSummary += ` (from ${startDate.toLocaleDateString()})`;
          }
        }

        return `📋 **Transaction History${timeFilter !== 'all' ? ` - ${timeFilter}` : ''}**

${timeSummary}

${transactions.join('\n\n')}

💡 **Available Time Filters:**
• "today" - Today's transactions
• "yesterday" - Yesterday's transactions  
• "last week" or "7 days" - Last 7 days
• "last month" or "30 days" - Last 30 days
• "last 3 months" or "90 days" - Last 3 months
• "last year" or "365 days" - Last year
• "last X days" - Custom number of days
• No filter - All transactions

📊 Showing ${displayTxs.length} of ${uniqueTxs.length} total transactions${timeFilter !== 'all' ? ` in ${timeFilter}` : ''}.`;
        
      } catch (error) {
        console.error('Transaction history error:', error);
        return `Error fetching transaction history: ${error.message}. Please try again.`;
      }
    }
  })
];

// Create the prompt template with conversation context
const prompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a Sui blockchain assistant powered by the Sui Agent Kit. 
   You can help users with comprehensive Sui blockchain operations including:
   
   BALANCE & TOKENS:
   - Check SUI and custom token balances using sui_get_holding
   - Get token metadata and information
   - Check asset holdings
   
   TRANSACTIONS:
   - View current wallet balances using sui_get_holding 
   - View ACTUAL transaction history (list of past transactions) using get_transaction_history
   - Send SUI tokens to addresses
   - Transfer objects and NFTs
   
   OBJECTS & NFTs:
   - List owned objects and NFTs
   - Get object details
   - Transfer objects between addresses
   
   DEFI & TRADING:
   - Interact with DEX platforms (like Cetus)
   - Check liquidity pools
   - Get trading information
   
   NETWORK INFO:
   - Get network status and information
   - Check gas prices
   - View network statistics
   
   CONVERSATION CONTEXT:
   - Remember previous messages and maintain context
   - Reference previous actions and results when relevant
   - Build upon previous conversations naturally
   - Only start fresh when the user explicitly changes topics
   - If user says "interesting" or similar responses, acknowledge their interest and continue the conversation
   - Always consider the chat history when formulating responses
   
   CRITICAL BALANCE VALIDATION RULES:
   - NEVER agree to send tokens without first checking the user's current balance
   - ALWAYS use sui_get_holding or getWalletHolding to verify available balance first
   - If user asks to send more than they have, immediately check their balance and inform them
   - Account for transaction fees (typically 0.001-0.002 SUI) when calculating transferable amounts
   - Never suggest transfers that exceed the user's available balance minus fees
   - When showing balances, always mention if the amount is sufficient for transfers
   - If balance is insufficient, suggest smaller amounts or explain the limitation
   
   TRANSFER WORKFLOW:
   1. ALWAYS check current balance first using balance checking tools
   2. Compare requested amount with available balance
   3. If insufficient: "You have X SUI but want to send Y SUI. Insufficient balance."
   4. If sufficient: Proceed with transfer details
   5. Always account for transaction fees in calculations
   
   TRANSACTION HISTORY VS WALLET HOLDINGS:
   1. When users ask about "my balance", "what's in my wallet", "my holdings" → Use sui_get_holding
   2. When users ask about "transaction history", "my transactions", "past transactions" → Use get_transaction_history
   3. IMPORTANT DIFFERENCE:
      - sui_get_holding = current wallet balances/assets (what you have now)
      - get_transaction_history = list of past transactions you've made (transaction history)
   4. When users ask for transaction history, use get_transaction_history to show actual list of transactions
   5. Display transaction history with timestamps, amounts, recipients, and status
   
   TIME-BASED TRANSACTION FILTERING:
   The get_transaction_history tool now supports time-based filtering:
   - "Show my transactions from today" → Shows only today's transactions
   - "My transactions from yesterday" → Shows yesterday's transactions
   - "Last week's transactions" → Shows last 7 days
   - "Transactions from last month" → Shows last 30 days
   - "Last 14 days" → Shows custom time range
   - "This month's activity" → Shows current month
   - No time filter = shows all transactions
   
   TRANSACTION HISTORY EXAMPLES:
   - "Show me my transaction history" → Use get_transaction_history (shows list of past transactions)
   - "What's in my wallet?" → Use sui_get_holding (shows current balances)
   - "Check my wallet" → Use sui_get_holding (shows current balances)
   - "My past transactions" → Use get_transaction_history (shows list of past transactions)
   - "Show me today's transactions" → Use get_transaction_history with "today" filter
   - "Last week's activity" → Use get_transaction_history with "last week" filter
   - Always display the actual data, never generic responses
   
   When users ask about "my" anything, use the connected wallet.
   Always explain blockchain data in simple, understandable terms.
   Convert MIST to SUI for better readability (1 SUI = 1,000,000,000 MIST).
   
   TRANSFER VALIDATION EXAMPLE:
   - User asks: "Can I send 11 SUI?"
   - Agent MUST first check balance using sui_get_holding
   - If balance is 6 SUI: "You currently have 6 SUI, which is insufficient to send 11 SUI. 
     You can send up to approximately 5.998 SUI (accounting for ~0.002 SUI transaction fee). 
     Would you like to send a smaller amount instead?"
   - NEVER agree to send more than available balance!
   
   TRANSACTION HISTORY EXAMPLES:
   - "Show me my transaction history" → Use get_transaction_history (shows list of past transactions)
   - "What's in my wallet?" → Use sui_get_holding (shows current balances)
   - "Check my wallet" → Use sui_get_holding (shows current balances)
   - "My past transactions" → Use get_transaction_history (shows list of past transactions)
   - Always display the actual data, never generic responses`],
  ['placeholder', '{chat_history}'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}']
]);

// Create Sui tools using the createSuiTools function
const originalTools = createSuiTools(suiAgentKit);

// Combine original tools with custom transaction history tool
const tools = [...originalTools, ...customTransactionTools];

console.log(`🛠️  Available Tools: ${tools.length} total (${originalTools.length} Sui Agent Kit + ${customTransactionTools.length} custom tools)\n`);

// Create the agent using the newer createToolCallingAgent
const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt
});

// Create the agent executor with memory
const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: false, // Disabled verbose mode
  maxIterations: 15, // Increased to handle transaction processing
  returnIntermediateSteps: true,
  memory: memory
});

// Function to run the agent with conversation context
async function runAgent(userInput) {
  try {
    // Get the current chat history from memory
    const chatHistory = await memory.loadMemoryVariables({});
    console.log(`\n📝 Chat History Length: ${chatHistory.chat_history ? chatHistory.chat_history.length : 0}`);
    
    const result = await agentExecutor.invoke({
      input: userInput,
      chat_history: chatHistory.chat_history || []
    });
    
    console.log(`\n✅ ${result.output}\n`);
    return result.output;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return `Sorry, I encountered an error: ${error.message}`;
  }
}

// Interactive mode with conversation memory
async function interactiveMode() {
  console.log('💬 Interactive Mode - Type "exit" to quit, "clear" to reset conversation\n');
  
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = () => {
    rl.question('🤔 Ask me about Sui: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('👋 Goodbye!');
        rl.close();
        return;
      }
      
      if (input.toLowerCase() === 'clear') {
        console.log('🧹 Conversation memory cleared. Starting fresh!\n');
        memory.clear();
        askQuestion();
        return;
      }
      
      await runAgent(input);
      askQuestion();
    });
  };

  askQuestion();
}

// Main function
async function main() {
  try {
    // Check if interactive mode is requested
    if (process.argv.includes('--interactive')) {
      await interactiveMode();
    } else {
      // Demo mode
      console.log('🎯 Demo Mode - Try these examples:\n');
      
      const examples = [
        'What is my SUI balance?',
        'Show me my recent transactions',
        'What objects do I own?',
        'Get network information',
        'Check gas prices'
      ];
      
      examples.forEach((example, index) => {
        console.log(`   ${index + 1}. "${example}"`);
      });
      
      console.log('\n💡 Run with --interactive flag for interactive mode: pnpm start -- --interactive\n');
      
      // Run a simple demo
      await runAgent('What is my SUI balance?');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch(console.error); 