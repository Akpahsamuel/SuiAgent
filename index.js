import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicTool } from '@langchain/core/tools';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/bcs';

// Initialize Sui client
const network = process.env.SUI_NETWORK || 'testnet';
const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl(network);
const suiClient = new SuiClient({ url: rpcUrl });

// Initialize keypair if private key is provided
let keypair = null;
let walletAddress = null;

if (process.env.SUI_PRIVATE_KEY) {
  try {
    const privateKeyBytes = fromB64(process.env.SUI_PRIVATE_KEY);
    keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    walletAddress = keypair.toSuiAddress();
  } catch (error) {
    console.warn('⚠️  Invalid private key format. Agent will work in read-only mode.');
  }
}

// Initialize the LLM
const llm = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: 'gpt-3.5-turbo',
  temperature: 0
});

// Create Sui tools using the official SDK
const tools = [
  new DynamicTool({
    name: 'getBalance',
    description: 'Get SUI balance for a specific address. Input should be a valid Sui address.',
    func: async (address) => {
      try {
        const targetAddress = address === 'my' || address === 'mine' ? walletAddress : address;
        
        if (!targetAddress) {
          return 'No wallet address available. Please provide a specific address or set up your private key.';
        }

        const balance = await suiClient.getBalance({
          owner: targetAddress,
          coinType: '0x2::sui::SUI'
        });

        const suiBalance = Number(balance.totalBalance) / 1_000_000_000; // Convert MIST to SUI
        
        return `Address: ${targetAddress}\nSUI Balance: ${suiBalance.toFixed(4)} SUI\nRaw Balance: ${balance.totalBalance} MIST`;
      } catch (error) {
        return `Error getting balance: ${error.message}`;
      }
    }
  }),

  new DynamicTool({
    name: 'getOwnedObjects',
    description: 'Get all objects owned by a specific address. Input should be a valid Sui address.',
    func: async (address) => {
      try {
        const targetAddress = address === 'my' || address === 'mine' ? walletAddress : address;
        
        if (!targetAddress) {
          return 'No wallet address available. Please provide a specific address or set up your private key.';
        }

        const objects = await suiClient.getOwnedObjects({
          owner: targetAddress,
          options: {
            showType: true,
            showContent: true,
            showDisplay: true
          }
        });

        if (objects.data.length === 0) {
          return `No objects found for address: ${targetAddress}`;
        }

        let result = `Found ${objects.data.length} objects for address: ${targetAddress}\n\n`;
        
        objects.data.slice(0, 10).forEach((obj, index) => { // Limit to first 10 objects
          result += `${index + 1}. Object ID: ${obj.data?.objectId}\n`;
          result += `   Type: ${obj.data?.type || 'Unknown'}\n`;
          if (obj.data?.display?.data?.name) {
            result += `   Name: ${obj.data.display.data.name}\n`;
          }
          result += '\n';
        });

        if (objects.data.length > 10) {
          result += `... and ${objects.data.length - 10} more objects`;
        }

        return result;
      } catch (error) {
        return `Error getting owned objects: ${error.message}`;
      }
    }
  }),

  new DynamicTool({
    name: 'getTransactionHistory',
    description: 'Get recent transaction history for a specific address. Input should be a valid Sui address.',
    func: async (address) => {
      try {
        const targetAddress = address === 'my' || address === 'mine' ? walletAddress : address;
        
        if (!targetAddress) {
          return 'No wallet address available. Please provide a specific address or set up your private key.';
        }

        const txns = await suiClient.queryTransactionBlocks({
          filter: {
            FromOrToAddress: {
              addr: targetAddress
            }
          },
          options: {
            showEffects: true,
            showInput: true
          },
          limit: 5
        });

        if (txns.data.length === 0) {
          return `No transactions found for address: ${targetAddress}`;
        }

        let result = `Recent transactions for address: ${targetAddress}\n\n`;
        
        txns.data.forEach((txn, index) => {
          result += `${index + 1}. Transaction: ${txn.digest}\n`;
          result += `   Status: ${txn.effects?.status?.status || 'Unknown'}\n`;
          result += `   Gas Used: ${txn.effects?.gasUsed?.computationCost || 0} MIST\n`;
          result += `   Timestamp: ${txn.timestampMs ? new Date(Number(txn.timestampMs)).toLocaleString() : 'Unknown'}\n\n`;
        });

        return result;
      } catch (error) {
        return `Error getting transaction history: ${error.message}`;
      }
    }
  }),

  new DynamicTool({
    name: 'getNetworkInfo',
    description: 'Get information about the current Sui network and node status.',
    func: async () => {
      try {
        const [chainId, latestCheckpoint] = await Promise.all([
          suiClient.getChainIdentifier(),
          suiClient.getLatestCheckpointSequenceNumber()
        ]);

        return `Network: ${network}\nRPC URL: ${rpcUrl}\nChain ID: ${chainId}\nLatest Checkpoint: ${latestCheckpoint}\nConnected Wallet: ${walletAddress || 'None (read-only mode)'}`;
      } catch (error) {
        return `Error getting network info: ${error.message}`;
      }
    }
  })
];

// Create the prompt template
const prompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a helpful Sui blockchain assistant powered by the official Mysten Sui TypeScript SDK. 
   You can help users check their wallet balances, view transaction history, and get information about their Sui assets.
   
   Available tools:
   - getBalance: Get SUI balance for any address (use "my" or "mine" for connected wallet)
   - getOwnedObjects: Get all objects/NFTs owned by an address
   - getTransactionHistory: Get recent transactions for an address
   - getNetworkInfo: Get current network information
   
   When users ask about "my balance" or "my wallet", use "my" as the address input.
   Always be conversational and explain blockchain data in simple terms.
   Convert MIST to SUI when showing balances (1 SUI = 1,000,000,000 MIST).`],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}']
]);

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
  maxIterations: 3
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
  console.log('🚀 Sui Agent is ready! (Powered by Mysten Labs SDK)\n');
  
  // Show network and wallet info
  console.log(`🌐 Network: ${network}`);
  console.log(`🔗 RPC: ${rpcUrl}`);
  if (walletAddress) {
    console.log(`📱 Connected wallet: ${walletAddress}`);
  } else {
    console.log(`📱 Wallet: Read-only mode (no private key)`);
  }
  console.log('');
  
  // Example queries
  const examples = [
    "What's my SUI balance?",
    "Show me my recent transactions",
    "What objects do I own?",
    "Get network information",
    "Check balance of address 0x123..."
  ];
  
  console.log('💡 Try asking me things like:');
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
      rl.question('Ask me something about Sui (or type "exit" to quit): ', async (input) => {
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
    // Run a demo query
    console.log('🎯 Running demo query...\n');
    await runAgent("What network am I connected to and what's the current status?");
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Run the main function
main().catch(console.error); 