import { DynamicTool } from '@langchain/core/tools';
import { suiClient, suiAgentKit } from '../config/sui-config.js';
import { getSuiAmount, getUsdcAmount, formatTokenAmount } from '../utils/token-utils.js';

const parseTimeFilter = (input) => {
  let timeFilter = 'all';
  let daysBack = 0;
  let startDate = null;
  let endDate = new Date();
  
  if (input) {
    const inputLower = input.toLowerCase().trim();
    
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
      const daysMatch = inputLower.match(/(\d+)\s*days?/);
      if (daysMatch) {
        daysBack = parseInt(daysMatch[1]);
        timeFilter = `last ${daysBack} days`;
        startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
      }
    }
  }
  
  return { timeFilter, startDate, endDate, daysBack };
};

const fetchTransactions = async (walletAddress, startDate = null) => {
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
      limit: 50,
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
      limit: 50,
      order: 'descending'
    });
    allTxs = [...allTxs, ...(receivedTxs.data || [])];
  } catch (receivedError) {
    console.log('Error getting received transactions:', receivedError.message);
  }

  let uniqueTxs = allTxs.filter((tx, index, self) => 
    index === self.findIndex(t => t.digest === tx.digest)
  ).sort((a, b) => 
    Number(b.timestampMs || 0) - Number(a.timestampMs || 0)
  );
  
  if (startDate) {
    const startTimestamp = startDate.getTime();
    uniqueTxs = uniqueTxs.filter(tx => {
      const txTimestamp = Number(tx.timestampMs || 0);
      return txTimestamp >= startTimestamp;
    });
  }
  
  return uniqueTxs;
};

