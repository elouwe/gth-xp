// scripts/add-xp.ts
// ══════════════════════ IMPORTS ════════════════════
import { Address, toNano, fromNano, Sender } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XPContract } from '../wrappers/XPContract';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { randomBytes } from 'crypto';
import { AppDataSource } from '../src/data-source';
import { User } from '../src/entities/User';
import { Transaction as DBTransaction } from '../src/entities/Transaction';
import { TonClient } from '@ton/ton';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// ══════════════════════ ENVIRONMENT SETUP ════════════════════
dotenv.config();

interface Wallets {
  contract: string;
  owner: { mnemonic: string; address: string };
  users: { id: number; address: string; mnemonic: string }[];
}

function load(): Wallets {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8')
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 2000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`✦ Attempt ${i + 1} failed: ${error}`);
      if (i === retries - 1) throw error;
      console.log(`✦ Retrying in ${delayMs}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Unreachable');
}

function calculateDelay(lastOpTime: number): number {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - lastOpTime;
  
  if (elapsed < 60) return 10000;
  if (elapsed < 300) return 5000;
  return 2000;
}

function generateOpId(): bigint {
  const buffer = randomBytes(8);
  return BigInt('0x' + buffer.toString('hex'));
}

async function getTransactionHash(client: TonClient, address: Address, minLt: bigint): Promise<string | null> {
  for (let i = 0; i < 10; i++) {
    try {
      const transactions = await client.getTransactions(address, {
        limit: 5,
        inclusive: true
      });

      for (const tx of transactions) {
        if (tx.lt > minLt) {
          return tx.hash().toString('hex');
        }
      }
      
      console.log('⏳ Waiting for transaction confirmation...');
      await new Promise(r => setTimeout(r, 3000));
    } catch (error: any) {
      if (error?.response?.status === 429) {
        const waitTime = 5000 * (i + 1);
        console.warn(`⚠️ Rate limited. Waiting ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
      } else {
        throw error;
      }
    }
  }
  return null;
}

