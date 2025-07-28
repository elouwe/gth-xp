import { Address, Cell, Dictionary } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XPContract } from '../wrappers/XPContract';

// -------------------- Types & utils --------------------

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

const MAX_XP_PER_OP = 1_000_000n;

function formatOpId(opId: bigint): string {
  const full = opId.toString(16).padStart(64, '0');
  return `${full.substring(0, 8)}...${full.substring(56)}`;
}

function formatXP(amount: bigint): string {
  try {
    return amount.toLocaleString('en-US') + ' XP';
  } catch {
    return amount.toString() + ' XP';
  }
}

// Check if timestamp is within 1 year of current time
function isRecentTimestamp(timestamp: bigint): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const oneYear = 31536000n;
  return timestamp > now - oneYear && timestamp < now + oneYear;
}

// -------------------- Dutch date formatter --------------------
function formatDutchDateTime(date: Date): string {
    const day = date.getDate();
    const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day} ${month} ${year} om ${hours}:${minutes}`;
}

// -------------------- Dictionary codecs --------------------

// amount(64) | timestamp(64) | op_id(256)
const OpInlineValueCodec: any = {

  serialize: (src: Operation, b: any) => {
    b.storeUint(src.amount, 64)
     .storeUint(src.timestamp, 64)
     .storeUint(src.opId, 256);
  },
  parse: (s: any): Operation => {
    const amount = s.loadUintBig(64);
    const timestamp = s.loadUintBig(64);
    const opId = s.loadUintBig(256);
    return { amount, timestamp, opId };
  },
};

// Compatible dictionary loader: op_id(uint256) -> Operation (inline)
function loadOpDictCompat(root: Cell): any /* Dictionary<bigint, Operation> */ {
  const keys = Dictionary.Keys.BigUint(256);
  const anyDict = Dictionary as any;

  // Handle new @ton/core versions
  if (typeof anyDict.loadDirect === 'function') {
    return anyDict.loadDirect(keys, OpInlineValueCodec, root);
  }
  // Handle old @ton/core versions: load from slice
  return Dictionary.load(keys, OpInlineValueCodec, root.beginParse());
}

// -------------------- Main --------------------

export async function run(provider: NetworkProvider) {
  const { contract, user } = loadWallets();
  if (!contract) throw new Error('Contract address missing');
  if (!user?.address) throw new Error('User address missing');

  const contractAddr = Address.parse(contract);
  const userAddr = Address.parse(user.address);

  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);

  console.log('📡 Fetching history...');
  const historyCell: Cell | null = await opened.getUserHistory(userAddr);

  if (!historyCell || (historyCell.bits.length === 0 && historyCell.refs.length === 0)) {
    console.log('📭 No history found for user');
    return;
  }

  // 1) Correctly load op_id -> Operation dictionary
  const dict = loadOpDictCompat(historyCell);

  // 2) Iterate through keys
  const allOperations: Operation[] = [];
  let total = 0;

  for (const opId of Array.from(dict.keys() as Iterable<bigint>)) {
    total++;
    try {
      const op: Operation | null = dict.get(opId);
      if (op) {
        allOperations.push(op);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse value for opId ${opId.toString(16)}:`, e);
    }
  }

  if (allOperations.length === 0) {
    console.log('📭 No operations found at all');
    return;
  }

  // Filter valid operations: positive amount, within limits, and recent timestamp
  const validOperations = allOperations
    .filter(op =>
      op.amount > 0n &&
      op.amount < MAX_XP_PER_OP &&
      isRecentTimestamp(op.timestamp)
    )
    .sort((a, b) => Number(b.timestamp - a.timestamp));

  console.log(`\n🧾 Total ops in dict: ${total}`);
  console.log(`📊 Valid operations (${validOperations.length}):`);

  if (validOperations.length > 0) {
    console.log('-------------------------------------');
    validOperations.forEach((op, i) => {
      const date = new Date(Number(op.timestamp) * 1000);
      console.log(
        `#${i + 1} | OP ID: ${formatOpId(op.opId)}\n` +
        `   Amount: ${formatXP(op.amount)}\n` +
        `   Time: ${formatDutchDateTime(date)}`
      );
      if (i < validOperations.length - 1) console.log('-------------------------------------');
    });
  } else {
    console.log('No valid operations found');
  }

  // Show detailed information for first 5 operations
  console.log('\n🔍 Operation details:');
  validOperations.slice(0, 5).forEach((op, i) => {
    console.log(`Operation ${i + 1}:`);
    console.log(`  OP ID: ${op.opId.toString()}`);
    console.log(`  Timestamp: ${op.timestamp.toString()} (${formatDutchDateTime(new Date(Number(op.timestamp) * 1000))})`);
    console.log(`  Amount: ${op.amount.toString()}`);
    console.log('---');
  });
}