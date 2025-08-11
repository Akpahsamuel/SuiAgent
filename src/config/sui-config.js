import 'dotenv/config';
import { SuiAgentKit } from '@getnimbus/sui-agent-kit';
import { SuiClient } from '@mysten/sui/client';

export const suiAgentKit = new SuiAgentKit(
  process.env.SUI_PRIVATE_KEY,
  process.env.SUI_RPC_URL || (process.env.SUI_NETWORK === 'mainnet' ? 'https://fullnode.mainnet.sui.io:443' : 'https://fullnode.testnet.sui.io:443'),
  process.env.OPENAI_API_KEY
);

export const network = process.env.SUI_NETWORK || 'testnet';
export const rpcUrl = process.env.SUI_RPC_URL || (network === 'mainnet' ? 'https://fullnode.mainnet.sui.io:443' : 'https://fullnode.testnet.sui.io:443');
export const suiClient = new SuiClient({ url: rpcUrl });

export const validateEnvironment = () => {
  if (!process.env.SUI_PRIVATE_KEY) {
    throw new Error('SUI_PRIVATE_KEY is required in .env file');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required in .env file');
  }
  console.log(`🌐 Using ${network} network: ${rpcUrl}`);
}; 