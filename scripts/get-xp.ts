// scripts/get-xp.ts
import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XPContract } from '../wrappers/XPContract';

interface Wallets {
  contract: string;
  owner: { address: string };
  user: { address: string; addressNonBounce?: string };
}

function loadWallets(): Wallets {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8')
  );
}

export async function run(provider: NetworkProvider) {
  const { contract, user } = loadWallets();
  if (!contract) throw new Error('wallets.json: contract не задан');

  const contractAddr = Address.parse(contract);
  const userAddr = Address.parse(user.address);

  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);

  console.log('🔑 XP Key:   ', (await opened.getXPKey(userAddr)).toString());
  console.log('🔐 Owner:    ', (await opened.getOwner()).toString());
  console.log('ℹ️ Version:  ', (await opened.getVersion()).toString());
  console.log('✅ Balance:  ', (await opened.getXP(userAddr)).toString());
  
  // Added last operation time
  console.log('⏰ Last Op:  ', (await opened.getLastOpTime()).toString());
}