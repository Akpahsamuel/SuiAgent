import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SuiAgentKit, createSuiTools } from '@getnimbus/sui-agent-kit';

console.log('🚀 SUI Agent Kit - Powered by @getnimbus/sui-agent-kit\n');

// Initialize the Sui Agent Kit with correct constructor syntax
// According to docs: new SuiAgentKit(privateKey, rpcUrl, openaiApiKey)
const suiAgentKit = new SuiAgentKit(
  process.env.SUI_PRIVATE_KEY,
  process.env.SUI_RPC_URL || (process.env.SUI_NETWORK === 'mainnet' ? 'https://fullnode.mainnet.sui.io:443' : 'https://fullnode.testnet.sui.io:443'),
  process.env.OPENAI_API_KEY
);

// Initialize the LLM with tool calling capabilities
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo',
  temperature: 0
});

// Create the prompt template
const prompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a Sui blockchain assistant powered by the Sui Agent Kit. 
   You can help users with comprehensive Sui blockchain operations including:
   
   BALANCE & TOKENS:
   - Check SUI and custom token balances
   - Get token metadata and information
   - Check asset holdings
   
   TRANSACTIONS:
   - View transaction history using sui_get_holding and other relevant tools
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
   
   IMPORTANT: When users ask about "my transactions" or "transaction history":
   1. First get their wallet address using sui_get_wallet_address
   2. Then get their holdings using sui_get_holding
   3. If they need more detailed transaction info, explain what's available
   
   When users ask about "my" anything, use the connected wallet.
   Always explain blockchain data in simple, understandable terms.
   Convert MIST to SUI for better readability (1 SUI = 1,000,000,000 MIST).`],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}']
]);

// Create Sui tools using the createSuiTools function
const tools = createSuiTools(suiAgentKit);

console.log(`🛠️  Available Sui Agent Kit Tools: ${tools.length} tools loaded\n`);
tools.forEach((tool, index) => {
  console.log(`   ${index + 1}. ${tool.name}: ${tool.description.slice(0, 60)}...`);
});
console.log('');

// Create the agent using the newer createToolCallingAgent
const agent = await createToolCallingAgent({
  llm,
  tools,
  prompt
});

// Create the agent executor
const agentExecutor = new AgentExecutor({
  agent,
  tools,
  verbose: true,
  maxIterations: 5,
  returnIntermediateSteps: true
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

// Interactive mode
async function interactiveMode() {
  console.log('💬 Interactive Mode - Type "exit" to quit\n');
  
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
      
      console.log('\n💡 Run with --interactive flag for interactive mode: npm start -- --interactive\n');
      
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