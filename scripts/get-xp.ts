// scripts/get-xp.ts
import { XPContract } from '../wrappers/XPContract';
import { NetworkProvider } from '@ton/blueprint';
import { Address, beginCell } from '@ton/core';
import { WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import wallets from '../wallets.json';

export async function run(provider: NetworkProvider) {
  // Validate owner mnemonic exists
  const ownerMnemonic = wallets.owner?.mnemonic;
  if (!ownerMnemonic) {
    throw new Error('❌ owner.mnemonic missing in wallets.json');
  }
  
  // Derive keys from mnemonic
  const keyPair = await mnemonicToWalletKey(ownerMnemonic.split(' '));

  // Create wallet contract (v4)
  const wallet = WalletContractV4.create({ 
    workchain: 0, 
    publicKey: keyPair.publicKey 
  });
  
  // Prepare sender for contract interactions
  const walletContract = provider.open(wallet);
  const sender = walletContract.sender(keyPair.secretKey);

  // Load contract address
  const contractAddress = Address.parse(wallets.contract);
  console.log('🔎 Contract address:', contractAddress.toString());
  
  // Open XP contract instance
  const xpContract = XPContract.createFromAddress(contractAddress);
  const opened = provider.open(xpContract);

  // Resolve user address (priority: ENV > non-bounceable > any)
  const rawUser = process.env.USER_ADDR 
      || wallets.user?.addressNonBounce 
      || wallets.user?.address;

  if (!rawUser) {
    throw new Error('❌ User address not found');
  }

  const userAddress = Address.parse(rawUser);
  console.log('👤 User address:', userAddress.toString({ urlSafe: true }));

  // Verify contract owner and version
  const [ownerAddr, version] = await Promise.all([
    opened.getOwner(),
    opened.getVersion()
  ]);
  
  console.log('🔐 Contract owner:', ownerAddr.toString());
  console.log('ℹ️ Contract version:', version.toString());

  // Build arguments cell for debug
  const argsCell = beginCell()
    .storeAddress(userAddress)
    .endCell();
    
  console.log('📦 Argument cell (boc64):', argsCell.toBoc().toString('base64'));

  // Fetch XP balance
  try {
    const xp = await opened.getXP(userAddress);
    console.log('✅ User XP balance:', xp.toString());
  } catch (e) {
    console.error('❌ getXP call failed:', e);
    process.exit(1);
  }
}