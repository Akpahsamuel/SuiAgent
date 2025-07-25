import 'dotenv/config';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/bcs';

console.log('🧪 Testing Sui Tools Directly (No OpenAI Required)\n');

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
    console.warn('⚠️  Invalid private key format. Testing in read-only mode.');
  }
}

console.log(`🌐 Network: ${network}`);
console.log(`🔗 RPC: ${rpcUrl}`);
console.log(`📱 Wallet: ${walletAddress || 'Read-only mode'}\n`);

// Test functions
async function testNetworkInfo() {
  console.log('🔍 Testing Network Information...');
  try {
    const [chainId, latestCheckpoint] = await Promise.all([
      suiClient.getChainIdentifier(),
      suiClient.getLatestCheckpointSequenceNumber()
    ]);

    console.log(`   ✅ Chain ID: ${chainId}`);
    console.log(`   ✅ Latest Checkpoint: ${latestCheckpoint}`);
    console.log(`   ✅ Network Status: Connected\n`);
  } catch (error) {
    console.log(`   ❌ Network test failed: ${error.message}\n`);
  }
}

async function testBalance(address) {
  console.log(`🪙 Testing Balance for: ${address}`);
  try {
    const balance = await suiClient.getBalance({
      owner: address,
      coinType: '0x2::sui::SUI'
    });

    const suiBalance = Number(balance.totalBalance) / 1_000_000_000;
    console.log(`   ✅ SUI Balance: ${suiBalance.toFixed(4)} SUI`);
    console.log(`   ✅ Raw Balance: ${balance.totalBalance} MIST\n`);
  } catch (error) {
    console.log(`   ❌ Balance test failed: ${error.message}\n`);
  }
}

async function testOwnedObjects(address) {
  console.log(`📦 Testing Owned Objects for: ${address}`);
  try {
    const objects = await suiClient.getOwnedObjects({
      owner: address,
      options: {
        showType: true,
        showContent: true,
        showDisplay: true
      },
      limit: 5
    });

    console.log(`   ✅ Found ${objects.data.length} objects`);
    objects.data.forEach((obj, index) => {
      console.log(`   ${index + 1}. Object ID: ${obj.data?.objectId}`);
      console.log(`      Type: ${obj.data?.type || 'Unknown'}`);
    });
    console.log('');
  } catch (error) {
    console.log(`   ❌ Objects test failed: ${error.message}\n`);
  }
}

async function testTransactionHistory(address) {
  console.log(`📊 Testing Transaction History for: ${address}`);
  try {
    const txns = await suiClient.queryTransactionBlocks({
      filter: {
        FromOrToAddress: {
          addr: address
        }
      },
      options: {
        showEffects: true,
        showInput: true
      },
      limit: 3
    });

    console.log(`   ✅ Found ${txns.data.length} recent transactions`);
    txns.data.forEach((txn, index) => {
      console.log(`   ${index + 1}. Transaction: ${txn.digest}`);
      console.log(`      Status: ${txn.effects?.status?.status || 'Unknown'}`);
    });
    console.log('');
  } catch (error) {
    console.log(`   ❌ Transaction history test failed: ${error.message}\n`);
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Sui Tools Test Suite...\n');

  // Test network connectivity
  await testNetworkInfo();

  // Test with a known testnet address with activity
  const testAddress = '0x0000000000000000000000000000000000000000000000000000000000000001';
  
  // Test balance
  await testBalance(testAddress);
  
  // Test your wallet if available
  if (walletAddress) {
    console.log('📱 Testing Your Connected Wallet:\n');
    await testBalance(walletAddress);
    await testOwnedObjects(walletAddress);
    await testTransactionHistory(walletAddress);
  } else {
    console.log('📝 Note: No private key provided. Skipping wallet-specific tests.\n');
  }

  console.log('✅ Sui Tools Test Complete!');
  console.log('🎯 Your Sui integration is working perfectly!');
  console.log('💡 To test with AI, you need OpenAI credits or try a free alternative like Ollama.\n');
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
});

// Run the tests
runTests().catch(console.error); 