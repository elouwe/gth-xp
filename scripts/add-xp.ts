// scripts/add-xp.ts
import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XPContract } from '../wrappers/XPContract';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

interface Wallets {
  contract: string;
  owner: { mnemonic: string; address: string };
  user: { address: string; addressNonBounce?: string };
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
  
  if (elapsed < 60) return 10000; // 10 seconds if last op < 1 min ago
  if (elapsed < 300) return 5000; // 5 seconds if last op < 5 min ago
  return 2000; // 2 seconds otherwise
}

export async function run(provider: NetworkProvider) {
  const { contract, owner, user } = load();
  if (!contract || !owner.mnemonic) throw new Error('Invalid wallets.json');

  const contractAddr = Address.parse(contract);
  const userAddr = Address.parse(user.address); // Use bounceable address

  const words = owner.mnemonic.split(' ');
  const { publicKey, secretKey } = await mnemonicToPrivateKey(words);

  const wallet = WalletContractV4.create({ workchain: 0, publicKey });
  const wc = provider.open(wallet);
  const sender = wc.sender(secretKey);

  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);

  // Get last operation time
  const lastOpTime = Number(await opened.getLastOpTime());
  const delay = calculateDelay(lastOpTime);
  
  console.log(`⏳ Last operation: ${lastOpTime}, waiting ${delay}ms...`);
  await new Promise(r => setTimeout(r, delay));

  console.log('🔨 Sending addXP...');
  await withRetry(async () => {
    await opened.sendAddXP(sender, { user: userAddr, amount: 1n });
  }, 3, 3000);

  console.log('✅ TX sent, waiting for confirmation...');
  
  // Wait 30 seconds for confirmation
  await new Promise(r => setTimeout(r, 30000));

  // Check balance with retries
  let balance = 0n;
  for (let i = 0; i < 5; i++) {
    balance = await opened.getXP(userAddr);
    if (balance > 0n) {
      console.log(`✅ Balance updated: ${balance}`);
      break;
    }
    console.log(`⏳ Balance not updated yet, retrying in 5s... (${i+1}/5)`);
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('🔑 Key after add:', (await opened.getXPKey(userAddr)).toString());
  console.log('🎯 Final balance:', balance.toString());
}