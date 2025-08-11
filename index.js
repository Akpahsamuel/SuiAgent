import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { BufferMemory } from 'langchain/memory';
import { createSuiTools } from '@getnimbus/sui-agent-kit';

import { validateEnvironment, suiAgentKit } from './src/config/sui-config.js';
import { getTransactionHistoryTool, getSuiSummaryTool } from './src/tools/transaction-tools.js';

console.log('🚀 SUI Agent Kit - Powered by @getnimbus/sui-agent-kit\n');

try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment Error:', error.message);
  process.exit(1);
}

const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo',
  temperature: 0
});

const memory = new BufferMemory({
  memoryKey: 'chat_history',
  returnMessages: true,
  inputKey: 'input',
  outputKey: 'output'
});

const originalTools = createSuiTools(suiAgentKit);

const customTransactionTools = [
  getTransactionHistoryTool(),
  getSuiSummaryTool()
];

const tools = [...originalTools, ...customTransactionTools];

console.log(`🛠️  Available Tools: ${tools.length} total (${originalTools.length} Sui Agent Kit + ${customTransactionTools.length} custom tools)\n`);

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
   - Calculate total SUI/USDC sent/received in time periods using get_sui_summary
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
   
   SUI SUMMARY & ANALYTICS:
   The get_sui_summary tool calculates total SUI and USDC sent/received in time periods:
   - "How much SUI did I send last week?" → Use get_sui_summary with "last week"
   - "Total SUI received this month" → Use get_sui_summary with "last month"
   - "My SUI flow in last 30 days" → Use get_sui_summary with "30 days"
   - Shows total sent, total received, net flow, and transaction count
   - Net flow = received - sent (positive = gain, negative = loss)
   
   TRANSACTION HISTORY EXAMPLES:
   - "Show me my transaction history" → Use get_transaction_history (shows list of past transactions)
   - "What's in my wallet?" → Use sui_get_holding (shows current balances)
   - "Check my wallet" → Use sui_get_holding (shows current balances)
   - "My past transactions" → Use get_transaction_history (shows list of past transactions)
   - "Show me today's transactions" → Use get_transaction_history with "today" filter
   - "Last week's activity" → Use get_transaction_history with "last week" filter
   - Always display the actual data, never generic responses
   
   SUI SUMMARY EXAMPLES:
   - "How much SUI did I send last week?" → Use get_sui_summary with "last week"
   - "Total SUI received this month" → Use get_sui_summary with "last month"
   - "My SUI flow in last 30 days" → Use get_sui_summary with "30 days"
   - "Calculate my SUI summary from yesterday" → Use get_sui_summary with "yesterday"
   
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
   
   Always display the actual data, never generic responses`],
  ['placeholder', '{chat_history}'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}']
]);

const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt
});

const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: false,
  maxIterations: 15,
  returnIntermediateSteps: true,
  memory: memory
});

async function runAgent(userInput) {
  try {
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

async function main() {
  try {
    if (process.argv.includes('--interactive')) {
      await interactiveMode();
    } else {
      console.log('🎯 Demo Mode - Try these examples:\n');
      
      const examples = [
        'What is my SUI balance?',
        'Show me my recent transactions',
        'How much SUI did I send last week?',
        'Calculate my SUI summary from last month',
        'What objects do I own?',
        'Get network information',
        'Check gas prices'
      ];
      
      examples.forEach((example, index) => {
        console.log(`   ${index + 1}. "${example}"`);
      });
      
      console.log('\n💡 Run with --interactive flag for interactive mode: pnpm start -- --interactive\n');
      
      await runAgent('What is my SUI balance?');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error); 