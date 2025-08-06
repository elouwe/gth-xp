// scripts/add-xp.ts
// ===================== IMPORTS =====================
// ─────── Core libraries ───────
import { Address, toNano, fromNano, Sender, beginCell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { TonClient } from '@ton/ton';

// ─────── File system utilities ───────
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─────── Cryptography utilities ───────
import { randomBytes } from 'crypto';

// ─────── Database and ORM ───────
import { AppDataSource } from '../src/data-source';
import { User } from '../src/entities/User';
import { Transaction as DBTransaction } from '../src/entities/Transaction';

// ─────── Environment configuration ───────
import * as dotenv from 'dotenv';

// ─────── User interaction ───────
import * as readline from 'readline';

// ─────── Project-specific wrappers ───────
import { XPContract } from '../wrappers/XPContract';

// ===================== CONFIGURATION =====================
dotenv.config();

// ===================== INTERFACES =====================
// ─────── Wallet data structure ───────
interface Wallets {
  contract: string;
  owner: { mnemonic: string; address: string };
  users: { 
    id: number; 
    address: string; 
    addressNonBounce: string;
    mnemonic: string 
  }[];
}

// ===================== UTILITY FUNCTIONS =====================
// ─────── Configuration loader ───────
function load(): Wallets {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8')
  );
}

// ─────── Retry mechanism ───────
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

// ─────── Timing calculator ───────
function calculateDelay(lastOpTime: number): number {
  const now = Math.floor(Date.now() / 1000);
  if (lastOpTime === 0) return 0;
  
  const elapsed = now - lastOpTime;
  if (elapsed < 60) return 10000;
  if (elapsed < 300) return 5000;
  return 2000;
}

// ─────── Operation ID generator ───────
function generateOpId(): bigint {
  const buffer = randomBytes(16); 
  return BigInt('0x' + buffer.toString('hex'));
}

// ─────── Transaction confirmation ───────
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

// ─────── Contract transaction waiter ───────
async function waitForNewContractTx(client: TonClient, address: Address, minLt: bigint) {
  for (let i = 0; i < 12; i++) {
    const txs = await client.getTransactions(address, { limit: 5, inclusive: true });
    const newer = txs.find((t) => t.lt > minLt);
    if (newer) return newer as any;
    await new Promise(r => setTimeout(r, 2500));
  }
  return null;
}

// ─────── Gas booster ───────
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

// ─────── User prompt ───────
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

// ─────── Address hasher ───────
function addressHashHex(a: Address): string {
  return beginCell().storeAddress(a).endCell().hash().toString('hex');
}