function createHighGasSender(baseSender: Sender, extraGas: bigint): Sender {
  return {
    address: baseSender.address,
    send: async (args) => {
      return baseSender.send({
        ...args,
        value: args.value + extraGas
      });
    }
  };
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ══════════════════════ MAIN EXECUTION ═══════════════════════
export async function run(provider: NetworkProvider) {
  console.log('\n═════════════════════ INITIALIZATION ═════════════════════');
  console.log('✦ Starting XP distribution process');
  console.log('✦ Current date:', new Date().toISOString());
  
  // ──────────────────── ENVIRONMENT CONFIG ────────────────────
  const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
  if (!TONCENTER_API_KEY) {
    console.error('❌ TONCENTER_API_KEY not set in environment');
    throw new Error('TONCENTER_API_KEY environment variable is not set');
  }
  console.log('✅ Environment configuration verified');

  // ──────────────────── LOAD WALLET DATA ──────────────────────
  const { contract, owner, users } = load();
  console.log('✦ Loaded wallet data:');
  console.log(`  - Contract: ${contract}`);
  console.log(`  - Owner: ${owner.address}`);
  console.log(`  - Users: ${users.length} records`);

  // ─────────────────── USER SELECTION UI ──────────────────────
  console.log('\n═════════════════════ USER SELECTION ═════════════════════');
  let userFilter: number[] = [];
  const input = await prompt('✦ Enter user IDs (comma separated) or press Enter for all: ');
  
  if (input) {
    const ids = input.split(',');
    for (const id of ids) {
      const parsedId = parseInt(id.trim(), 10);
      if (!isNaN(parsedId)) {
        userFilter.push(parsedId);
      }
    }
    console.log(`✦ Selected IDs: ${userFilter.join(', ')}`);
  } else {
    console.log('✦ No filter applied - selecting all users');
  }

  const targetUsers = users.filter(user => {
    try {
      Address.parse(user.address);
      return userFilter.length === 0 || userFilter.includes(user.id);
    } catch {
      console.warn(`⚠️ Skipping user #${user.id} - invalid address: ${user.address}`);
      return false;
    }
  });

  if (userFilter.length > 0 && targetUsers.length === 0) {
    console.log(`\n⚠️ No users found with IDs: ${userFilter.join(', ')}`);
    console.log('ℹ️ Available user IDs:', users.map(u => u.id).join(', '));
    return;
  }
  console.log(`✦ Selected users: ${targetUsers.length}`);

  // ──────────────── DATABASE CONNECTION ──────────────────────
  console.log('\n════════════════════ DATABASE CONNECTION ═══════════════════');
  if (!AppDataSource.isInitialized) {
    try {
      await AppDataSource.initialize();
      console.log('✅ Database connected');
      const tableExists = await AppDataSource.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')`
      );
      
      if (!tableExists[0]?.exists) {
        console.log('✦ Creating users table...');
        await AppDataSource.synchronize();
        console.log('✅ Users table created');
      }
    } catch (error) {
      console.error('❌ Database connection failed:');
      console.error('✦ Error details:', error);
      throw error;
    }
  } else {
    console.log('✓ Using existing database connection');
  }

  if (!contract || !owner.mnemonic) {
    console.error('❌ Invalid wallets.json structure');
    throw new Error('Invalid wallets.json');
  }

  // ─────────────────── WALLET SETUP ──────────────────────────
  console.log('\n═════════════════════ WALLET SETUP ═══════════════════════');
  const contractAddr = Address.parse(contract);
  const words = owner.mnemonic.split(' ');
  const { publicKey, secretKey } = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey });
  const wc = provider.open(wallet);
  const baseSender = wc.sender(secretKey);
  const walletBalance = await wc.getBalance();
  
  console.log('✦ Wallet details:');
  console.log(`  - Address: ${wallet.address.toString()}`);
  console.log(`  - Balance: ${fromNano(walletBalance)} TON`);
  
  if (walletBalance < toNano('1.5')) {
    const errMsg = `❌ Insufficient balance: ${fromNano(walletBalance)} TON, need at least 1.5 TON`;
    console.error(errMsg);
    throw new Error(errMsg);
  }

  // ────────────── CONTRACT CONFIGURATION ────────────────────
  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);
  const lastOpTime = Number(await opened.getLastOpTime());
  const delay = calculateDelay(lastOpTime);
  
  console.log('\n════════════════════ TIMING CONFIG ═══════════════════════');
  console.log('✦ Contract status:');
  console.log(`  - Last operation: ${new Date(lastOpTime * 1000).toISOString()}`);
  console.log(`  - Calculated delay: ${delay * 2} ms`);
  await new Promise(r => setTimeout(r, delay * 2));
  console.log('✅ Delay completed');

  // ──────────────── NETWORK CLIENT ──────────────────────────
  const client = new TonClient({
    endpoint: `https://testnet.toncenter.com/api/v2/jsonRPC`,
    apiKey: TONCENTER_API_KEY
  });
  const walletAddress = wallet.address;
  
  // ──────────────── USER PROCESSING LOOP ────────────────────
  console.log('\n═══════════════════ USER PROCESSING ═════════════════════');
  for (const [index, user] of targetUsers.entries()) {
    console.log(`\n─────── PROCESSING USER ${index + 1}/${targetUsers.length} ───────`);
    console.log(`✦ User #${user.id} | Address: ${user.address}`);
    
    const lastTx = await withRetry(async () => {
      return await client.getTransactions(walletAddress, { limit: 1 });
    }, 3, 3000);
    const minLt = lastTx.length > 0 ? lastTx[0].lt : 0n;
    
    const userAddr = Address.parse(user.address);
    let opIdUsed = generateOpId();
    let txHash: string | null = null;
    
    console.log('✦ Operation details:');
    console.log(`  - OP ID: ${opIdUsed.toString()}`);
    console.log(`  - Parsed address: ${userAddr.toString()}`);
    console.log(`  - Workchain: ${userAddr.workChain}`);
    console.log(`  - Hash: ${userAddr.hash.toString('hex')}`);

    // ─────────────── TRANSACTION EXECUTION ───────────────────
    try {
      console.log('\n✦ Sending addXP transaction...');
      
      await withRetry(async () => {
        await opened.sendAddXP(baseSender, {
          user: userAddr,
          amount: 1n,
          opId: opIdUsed
        });
      }, 3, 3000);
      
      console.log('✅ Transaction sent');
      
      txHash = await getTransactionHash(client, walletAddress, minLt);
      if (txHash) {
        console.log(`✅ Transaction confirmed: ${txHash}`);
      } else {
        console.warn('⚠️ Transaction confirmation not found');
      }
      
    } catch (error) {
      console.error('❌ Transaction failed:');
      console.error('✦ Error details:', error);
      continue;
    }

    // ─────────────── BALANCE VERIFICATION ────────────────────
    console.log('\n✦ Verifying balance update...');
    await new Promise(r => setTimeout(r, 10000));
    
    let xpBalance = 0n;
    let updated = false;
    
    for (let i = 0; i < 15; i++) {
      try {
        console.log(`  - Check ${i + 1}/15...`);
        xpBalance = await opened.getXP(userAddr);
        
        if (xpBalance > 0n) {
          console.log(`✅ Balance updated: ${xpBalance} XP`);
          updated = true;
          break;
        }
        
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.warn('⚠️ Balance check error:', e);
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    // ─────────────── RETRY MECHANISM ────────────────────────
    if (!updated) {
      console.error('❌ Initial balance update failed');
      console.log('✦ Initiating retry with higher gas...');
      
      try {
        const retryOpId = generateOpId();
        opIdUsed = retryOpId;
        const highGasSender = createHighGasSender(baseSender, toNano('0.1'));
        
        await opened.sendAddXP(highGasSender, {
          user: userAddr,
          amount: 1n,
          opId: retryOpId
        });
        
        console.log('✅ Retry transaction sent (higher gas)');
        
        txHash = await getTransactionHash(client, walletAddress, minLt);
        if (txHash) {
          console.log(`✅ Retry transaction confirmed: ${txHash}`);
        }
        
        await new Promise(r => setTimeout(r, 15000));
        
        for (let i = 0; i < 10; i++) {
          try {
            xpBalance = await opened.getXP(userAddr);
            if (xpBalance > 0n) {
              console.log(`✅ Balance updated after retry: ${xpBalance} XP`);
              updated = true;
              break;
            }
            await new Promise(r => setTimeout(r, 5000));
          } catch (e) {
            console.warn('⚠️ Retry balance error:', e);
          }
        }
      } catch (error) {
        console.error('❌ Retry transaction failed:');
        console.error('✦ Error details:', error);
      }
    }

  // ─────────────── DATABASE UPDATE ────────────────────────
  if (updated) {
    console.log('✦ Final balance:', xpBalance.toString());
    console.log('✦ Updating database records...');
    try {
      const userRepo = AppDataSource.getRepository(User);
      const transactionRepo = AppDataSource.getRepository(DBTransaction); 
          
      let dbUser = await userRepo.findOne({ 
          where: { address: userAddr.toString() },
          relations: ['transactions'] 
      });
      
      if (!dbUser) {
        dbUser = new User();
        dbUser.address = userAddr.toString();
        dbUser.xp = Number(xpBalance);
        console.log('✓ Created new user record');
      } else {
        dbUser.xp = Number(xpBalance);
        console.log('✓ Updated existing user record');
      }
      
      await userRepo.save(dbUser);
      
      const contractAddress = contractAddr.toString();
      const contractOwner = await opened.getOwner();
      const contractVersion = (await opened.getVersion()).toString();
      const lastOpTime = new Date(Number(await opened.getLastOpTime()) * 1000);
      
      const transaction = new DBTransaction();
      transaction.opId = opIdUsed.toString();
      transaction.txHash = txHash; 
      transaction.amount = 1;
      transaction.timestamp = new Date();
      transaction.senderAddress = wallet.address.toString(); 
      transaction.receiverAddress = userAddr.toString(); 
      transaction.status = updated ? "success" : "failed";
      transaction.description = `XP added for user #${user.id}`;
      transaction.contractAddress = contractAddress;
      transaction.contractOwner = contractOwner.toString();
      transaction.contractVersion = contractVersion;
      transaction.lastOpTime = lastOpTime;

        await transactionRepo.save(transaction);
        console.log('✅ Transaction details saved');

      } catch (dbError) {
        console.error('❌ Database update failed:');
        console.error('✦ Error details:', dbError);
      }
    } else {
      console.error('❌ Balance update failed after retry');
      console.log('✦ Additional diagnostics:');
      console.log(`  - User address: ${userAddr.toString()}`);
      console.log(`  - OP ID: ${opIdUsed.toString()}`);
    }
    
    // ─────────────── HISTORY VERIFICATION ────────────────────
    try {
      console.log('\n✦ Verifying user history...');
      const history = await opened.getUserHistory(userAddr);
      
      if (history) {
        console.log('✅ History record exists');
        console.log(`  - Cell hash: ${history.hash().toString('hex')}`);
      } else {
        console.warn('⚠️ No history record found');
      }
    } catch (e) {
      console.warn('⚠️ History verification failed:', e);
    }
  }

  // ──────────────── CLEANUP PHASE ───────────────────────────
  console.log('\n═════════════════════ CLEANUP ════════════════════════');
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('✅ Database connection closed');
  }
  
  console.log('\n═════════════════════ COMPLETION ═════════════════════');
  console.log('✦ XP distribution process finished');
  console.log(`✦ Processed ${targetUsers.length} users`);
  console.log('✦ Timestamp:', new Date().toISOString());
}
// ══════════════════════ END ════════════════════