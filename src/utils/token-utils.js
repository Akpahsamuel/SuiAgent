import { MIST_PER_SUI } from '@mysten/sui/utils';

export const mistToSui = (mistAmount) => {
  return Number(mistAmount) / Number(MIST_PER_SUI);
};

export const formatTokenAmount = (amount, coinType) => {
  if (coinType.includes('::sui::SUI')) {
    const suiAmount = mistToSui(Math.abs(amount));
    return `${suiAmount.toFixed(9)} SUI`;
  } else if (coinType.includes('usdc') || coinType.includes('USDC')) {
    const usdcAmount = Math.abs(amount) / 1000000;
    return `${usdcAmount.toFixed(2)} USDC`;
  } else {
    return `${Math.abs(amount)} tokens`;
  }
};

export const getSuiAmount = (mistAmount) => {
  return mistToSui(Math.abs(mistAmount));
};

export const getUsdcAmount = (rawAmount) => {
  return Math.abs(rawAmount) / 1000000;
}; 