// ===================== MAIN EXECUTION =====================
export async function run(provider: NetworkProvider) {
  // ─────── Initialization ───────
  console.log('\n═════════════════════ INITIALIZATION ═════════════════════');
  console.log('✦ Starting XP distribution process');
  console.log('✦ Current date:', new Date().toISOString());
  
  const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY;
  if (!TONCENTER_API_KEY) {
    console.error('❌ TONCENTER_API_KEY not set in environment');
    throw new Error('TONCENTER_API_KEY environment variable is not set');
  }
  console.log('✅ Environment configuration verified');

  const client = new TonClient({
    endpoint: `https://testnet.toncenter.com/api/v2/jsonRPC`,
    apiKey: TONCENTER_API_KEY
  });

  const { contract, owner, users } = load();
  console.log('✦ Loaded wallet data:');
  console.log(`  - Contract: ${contract}`);
  console.log(`  - Owner: ${owner.address}`);
  console.log(`  - Users: ${users.length} records`);

  // ─────── User selection ───────
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
      Address.parse(user.addressNonBounce);
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

  // ─────── Database connection ───────
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

  // ─────── Wallet setup ───────
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
  
  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);
  
  // ─────── Contract state check ───────
  console.log('\n════════════════════ CONTRACT STATE CHECK ════════════════════');
  const contractState = await client.getContractState(contractAddr);
  if (contractState.state !== 'active') {
      console.log(`⚠️ Contract is ${contractState.state}. Deploying...`);
      try {
          await opened.sendDeploy(baseSender);
          console.log('✅ Deploy transaction sent. Waiting for deployment...');
          await new Promise(r => setTimeout(r, 30000));
          
          console.log('✦ Initializing contract state...');
          await opened.sendInit(baseSender);
          console.log('✅ Initialization transaction sent');
          await new Promise(r => setTimeout(r, 15000));
          console.log('✓ Deployment and initialization completed');
      } catch (deployError) {
          console.error('❌ Contract deployment failed:', deployError);
          return;
      }
  } else {
      console.log('✅ Contract is active');
  }

  // ─────── Owner verification ───────
  console.log('\n════════════════════ OWNER CHECK ════════════════════════');
  const onchainOwner = await opened.getOwner();
  const ownerHash = addressHashHex(onchainOwner);
  const walletHash = addressHashHex(wallet.address);
  console.log(`✦ On-chain owner: ${onchainOwner.toString()}`);
  console.log(`✦ Wallet addr   : ${wallet.address.toString()}`);
  console.log(`✦ Hash equal?   : ${ownerHash === walletHash}`);
  if (ownerHash !== walletHash) {
    console.error('❌ Sender wallet is not the on-chain owner. Aborting to prevent wasted gas.');
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    return;
  }
  
  // ─────── Timing configuration ───────
  console.log('\n════════════════════ TIMING CONFIG ═══════════════════════');
  const lastOpTime = Number(await opened.getLastOpTime());
  const delay = calculateDelay(lastOpTime);
  console.log('✦ Contract status:');
  console.log(`  - Last operation: ${new Date(lastOpTime * 1000).toISOString()}`);
  console.log(`  - Calculated delay: ${delay * 2} ms`);
  await new Promise(r => setTimeout(r, delay * 2));
  console.log('✅ Delay completed');

  const walletAddress = wallet.address;
  
  // ─────── User processing loop ───────
  console.log('\n═══════════════════ USER PROCESSING ═════════════════════');
  for (const [index, user] of targetUsers.entries()) {
    // ─────── User initialization ───────
    console.log(`\n─────── PROCESSING USER ${index + 1}/${targetUsers.length} ───────`);
    console.log(`✦ User #${user.id} | Address: ${user.address}`);
    
    const lastWalletTx = await withRetry(async () => {
      return await client.getTransactions(walletAddress, { limit: 1 });
    }, 3, 3000);
    const minLtWallet = lastWalletTx.length > 0 ? lastWalletTx[0].lt : 0n;

    const lastContractTx = await withRetry(async () => {
      return await client.getTransactions(contractAddr, { limit: 1 });
    }, 3, 3000);
    const minLtContract = lastContractTx.length > 0 ? lastContractTx[0].lt : 0n;
    
    const userAddr = Address.parse(user.address);
    let opIdUsed = generateOpId();
    let txHash: string | null = null;
    
    // ─────── Transaction preparation ───────
    console.log('✦ Operation details:');
    console.log(`  - OP ID: ${opIdUsed.toString()}`);
    console.log(`  - Parsed address: ${userAddr.toString()}`);
    console.log(`  - Workchain: ${userAddr.workChain}`);
    console.log(`  - Hash: ${userAddr.hash.toString('hex')}`);

    let beforeXP = 0n;
    try {
      beforeXP = await opened.getXP(userAddr);
      console.log(`✦ XP before: ${beforeXP.toString()}`);
    } catch (e) {
      console.warn('⚠️ Could not fetch XP before send:', e);
      beforeXP = 0n;
    }

    // ─────── DATABASE: CREATE/UPDATE USER FIRST ───────
    let dbUser: User | null = null;
    try {
      const userRepo = AppDataSource.getRepository(User);
      dbUser = await userRepo.findOne({ 
        where: { address: userAddr.toString() }
      });
      
      if (!dbUser) {
        dbUser = new User();
        dbUser.address = userAddr.toString();
        dbUser.xp = Number(beforeXP);
        console.log('✓ Created new user record');
      } else {
        console.log('✓ Found existing user record');
      }
      
      await userRepo.save(dbUser);
      console.log('✅ User record saved');
    } catch (dbError) {
      console.error('❌ User save failed:');
      console.error('✦ Error details:', dbError);
      continue; 
    }

    // ─────── Transaction execution ───────
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
      
      txHash = await getTransactionHash(client, walletAddress, minLtWallet);
      if (txHash) {
        console.log(`✅ Wallet-side transaction confirmed: ${txHash}`);
      } else {
        console.warn('⚠️ Wallet-side transaction confirmation not found');
      }

      const newContractTx: any = await waitForNewContractTx(client, contractAddr, minLtContract);
      if (newContractTx) {
        const bounced =
          newContractTx.in_msg?.bounced ??
          newContractTx.inMessage?.bounced ??
          false;
        const exitCode =
          newContractTx.description?.compute?.exit_code ??
          newContractTx.description?.computePhase?.exitCode ??
          newContractTx.compute?.exit_code ??
          undefined;

        console.log('✦ Contract tx diagnostics:');
        console.log(`  - Bounced: ${Boolean(bounced)}`);
        console.log(`  - Compute exit code: ${exitCode !== undefined ? exitCode : 'n/a'}`);
      } else {
        console.warn('⚠️ No new contract transaction observed yet');
      }
      
    } catch (error) {
      console.error('❌ Transaction failed:');
      console.error('✦ Error details:', error);
      try {
        const transaction = new DBTransaction();
        transaction.opId = opIdUsed.toString();
        transaction.txHash = txHash || 'N/A';
        transaction.amount = 1;
        transaction.timestamp = new Date();
        transaction.senderAddress = wallet.address.toString(); 
        transaction.receiverAddress = userAddr.toString(); 
        transaction.status = "failed";
        transaction.description = `Failed XP add for user #${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        transaction.user = dbUser!;
        
        await AppDataSource.getRepository(DBTransaction).save(transaction);
        console.log('⚠️ Saved failed transaction record');
      } catch (txError) {
        console.error('❌ Failed to save failed transaction:', txError);
      }
      
      continue;
    }

    // ─────── Balance verification ───────
    console.log('\n✦ Verifying balance update...');
    await new Promise(r => setTimeout(r, 10000));
    
    let xpBalance = beforeXP;
    let updated = false;
    
    for (let i = 0; i < 15; i++) {
      try {
        console.log(`  - Check ${i + 1}/15...`);
        const current = await opened.getXP(userAddr);
        
        if (current > beforeXP) {
          xpBalance = current;
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

    // ─────── Retry mechanism ───────
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
        
        const retryWalletHash = await getTransactionHash(client, walletAddress, minLtWallet);
        if (retryWalletHash) {
          console.log(`✅ Retry (wallet) confirmed: ${retryWalletHash}`);
        }
        
        const retryContractTx: any = await waitForNewContractTx(client, contractAddr, minLtContract);
        if (retryContractTx) {
          const bounced =
            retryContractTx.in_msg?.bounced ??
            retryContractTx.inMessage?.bounced ??
            false;
          const exitCode =
            retryContractTx.description?.compute?.exit_code ??
            retryContractTx.description?.computePhase?.exitCode ??
            retryContractTx.compute?.exit_code ??
            undefined;

          console.log('✦ Retry contract diagnostics:');
          console.log(`  - Bounced: ${Boolean(bounced)}`);
          console.log(`  - Compute exit code: ${exitCode !== undefined ? exitCode : 'n/a'}`);
        }

        await new Promise(r => setTimeout(r, 15000));
        
        for (let i = 0; i < 10; i++) {
          try {
            const current = await opened.getXP(userAddr);
            if (current > beforeXP) {
              xpBalance = current;
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

    // ─────── Database: Update user XP and save transaction ───────
    if (updated && dbUser) {
      console.log('✦ Updating database records...');
      try {
        dbUser.xp = Number(xpBalance);
        await AppDataSource.getRepository(User).save(dbUser);
        console.log('✅ User XP updated');
        
        const transaction = new DBTransaction();
        transaction.opId = opIdUsed.toString();
        transaction.txHash = txHash; 
        transaction.amount = 1;
        transaction.timestamp = new Date();
        transaction.senderAddress = wallet.address.toString(); 
        transaction.receiverAddress = userAddr.toString(); 
        transaction.status = "success";
        transaction.description = `XP added for user #${user.id}`;
        
        transaction.contractAddress = contractAddr.toString();
        transaction.contractOwner = (await opened.getOwner()).toString();
        transaction.contractVersion = (await opened.getVersion()).toString();
        transaction.lastOpTime = new Date(Number(await opened.getLastOpTime()) * 1000);
        
        // Связываем транзакцию с пользователем
        transaction.user = dbUser;

        await AppDataSource.getRepository(DBTransaction).save(transaction);
        console.log('✅ Transaction details saved');

      } catch (dbError) {
        console.error('❌ Database update failed:');
        console.error('✦ Error details:', dbError);
      }
    } else if (!updated) {
      console.error('❌ Balance update failed after retry');
      
      try {
        if (dbUser) {
          const transaction = new DBTransaction();
          transaction.opId = opIdUsed.toString();
          transaction.txHash = txHash || 'N/A';
          transaction.amount = 1;
          transaction.timestamp = new Date();
          transaction.senderAddress = wallet.address.toString(); 
          transaction.receiverAddress = userAddr.toString(); 
          transaction.status = "failed";
          transaction.description = `XP add failed for user #${user.id}`;
          transaction.contractAddress = contractAddr.toString();
          transaction.user = dbUser;
          
          await AppDataSource.getRepository(DBTransaction).save(transaction);
          console.log('⚠️ Saved failed transaction record');
        }
      } catch (txError) {
        console.error('❌ Failed to save failed transaction:', txError);
      }
      
      console.log('✦ Additional diagnostics:');
      console.log(`  - User address: ${userAddr.toString()}`);
      console.log(`  - OP ID: ${opIdUsed.toString()}`);
      console.log(`  - Contract address: ${contractAddr.toString()}`);
      console.log(`  - Wallet balance: ${fromNano(await wc.getBalance())} TON`);
      
      try {
        console.log('✦ Checking contract state directly...');
        const state = await client.getContractState(contractAddr);
        console.log(`  - Contract state: ${state.state}`);
        console.log(`  - Last transaction LT: ${state.lastTransaction?.lt}`);
      } catch (e) {
        console.error('✦ State check failed:', e);
      }
    }

    // ─────── History verification ───────
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

  // ─────── Cleanup ───────
  console.log('\n═════════════════════ CLEANUP ════════════════════════');
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('✅ Database connection closed');
  }
  
  // ─────── Final report ───────
  console.log('\n═════════════════════ COMPLETION ═════════════════════');
  console.log('✦ XP distribution process finished');
  console.log(`✦ Processed ${targetUsers.length} users`);
  console.log('✦ Timestamp:', new Date().toISOString());
}
// ══════════════════════ END ════════════════════