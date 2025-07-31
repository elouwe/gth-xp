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
  console.log('\n═════════ CONTRACT UPGRADE ═════════');
  
  // Load configuration
  console.log('✦ Loading wallet configuration...');
  const wallets = loadWallets();
  
  if (!wallets.contract) {
    throw new Error('❌ Contract address missing in wallets.json');
  }
  
  const contractAddr = Address.parse(wallets.contract);
  console.log('✅ Configuration loaded');
  console.log('✦ Contract address:', wallets.contract);

  // Compile new contract version
  console.log('\n═════════ COMPILATION ═════════');
  console.log('✦ Compiling new contract version...');
  const code = await compile('xp');
  console.log('✅ Contract compiled successfully');

  // Connect to contract
  console.log('\n═════════ CONTRACT CONNECTION ═════════');
  const xp = XPContract.createFromAddress(contractAddr);
  const opened = provider.open(xp);
  console.log('✦ Connected to XP contract');

  // Check current version
  console.log('\n═════════ VERSION CHECK ═════════');
  const currentVersion = await opened.getVersion();
  console.log(`✦ Current contract version: v${currentVersion}`);
  
  // Send upgrade transaction
  console.log('\n═════════ UPGRADE TRANSACTION ═════════');
  console.log('✦ Sending upgrade transaction...');
  
  try {
    await opened.sendUpgrade(provider.sender(), { newCode: code });
    console.log('✅ Upgrade transaction sent successfully');
  } catch (error) {
    console.error('❌ Upgrade transaction failed:', error);
    throw error;
  }

  // Wait for upgrade confirmation
  console.log('\n═════════ CONFIRMATION ═════════');
  console.log('⏳ Waiting for upgrade confirmation (30 seconds)...');
  
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Verify new version
  console.log('\n═════════ VERIFICATION ═════════');
  console.log('✦ Checking new contract version...');
  
  try {
    const newVersion = await opened.getVersion();
    
    if (newVersion > currentVersion) {
      console.log(`✅ Upgrade successful! New version: v${newVersion}`);
    } else if (newVersion === currentVersion) {
      console.log('⚠️ Version unchanged after upgrade');
      console.log('✦ Possible reasons:');
      console.log('  - Upgrade transaction not yet processed');
      console.log('  - Identical code was deployed');
      console.log('✦ Current version remains:', `v${currentVersion}`);
    } else {
      console.error('❌ Version number decreased after upgrade');
      console.log(`✦ Previous version: v${currentVersion}`);
      console.log(`✦ Current version: v${newVersion}`);
    }
  } catch (error) {
    console.error('❌ Failed to verify new version:', error);
    console.log('✦ Possible reasons:');
    console.log('  - Contract not responding');
    console.log('  - Upgrade transaction failed');
  }
  
  console.log('\n════════════════════════════════════');
}