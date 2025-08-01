import { Address, Cell, Dictionary, beginCell } from '@ton/core';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import inquirer from 'inquirer';
import { TonClient } from '@ton/ton';

interface User {
  id: number;
  address: string;
  addressNonBounce: string;
  publicKey: string;
  mnemonic: string;
}

interface Wallets {
  contract: string;
  owner: {
    address: string;
    mnemonic: string;
  };
  users?: User[];
  nextUserId?: number;
}

interface Operation {
  amount: bigint;
  timestamp: bigint;
  opId: bigint;
  txHash?: string;
}

const MAX_XP_PER_OP = 1_000_000n;
const API_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const API_KEY = '8cf308a3ba1d15eb11875c9c2e48d87cc381d97cb4a30a7288cb19e79f51ce5d';

function loadWallets(): Wallets {
  console.log('\n═════════ LOADING CONFIGURATION ═════════');
  console.log('✦ Reading wallet configuration...');
  
  try {
    const path = resolve(process.cwd(), 'wallets.json');
    const data = readFileSync(path, 'utf8');
    const wallets = JSON.parse(data) as Wallets;
    
    if (!wallets.contract) throw new Error('Contract address missing');
    if (!wallets.owner?.address) throw new Error('Owner address missing');
    
    console.log('✅ Configuration loaded');
    console.log(`✦ Contract: ${formatAddress(wallets.contract)}`);
    console.log(`✦ Owner: ${formatAddress(wallets.owner.address)}`);
    
    return wallets;
  } catch (e) {
    const error = e as Error;
    console.error('❌ Failed to load configuration:');
    console.error(`✦ Message: ${error.message}`);
    throw error;
  }
}

