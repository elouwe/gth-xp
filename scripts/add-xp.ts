import { Address, toNano, fromNano } from '@ton/core';
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
  users: { address: string; mnemonic: string }[];
}

function load(): Wallets {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8'));
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
      console.warn(`Attempt ${i+1} failed: ${error}`);
      if (i === retries - 1) throw error;
      console.log(`Retrying in ${delayMs}ms...`);
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
  if (!contract || !owner.mnemonic) throw new Error('Invalid wallets.json');

  const contractAddr = Address.parse(contract);
  
  const words = owner.mnemonic.split(' ');
  const { publicKey, secretKey } = await mnemonicToPrivateKey(words);

  const wallet = WalletContractV4.create({ workchain: 0, publicKey });
  const wc = provider.open(wallet);
  const sender = wc.sender(secretKey);

  const walletBalance = await wc.getBalance();
  if (walletBalance < toNano('0.3')) {
    throw new Error(`Insufficient balance: ${fromNano(walletBalance)} TON, need at least 0.3 TON`);
  }

  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);

  const lastOpTime = Number(await opened.getLastOpTime());
  const delay = calculateDelay(lastOpTime);
  
  console.log(`⏳ Last operation: ${lastOpTime}, waiting ${delay}ms...`);
  await new Promise(r => setTimeout(r, delay));

  // Добавляем XP всем пользователям
  for (const user of users) {
    const userAddr = Address.parse(user.address);
    const opId = generateOpId();
    console.log(`🔑 Generated OP ID for ${user.address}: ${opId.toString()}`);

    console.log(`🔨 Sending addXP to ${user.address}...`);
    await withRetry(async () => {
      await opened.sendAddXP(sender, { 
        user: userAddr, 
        amount: 1n,
        opId
      });
    }, 3, 3000);

    console.log(`✅ TX sent for ${user.address}, waiting for confirmation...`);
    await new Promise(r => setTimeout(r, 10000));
    
    let xpBalance = 0n;
    for (let i = 0; i < 5; i++) {
      xpBalance = await opened.getXP(userAddr);
      if (xpBalance > 0n) {
        console.log(`✅ Balance for ${user.address} updated: ${xpBalance}`);
        break;
      }
      console.log(`⏳ Balance for ${user.address} not updated yet, retrying in 5s... (${i+1}/5)`);
      await new Promise(r => setTimeout(r, 5000));
    }

    console.log(`🎯 Final balance for ${user.address}: ${xpBalance.toString()}`);
  }
}