export const getTransactionHistoryTool = () => new DynamicTool({
  name: 'get_transaction_history',
  description: 'Get the actual transaction history (list of transactions) for the user wallet, not just current balances. Accepts time filters like "last 7 days", "this month", "last week", "today", "yesterday", or specific date ranges.',
  func: async (input) => {
    try {
      const { timeFilter, startDate } = parseTimeFilter(input);
      
      const walletAddress = await suiAgentKit.getWalletAddress();
      console.log(`Getting transactions for wallet: ${walletAddress.substring(0, 10)}... (${timeFilter})`);
      
      const uniqueTxs = await fetchTransactions(walletAddress, startDate);
      
      if (uniqueTxs.length === 0) {
        return `No transaction history found for wallet address: ${walletAddress}`;
      }
      
      if (startDate && timeFilter !== 'all') {
        console.log(`Filtered to ${uniqueTxs.length} transactions from ${timeFilter}`);
      }
      
      const displayTxs = uniqueTxs.slice(0, 10);

      const transactions = displayTxs.map((tx, index) => {
        const timestamp = tx.timestampMs ? new Date(Number(tx.timestampMs)).toLocaleString() : 'Unknown';
        const status = tx.effects?.status?.status || 'Unknown';
        
        let transactionDetails = [];
        
        let hasExternalRecipient = false;
        let externalRecipientAddress = '';
        let actualRecipientAddress = '';
        let externalSenderAddress = '';
        
        if (tx.transaction?.data?.transaction?.kind === 'ProgrammableTransaction') {
          const programmableTx = tx.transaction.data.transaction;
          
          if (programmableTx.transactions) {
            for (const t of programmableTx.transactions) {
              if (t.TransferObjects) {
                const transferArgs = t.TransferObjects;
                if (transferArgs.length >= 2) {
                  const recipientInput = transferArgs[1];
                  
                  if (recipientInput && recipientInput.Input !== undefined) {
                    const inputIndex = recipientInput.Input;
                    if (programmableTx.inputs && programmableTx.inputs[inputIndex]) {
                      const input = programmableTx.inputs[inputIndex];
                      if (input.type === 'pure' && input.valueType === 'address') {
                        const recipientAddress = input.value;
                        if (recipientAddress && recipientAddress !== walletAddress) {
                          hasExternalRecipient = true;
                          externalRecipientAddress = recipientAddress;
                          actualRecipientAddress = recipientAddress;
                          break;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        if (tx.transaction && tx.transaction.data && tx.transaction.data.transactions) {
          for (const t of tx.transaction.data.transactions) {
            if (t.kind === 'TransferSui' && t.arguments && t.arguments.length >= 2) {
              const recipient = t.arguments[1];
              if (recipient && typeof recipient === 'string' && recipient !== walletAddress) {
                hasExternalRecipient = true;
                externalRecipientAddress = recipient;
                actualRecipientAddress = recipient;
                break;
              }
            }
          }
        }
        
        if (tx.transaction?.data?.sender && tx.transaction.data.sender !== walletAddress) {
          externalSenderAddress = tx.transaction.data.sender;
        }
        
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
            
            if (!ownerAddress || ownerAddress === 'null' || ownerAddress === 'undefined') {
              return null;
            }
            
            const shortAddress = ownerAddress.length > 8 ? ownerAddress.substring(0, 8) + '...' : ownerAddress;
            
            if (change.coinType.includes('::sui::SUI')) {
              const suiAmount = Math.abs(amount) / 1000000000;
              if (amount < 0) {
                if (actualRecipientAddress && actualRecipientAddress !== walletAddress) {
                  const shortRecipient = actualRecipientAddress.length > 8 ? 
                    actualRecipientAddress.substring(0, 8) + '...' : actualRecipientAddress;
                  return `Sent ${suiAmount.toFixed(9)} SUI to ${shortRecipient}`;
                } else if (ownerAddress === walletAddress) {
                  return `Sent ${suiAmount.toFixed(9)} SUI to yourself (same wallet)`;
                } else {
                  return `Sent ${suiAmount.toFixed(9)} SUI to ${shortAddress}`;
                }
              } else {
                if (externalSenderAddress && externalSenderAddress !== walletAddress) {
                  const shortSender = externalSenderAddress.length > 8 ? 
                    externalSenderAddress.substring(0, 8) + '...' : externalSenderAddress;
                  return `Received ${suiAmount.toFixed(9)} SUI from ${shortSender}`;
                } else if (ownerAddress === walletAddress) {
                  return `Received ${suiAmount.toFixed(9)} SUI from yourself (same wallet)`;
                } else {
                  return `Received ${suiAmount.toFixed(9)} SUI from ${shortAddress}`;
                }
              }
            } else if (change.coinType.includes('usdc') || change.coinType.includes('USDC')) {
              const usdcAmount = Math.abs(amount) / 1000000;
              if (amount < 0) {
                if (actualRecipientAddress && actualRecipientAddress !== walletAddress) {
                  const shortRecipient = actualRecipientAddress.length > 8 ? 
                    actualRecipientAddress.substring(0, 8) + '...' : actualRecipientAddress;
                  return `Sent ${usdcAmount.toFixed(2)} USDC to ${shortRecipient}`;
                } else if (ownerAddress === walletAddress) {
                  return `Sent ${usdcAmount.toFixed(2)} USDC to yourself (same wallet)`;
                } else {
                  return `Sent ${usdcAmount.toFixed(2)} USDC to ${shortAddress}`;
                }
              } else {
                if (externalSenderAddress && externalSenderAddress !== walletAddress) {
                  const shortSender = externalSenderAddress.length > 8 ? 
                    externalSenderAddress.substring(0, 8) + '...' : externalSenderAddress;
                  return `Received ${usdcAmount.toFixed(2)} USDC from ${shortSender}`;
                } else if (ownerAddress === walletAddress) {
                  return `Received ${usdcAmount.toFixed(2)} USDC from yourself (same wallet)`;
                } else {
                  return `Received ${usdcAmount.toFixed(2)} USDC from ${shortAddress}`;
                }
              }
            } else {
              const tokenName = change.coinType.split('::').pop();
              if (amount < 0) {
                if (actualRecipientAddress && actualRecipientAddress !== walletAddress) {
                  const shortRecipient = actualRecipientAddress.length > 8 ? 
                    actualRecipientAddress.substring(0, 8) + '...' : actualRecipientAddress;
                  return `Sent ${Math.abs(amount)} ${tokenName} to ${shortRecipient}`;
                } else if (ownerAddress === walletAddress) {
                  return `Sent ${Math.abs(amount)} ${tokenName} to yourself (same wallet)`;
                } else {
                  return `Sent ${Math.abs(amount)} ${tokenName} to ${shortAddress}`;
                }
              } else {
                if (externalSenderAddress && externalSenderAddress !== walletAddress) {
                  const shortSender = externalSenderAddress.length > 8 ? 
                    externalSenderAddress.substring(0, 8) + '...' : externalSenderAddress;
                  return `Received ${Math.abs(amount)} ${tokenName} from ${shortSender}`;
                } else if (ownerAddress === walletAddress) {
                  return `Received ${Math.abs(amount)} ${tokenName} from yourself (same wallet)`;
                } else {
                  return `Received ${Math.abs(amount)} ${tokenName} from ${shortAddress}`;
                }
              }
            }
          }).filter(change => change !== null);
          transactionDetails.push(...changes);
        }
        
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
        
        if (tx.transaction && tx.transaction.data && tx.transaction.data.sender === walletAddress) {
          if (tx.transaction.data.transactions) {
            const calls = tx.transaction.data.transactions.map(t => {
              if (t.kind === 'MoveCall') {
                return `Called ${t.target.split('::').pop()}`;
              } else if (t.kind === 'TransferObjects') {
                return 'Object transfer';
              } else if (t.kind === 'SplitCoins') {
                return 'Coin splitting';
              } else if (t.kind === 'MergeCoins') {
                return 'Coin merging';
              } else if (t.kind === 'TransferSui') {
                if (t.arguments && t.arguments.length >= 2) {
                  const recipient = t.arguments[1];
                  if (recipient && typeof recipient === 'string' && recipient !== walletAddress) {
                    const shortRecipient = recipient.length > 8 ? recipient.substring(0, 8) + '...' : recipient;
                    return `TransferSui to ${shortRecipient}`;
                  } else if (recipient === walletAddress) {
                    return 'TransferSui to yourself';
                  }
                }
                return 'TransferSui';
              }
              return `Operation: ${t.kind}`;
            });
            transactionDetails.push(...calls);
          }
        }
        
        if (hasExternalRecipient && transactionDetails.length > 0) {
          const firstDetail = transactionDetails[0];
          if (firstDetail.includes('to yourself') && externalRecipientAddress) {
            const shortExternal = externalRecipientAddress.length > 8 ? 
              externalRecipientAddress.substring(0, 8) + '...' : externalRecipientAddress;
            transactionDetails[0] = firstDetail.replace('to yourself (same wallet)', `to ${shortExternal}`);
          }
        }
        
        if (transactionDetails.length === 0) {
          transactionDetails.push('Blockchain operation');
        }
        
        const mainSummary = transactionDetails[0] || 'Transaction';
        
        return `${index + 1}. **${mainSummary}**
   • Time: ${timestamp}
   • Status: ${status}
   • Tx ID: ${tx.digest.substring(0, 12)}...
   ${transactionDetails.length > 1 ? `• Additional: ${transactionDetails.slice(1).join(', ')}` : ''}`;
      });

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
});

export const getSuiSummaryTool = () => new DynamicTool({
  name: 'get_sui_summary',
  description: 'Calculate total SUI and USDC sent and received in a specific time period. Accepts time filters like "last 7 days", "this month", "last week", "today", "yesterday", or specific date ranges.',
  func: async (input) => {
    try {
      const { timeFilter, startDate } = parseTimeFilter(input);
      
      const walletAddress = await suiAgentKit.getWalletAddress();
      console.log(`Calculating SUI summary for wallet: ${walletAddress.substring(0, 10)}... (${timeFilter})`);
      
      const uniqueTxs = await fetchTransactions(walletAddress, startDate);
      
      if (uniqueTxs.length === 0) {
        return `No transactions found for wallet address: ${walletAddress}${timeFilter !== 'all' ? ` in ${timeFilter}` : ''}`;
      }
      
      let totalSuiSent = 0;
      let totalSuiReceived = 0;
      let totalUsdcSent = 0;
      let totalUsdcReceived = 0;
      let transactionCount = 0;
      
      uniqueTxs.forEach(tx => {
        if (tx.balanceChanges && tx.balanceChanges.length > 0) {
          tx.balanceChanges.forEach(change => {
            const amount = Number(change.amount);
            
            if (change.coinType.includes('::sui::SUI')) {
              const suiAmount = getSuiAmount(amount);
              if (amount < 0) {
                totalSuiSent += suiAmount;
              } else {
                totalSuiReceived += suiAmount;
              }
            } else if (change.coinType.includes('usdc') || change.coinType.includes('USDC')) {
              const usdcAmount = getUsdcAmount(amount);
              if (amount < 0) {
                totalUsdcSent += usdcAmount;
              } else {
                totalUsdcReceived += usdcAmount;
              }
            }
          });
        }
        transactionCount++;
      });
      
      let timeSummary = '';
      if (timeFilter !== 'all') {
        timeSummary = `\n⏰ **Time Period:** ${timeFilter}`;
        if (startDate) {
          timeSummary += ` (from ${startDate.toLocaleDateString()})`;
        }
      }
      
      const netSui = totalSuiReceived - totalSuiSent;
      const netUsdc = totalUsdcReceived - totalUsdcSent;
      
      return `💰 **SUI & USDC Summary${timeFilter !== 'all' ? ` - ${timeFilter}` : ''}**

${timeSummary}

📊 **Transaction Count:** ${transactionCount} transactions

🟢 **SUI Tokens:**
• Total Sent: ${totalSuiSent.toFixed(9)} SUI
• Total Received: ${totalSuiReceived.toFixed(9)} SUI
• Net Flow: ${netSui >= 0 ? '+' : ''}${netSui.toFixed(9)} SUI

🔵 **USDC Tokens:**
• Total Sent: ${totalUsdcSent.toFixed(2)} USDC
• Total Received: ${totalUsdcReceived.toFixed(2)} USDC
• Net Flow: ${netUsdc >= 0 ? '+' : ''}${netUsdc.toFixed(2)} USDC

💡 **Net Flow Explanation:**
• Positive net flow = More received than sent (net gain)
• Negative net flow = More sent than received (net loss)
• Zero net flow = Equal amounts sent and received`;
      
    } catch (error) {
      console.error('SUI summary error:', error);
      return `Error calculating SUI summary: ${error.message}. Please try again.`;
    }
  }
}); 