function formatAddress(address: string): string {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function formatOpId(opId: bigint): string {
  const full = opId.toString(16).padStart(64, '0');
  return `${full.substring(0, 6)}...${full.substring(58)}`;
}

function formatXP(amount: bigint): string {
  try {
    return amount.toLocaleString('en-US') + ' XP';
  } catch {
    return amount.toString() + ' XP';
  }
}

function formatDutchDateTime(date: Date): string {
  const day = date.getDate();
  const monthNames = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day} ${month} ${year} om ${hours}:${minutes}`;
}

const OpInlineValueCodec = {
  serialize: (src: Operation, b: any) => {
    b.storeUint(src.amount, 64)
     .storeUint(src.timestamp, 64)
     .storeUint(src.opId, 256);
  },
  parse: (s: any): Operation => {
    return {
      amount: s.loadUintBig(64),
      timestamp: s.loadUintBig(64),
      opId: s.loadUintBig(256)
    };
  },
};

function loadOpDictCompat(root: Cell): Dictionary<bigint, Operation> {
  const keys = Dictionary.Keys.BigUint(256);

  if (typeof (Dictionary as any).loadDirect === 'function') {
    return (Dictionary as any).loadDirect(keys, OpInlineValueCodec, root);
  }

  if (typeof (Dictionary as any).load === 'function') {
    return (Dictionary as any).load(keys, OpInlineValueCodec, root.beginParse());
  }

  throw new Error('No compatible Dictionary loading method found');
}

class XPContract {
  constructor(readonly address: Address) {}

  async getUserHistory(provider: any, userAddress: Address): Promise<Cell | null> {
    console.log('✦ Fetching user history from contract...');
    
    try {
      const args = beginCell()
        .storeAddress(userAddress)
        .endCell();

      const result = await provider.get('get_user_history', [
        { type: 'slice', cell: args }
      ]);

      if (!result.stack.remaining) {
        console.log('✦ No history data found in response');
        return null;
      }

      console.log('✅ History data received');
      return result.stack.readCell();
    } catch (e) {
      const error = e as Error;
      console.error('\n❌ Contract operation failed:');
      console.error(`✦ Message: ${error.message}`);
      return null;
    }
  }
}

// ===================== MAIN PROCESS =====================
async function main() {
  console.log('\n══════════ XP TRANSACTION HISTORY ══════════');

  // Load configuration
  const wallets = loadWallets();

  // Prepare account selection
  console.log('\n═════════ ACCOUNT SELECTION ═════════');
  const choices = [
    { name: '✦ Owner', value: 'owner' }
  ];

  if (wallets.users && wallets.users.length > 0) {
    wallets.users.forEach(user => {
      choices.push({
        name: `✦ User #${user.id} (${formatAddress(user.address)})`,
        value: user.id.toString()
      });
    });
  }

  // User selection
  const { accountType } = await inquirer.prompt([{
    type: 'list',
    name: 'accountType',
    message: 'Select account to view history:',
    choices
  }]);

  // Determine address
  let targetAddress: Address;
  let accountLabel: string;

  if (accountType === 'owner') {
    targetAddress = Address.parse(wallets.owner.address);
    accountLabel = `Owner (${formatAddress(wallets.owner.address)})`;
  } else {
    const user = wallets.users?.find(u => u.id.toString() === accountType);
    if (!user) throw new Error('User not found');
    targetAddress = Address.parse(user.address);
    accountLabel = `User #${user.id} (${formatAddress(user.address)})`;
  }

  console.log(`\n✦ Selected account: ${accountLabel}`);

  // Blockchain connection
  console.log('\n═════════ BLOCKCHAIN CONNECTION ═════════');
  const contractAddr = Address.parse(wallets.contract);
  
  console.log('✦ Initializing TON client...');
  const client = new TonClient({ endpoint: API_ENDPOINT, apiKey: API_KEY });
  const provider = client.provider(contractAddr);
  const xp = new XPContract(contractAddr);
  
  console.log('✅ Client initialized');
  console.log(`✦ Network: ${API_ENDPOINT}`);
  console.log(`✦ Contract: ${formatAddress(contractAddr.toString())}`);

  // Fetch history
  console.log('\n═════════ FETCHING TRANSACTIONS ═════════');
  const historyCell = await xp.getUserHistory(provider, targetAddress);

  if (!historyCell || (historyCell.bits.length === 0 && historyCell.refs.length === 0)) {
    console.log('\n✦ No transaction history found for this account');
    return;
  }

  console.log(`✦ Cell stats: ${historyCell.bits.length} bits, ${historyCell.refs.length} refs`);

  // Process operations
  console.log('\n═════════ PROCESSING TRANSACTIONS ═════════');
  console.log('✦ Loading operations dictionary...');
  
  const dict = loadOpDictCompat(historyCell);
  const totalEntries = dict.size;
  console.log(`✅ Loaded ${totalEntries} operations`);

  const allOperations: Operation[] = [];
  
  for (const [opId, op] of dict) {
    allOperations.push({ 
      ...op, 
      txHash: opId.toString(16).padStart(64, '0') 
    });
  }

  // Sort and calculate
  allOperations.sort((a, b) => Number(b.timestamp - a.timestamp));
  const totalXP = allOperations.reduce((sum, op) => sum + op.amount, 0n);
  const avgXP = totalEntries > 0 ? totalXP / BigInt(totalEntries) : 0n;

  // Generate report
  console.log('\n══════════ TRANSACTION REPORT ══════════');
  console.log(`✦ Account: ${accountLabel}`);
  console.log(`✦ Total Transactions: ${allOperations.length}`);
  console.log(`✦ Total XP: ${formatXP(totalXP)}`);
  console.log(`✦ Average XP: ${formatXP(avgXP)}`);

  if (allOperations.length > 0) {
    const firstDate = new Date(Number(allOperations[allOperations.length - 1].timestamp) * 1000);
    const lastDate  = new Date(Number(allOperations[0].timestamp) * 1000);
    
    console.log(`✦ First Transaction: ${formatDutchDateTime(firstDate)}`);
    console.log(`✦ Last Transaction: ${formatDutchDateTime(lastDate)}`);
  }

  // Detailed view
  if (allOperations.length > 0) {
    console.log('\n══════════ TRANSACTION DETAILS ══════════');
    console.log(`✦ Showing ${allOperations.length} transactions:`);
    
    allOperations.forEach((op, index) => {
      const date = new Date(Number(op.timestamp) * 1000);
      const isRecent = Date.now() - date.getTime() < 30 * 24 * 60 * 60 * 1000;
      
      console.log(
        `\n────────────────────────────────\n` +
        `✦ Transaction #${index + 1}\n` +
        `  ✦ TX Hash: ${formatOpId(BigInt('0x' + op.txHash!))}\n` +
        `  ✦ OP ID:   ${formatOpId(op.opId)}\n` +
        `  ✦ Amount:  ${formatXP(op.amount)} ${isRecent ? '🆕' : ''}\n` +
        `  ✦ Time:    ${formatDutchDateTime(date)}\n` +
        `  ✦ Date:    ${date.toISOString().split('T')[0]}`
      );
    });
  }

  // Final summary
  console.log('\n══════════════ REPORT SUMMARY ══════════════');
  console.log(`✦ Account: ${accountLabel}`);
  console.log(`✦ Total Transactions: ${allOperations.length}`);
  console.log(`✦ Total XP: ${formatXP(totalXP)}`);
  console.log('✨ Report completed successfully');
  console.log('══════════════════════════════════════════════');
}

// ===================== ERROR HANDLER =====================
main().catch(e => {
  const error = e as Error;
  console.error('\n❌ UNHANDLED ERROR:');
  console.error(`✦ Message: ${error.message}`);
  console.error('✦ Action: Check configuration and network connection');
  process.exit(1);
});