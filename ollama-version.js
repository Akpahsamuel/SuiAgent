import 'dotenv/config';
import { ChatOllama } from '@langchain/ollama';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { DynamicTool } from '@langchain/core/tools';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/bcs';

console.log('🦙 Sui Agent with Ollama (Free Local AI)\n');

// Initialize Sui client
const network = process.env.SUI_NETWORK || 'testnet';
const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl(network);
const suiClient = new SuiClient({ url: rpcUrl });

// Initialize keypair if private key is provided
let keypair = null;
let walletAddress = null;

if (process.env.SUI_PRIVATE_KEY && process.env.SUI_PRIVATE_KEY !== 'your_sui_private_key_here') {
  try {
    const privateKeyBytes = fromB64(process.env.SUI_PRIVATE_KEY);
    keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
    walletAddress = keypair.toSuiAddress();
  } catch (error) {
    console.warn('⚠️  Invalid private key format. Agent will work in read-only mode.');
  }
}

// Initialize Ollama (free local AI)
const llm = new ChatOllama({
  baseUrl: "http://localhost:11434", // Default Ollama URL
  model: "llama3.2", // You can use llama3.2, phi3, or other models
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

        const suiBalance = Number(balance.totalBalance) / 1_000_000_000;
        
        return `Address: ${targetAddress}\nSUI Balance: ${suiBalance.toFixed(4)} SUI\nRaw Balance: ${balance.totalBalance} MIST`;
      } catch (error) {
        return `Error getting balance: ${error.message}`;
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
          },
          limit: 5
        });

        if (objects.data.length === 0) {
          return `No objects found for address: ${targetAddress}`;
        }

        let result = `Found ${objects.data.length} objects for address: ${targetAddress}\n\n`;
        
        objects.data.forEach((obj, index) => {
          result += `${index + 1}. Object ID: ${obj.data?.objectId}\n`;
          result += `   Type: ${obj.data?.type || 'Unknown'}\n\n`;
        });

        return result;
      } catch (error) {
        return `Error getting owned objects: ${error.message}`;
      }
    }
  })
];

// Create the prompt template
const prompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a helpful Sui blockchain assistant. You can help users check their wallet balances, 
   view network information, and get information about their Sui assets.
   
   Available tools:
   - getBalance: Get SUI balance for any address (use "my" or "mine" for connected wallet)
   - getOwnedObjects: Get all objects/NFTs owned by an address  
   - getNetworkInfo: Get current network information
   
   When users ask about "my balance" or "my wallet", use "my" as the address input.
   Always be conversational and explain blockchain data in simple terms.
   Convert MIST to SUI when showing balances (1 SUI = 1,000,000,000 MIST).`],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}']
]);

// Function to check if Ollama is available
async function checkOllama() {
  try {
    const response = await fetch('http://localhost:11434/api/version');
    if (response.ok) {
      console.log('✅ Ollama detected and running\n');
      return true;
    }
  } catch (error) {
    console.log('❌ Ollama not running. Please install and start Ollama:');
    console.log('   1. Install: https://ollama.ai/');
    console.log('   2. Run: ollama pull llama3.2');
    console.log('   3. Start: ollama serve\n');
    return false;
  }
  return false;
}

// Simple fallback without AI
async function runWithoutAI(userInput) {
  console.log(`\n🤖 Processing: "${userInput}" (Direct mode)\n`);
  
  // Simple keyword matching for demo
  if (userInput.toLowerCase().includes('network') || userInput.toLowerCase().includes('status')) {
    const networkTool = tools.find(t => t.name === 'getNetworkInfo');
    const result = await networkTool.func();
    console.log(`✅ Response: ${result}\n`);
  } else if (userInput.toLowerCase().includes('balance')) {
    const balanceTool = tools.find(t => t.name === 'getBalance');
    const testAddress = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const result = await balanceTool.func(testAddress);
    console.log(`✅ Response: ${result}\n`);
  } else {
    console.log('✅ Available commands: "network status", "check balance"\n');
  }
}

// Main function
async function main() {
  console.log('🚀 Sui Agent with Free Local AI Ready!\n');
  
  console.log(`🌐 Network: ${network}`);
  console.log(`📱 Wallet: ${walletAddress || 'Read-only mode'}\n`);

  const hasOllama = await checkOllama();
  
  if (!hasOllama) {
    console.log('🎯 Running in direct mode (no AI)...\n');
    await runWithoutAI("What's the network status?");
    await runWithoutAI("Check balance");
    return;
  }

  // Create the agent with Ollama
  try {
    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools,
      prompt
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
      maxIterations: 3
    });

    console.log('🎯 Running AI-powered demo...\n');
    const result = await agentExecutor.invoke({
      input: "What network am I connected to and what's the current status?"
    });
    
    console.log(`\n✅ AI Response: ${result.output}\n`);
  } catch (error) {
    console.log('❌ AI mode failed, running direct mode instead...\n');
    await runWithoutAI("What's the network status?");
  }
}

main().catch(console.error); 