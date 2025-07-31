// scripts/add-xp.ts
import { Address, toNano, fromNano, Cell } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XPContract } from '../wrappers/XPContract';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { randomBytes } from 'crypto';

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
      console.warn(`Attempt ${i + 1} failed: ${error}`);
      if (i === retries - 1) throw error;
      console.log(`Retrying in ${delayMs}ms`);
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
  const buffer = randomBytes(32);
  return BigInt('0x' + buffer.toString('hex'));
}

export async function run(provider: NetworkProvider) {
  const { contract, owner, users } = load();
  if (!contract || !owner.mnemonic) {
    throw new Error('Invalid wallets.json');
  }

  const contractAddr = Address.parse(contract);
  const words = owner.mnemonic.split(' ');
  const { publicKey, secretKey } = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey });
  const wc = provider.open(wallet);
  const sender = wc.sender(secretKey);
  const walletBalance = await wc.getBalance();
  
  console.log('\n═════════ WALLET ═════════');
  console.log('✦ Balance:', fromNano(walletBalance), 'TON');
  
  if (walletBalance < toNano('1.5')) {
    throw new Error(
      `Insufficient balance: ${fromNano(walletBalance)} TON, need at least 1.5 TON`
    );
  }

  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);
  const lastOpTime = Number(await opened.getLastOpTime());
  const delay = calculateDelay(lastOpTime);
  
  console.log('\n═════════ DELAY ═════════');
  console.log('✦ Last operation:', lastOpTime);
  console.log('✦ Calculated delay:', delay * 2, 'ms');
  await new Promise(r => setTimeout(r, delay * 2));

  const targetUsers = users.filter(user => {
    try {
      Address.parse(user.address);
      return true;
    } catch {
      console.warn('⚠️ Skipping user #' + user.id + ' - invalid address:', user.address);
      return false;
    }
  });

  console.log('\n═════════ USERS ═════════');
  console.log('✦ Valid users:', targetUsers.length);
  
  try {
    const contractState = await provider.provider(contractAddr).getState();
    console.log('✦ Contract balance:', fromNano(contractState.balance), 'TON');
  } catch (e) {
    console.warn('⚠️ Failed to get contract balance:', e);
  }
  
  for (const user of targetUsers) {
    console.log('\n═════════ USER #' + user.id + ' ═════════');
    console.log('✦ Address:', user.address);
    
    const userAddr = Address.parse(user.address);
    const opId = generateOpId();
    
    console.log('\n✦ OP ID:', opId.toString());
    console.log('✦ Address details:');
    console.log('  - Parsed:', userAddr.toString());
    console.log('  - Workchain:', userAddr.workChain);
    console.log('  - Hash:', userAddr.hash.toString('hex'));

    try {
      console.log('\n✦ Sending addXP transaction...');
      
      const messageBody = xp.getAddXPMessageBody({
        user: userAddr,
        amount: 1n,
        opId
      });
      console.log('✦ Message body:', messageBody.toBoc().toString('hex'));
      
      await withRetry(async () => {
        await opened.sendAddXP(sender, {
          user: userAddr,
          amount: 1n,
          opId
        });
      }, 3, 3000);
      
      console.log('✅ Transaction sent');
    } catch (error) {
      console.error('❌ TX failed:', error);
      continue;
    }

    console.log('\n✦ Waiting 10s for state update...');
    await new Promise(r => setTimeout(r, 10000));
    
    let xpBalance = 0n;
    let updated = false;
    
    for (let i = 0; i < 15; i++) {
      try {
        console.log('✦ Checking balance (' + (i + 1) + '/15)...');
        xpBalance = await opened.getXP(userAddr);
        
        if (xpBalance > 0n) {
          console.log('✅ Balance updated:', xpBalance);
          updated = true;
          break;
        }
        
        console.log('✦ Balance still 0, retrying in 5s...');
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.warn('⚠️ Balance check error:', e);
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    if (!updated) {
      console.error('❌ Balance update failed');
      console.log('✦ Retrying with higher gas...');
      
      try {
        const retryOpId = generateOpId();
        await opened.sendAddXP(sender, {
          user: userAddr,
          amount: 1n,
          opId: retryOpId
        });
        
        console.log('✅ Retry TX sent');
        console.log('✦ Waiting 15s...');
        await new Promise(r => setTimeout(r, 15000));
        
        for (let i = 0; i < 10; i++) {
          try {
            xpBalance = await opened.getXP(userAddr);
            if (xpBalance > 0n) {
              console.log('✅ Balance updated after retry:', xpBalance);
              updated = true;
              break;
            }
            await new Promise(r => setTimeout(r, 5000));
          } catch (e) {
            console.warn('⚠️ Retry balance error:', e);
          }
        }
      } catch (error) {
        console.error('❌ Retry TX failed:', error);
      }
    }

    if (!updated) {
      console.error('❌ Balance update failed after retry');
      console.log('✦ Additional checks:');
      console.log('  - User address:', userAddr.toString());
      console.log('  - OP ID:', opId.toString());
    } else {
      console.log('✦ Final balance:', xpBalance.toString());
    }
    
    try {
      console.log('\n✦ Checking user history...');
      const history = await opened.getUserHistory(userAddr);
      if (history) {
        console.log('✅ History exists');
        console.log('✦ Cell hash:', history.hash().toString('hex'));
      } else {
        console.warn('⚠️ No history found');
      }
    } catch (e) {
      console.warn('⚠️ History check failed:', e);
    }
  }
}