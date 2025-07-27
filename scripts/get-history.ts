import { Address, Cell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XPContract } from '../wrappers/XPContract';

interface Wallets {
  contract: string;
  user: { address: string };
}

function loadWallets(): Wallets {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8')
  );
}

interface Operation {
  amount: bigint;
  timestamp: bigint;
  opId: bigint;
}

function formatOpId(opId: bigint): string {
  const full = opId.toString(16).padStart(64, '0');
  return `${full.substring(0, 8)}...${full.substring(56)}`;
}

function formatXP(amount: bigint): string {
  return amount.toLocaleString('en-US') + ' XP';
}

function isRecentTimestamp(timestamp: bigint): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const oneYear = 31536000n;
  return timestamp > now - oneYear && timestamp < now + oneYear;
}

async function parseNestedCell(cell: Cell): Promise<Operation[]> {
  const operations: Operation[] = [];
  
  try {
    if (cell.bits.length >= 384) {
      const slice = cell.beginParse();
      const amount = slice.loadUintBig(64);
      const timestamp = slice.loadUintBig(64);
      const opId = slice.loadUintBig(256);
      
      return [{ opId, timestamp, amount }];
    }
  } catch (e) {
    console.log('Not a direct operation cell:', e);
  }
  
  for (const ref of cell.refs) {
    try {
      const nestedOps = await parseNestedCell(ref);
      operations.push(...nestedOps);
    } catch (e) {
      console.error('Error parsing nested cell:', e);
    }
  }
  
  return operations;
}

export async function run(provider: NetworkProvider) {
  const { contract, user } = loadWallets();
  if (!contract) throw new Error('Contract address missing');

  const contractAddr = Address.parse(contract);
  const userAddr = Address.parse(user.address);

  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);

  console.log('📡 Fetching history...');
  const historyCell = await opened.getUserHistory(userAddr);
  
  if (!historyCell || (historyCell.bits.length === 0 && historyCell.refs.length === 0)) {
    console.log('📭 No history found for user');
    return;
  }

  const allOperations = await parseNestedCell(historyCell);
  
  if (allOperations.length === 0) {
    console.log('📭 No operations found at all');
    return;
  }

  const validOperations = allOperations.filter(op => 
    op.amount > 0n && 
    op.amount < 1000000n &&
    isRecentTimestamp(op.timestamp)
  );

  validOperations.sort((a, b) => Number(b.timestamp - a.timestamp));

  console.log(`\n📊 Valid operations (${validOperations.length}):`);
  if (validOperations.length > 0) {
    console.log('-------------------------------------');
    validOperations.forEach((op, i) => {
      const date = new Date(Number(op.timestamp) * 1000);
      console.log(
        `#${i + 1} | OP ID: ${formatOpId(op.opId)}\n` +
        `   Amount: ${formatXP(op.amount)}\n` +
        `   Time: ${date.toISOString()}`
      );
      if (i < validOperations.length - 1) console.log('-------------------------------------');
    });
  } else {
    console.log('No valid operations found');
  }

  console.log('\n🔍 Operation details:');
  validOperations.slice(0, 5).forEach((op, i) => {
    console.log(`Operation ${i + 1}:`);
    console.log(`  OP ID: ${op.opId.toString()}`);
    console.log(`  Timestamp: ${op.timestamp.toString()} (${new Date(Number(op.timestamp) * 1000)})`);
    console.log(`  Amount: ${op.amount.toString()}`);
    console.log('---');
  });
}