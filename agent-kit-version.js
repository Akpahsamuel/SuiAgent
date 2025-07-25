import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SuiAgentKit } from '@getnimbus/sui-agent-kit';

// Initialize the Sui Agent Kit
const suiAgentKit = new SuiAgentKit({
  network: process.env.SUI_NETWORK || 'testnet',
  privateKey: process.env.SUI_PRIVATE_KEY,
  rpcUrl: process.env.SUI_RPC_URL
});

// Initialize the LLM
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo',
  temperature: 0
});

// Create the prompt template with enhanced capabilities
const prompt = ChatPromptTemplate.fromMessages([
  ['system', `You are an advanced Sui blockchain assistant powered by the Sui Agent Kit. 
   You can help users with comprehensive Sui blockchain operations including:
   
   BALANCE & TOKENS:
   - Check SUI and custom token balances
   - Get token metadata and information
   - Check asset holdings
   
   TRANSACTIONS:
   - View transaction history
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
   
   When users ask about "my" anything, use the connected wallet.
   Always explain blockchain data in simple, understandable terms.
   Convert MIST to SUI for better readability (1 SUI = 1,000,000,000 MIST).`],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}']
]);

// Get all available tools from the Sui Agent Kit
const tools = suiAgentKit.getTools();

console.log(`\n🛠️  Available Sui Agent Kit Tools: ${tools.length} tools loaded\n`);
tools.forEach((tool, index) => {
  console.log(`   ${index + 1}. ${tool.name}: ${tool.description.slice(0, 60)}...`);
});
console.log('');

// Create the agent
const agent = await createOpenAIFunctionsAgent({
  llm,
  tools,
  prompt
});

// Create the agent executor
const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
  maxIterations: 5 // Increased for more complex operations
});

// Function to run the agent
async function runAgent(userInput) {
  try {
    console.log(`\n🤖 Processing: "${userInput}"\n`);
    
    const result = await agentExecutor.invoke({
      input: userInput
    });
    
    console.log(`\n✅ Response: ${result.output}\n`);
    return result.output;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return `Sorry, I encountered an error: ${error.message}`;
  }
}

// Example usage and interactive mode
async function main() {
  console.log('🚀 Advanced Sui Agent is ready! (Powered by Sui Agent Kit)\n');
  
  // Get the wallet address if available
  const walletAddress = suiAgentKit.getAddress();
  const network = process.env.SUI_NETWORK || 'testnet';
  
  console.log(`🌐 Network: ${network}`);
  if (walletAddress) {
    console.log(`📱 Connected wallet: ${walletAddress}`);
  } else {
    console.log(`📱 Wallet: Read-only mode (no private key provided)`);
  }
  console.log('');
  
  // Enhanced example queries
  const examples = [
    "What's my SUI balance and USD value?",
    "Show me my recent transactions with details",
    "List all my NFTs and objects",
    "What DEX pools are available on Cetus?",
    "Send 0.1 SUI to address 0x123...",
    "Get network status and gas prices",
    "Check balance of address 0xabc...",
    "What tokens do I own?",
    "Show me the most active trading pairs"
  ];
  
  console.log('💡 Try asking me advanced things like:');
  examples.forEach((example, i) => {
    console.log(`   ${i + 1}. ${example}`);
  });
  console.log('');
  
  // Interactive mode
  if (process.argv.includes('--interactive')) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const askQuestion = () => {
      rl.question('Ask me anything about Sui (or type "exit" to quit): ', async (input) => {
        if (input.toLowerCase() === 'exit') {
          rl.close();
          return;
        }
        
        await runAgent(input);
        askQuestion();
      });
    };
    
    askQuestion();
  } else {
    // Run a demo query showing enhanced capabilities
    console.log('🎯 Running enhanced demo query...\n');
    await runAgent("What's my current SUI balance and can you also tell me about the network status?");
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Run the main function
main().catch(console.error); 