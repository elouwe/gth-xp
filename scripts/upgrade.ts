// scripts/upgrade.ts
import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Wallets {
  contract: string;
}

function loadWallets(): Wallets {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8')
  );
}

export async function run(provider: NetworkProvider) {
  const wallets = loadWallets();
  if (!wallets.contract) {
    throw new Error('Contract address missing in wallets.json');
  }
  
  const contractAddr = Address.parse(wallets.contract);
  const code = await compile('xp');
  
  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);
  
  const currentVersion = await opened.getVersion();
  console.log(`ℹ️ Current contract version: v${currentVersion}`);
  
  console.log('⬆️ Sending upgrade transaction...');
  await opened.sendUpgrade(provider.sender(), { newCode: code });
  console.log('✅ Upgrade transaction sent');
  
  console.log('⏳ Waiting for upgrade confirmation (30 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  const newVersion = await opened.getVersion();
  console.log(`✅ Upgrade successful! New version: v${newVersion}`);
}