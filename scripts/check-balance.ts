import { Address, beginCell, Cell, fromNano } from '@ton/core';
import { Contract, ContractProvider, TonClient, WalletContractV4 } from '@ton/ton';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import inquirer from 'inquirer';
import { mnemonicToWalletKey } from '@ton/crypto';

interface User {
  id: number;
  address: string;
  addressNonBounce: string;
  publicKey: string;
  mnemonic: string;
}

interface Wallets {
  contract: string;
  owner: {
    address: string;
    mnemonic: string;
  };
  users?: User[];
  nextUserId?: number;
}

function loadWallets(): Wallets {
  const raw = readFileSync(
    resolve(process.cwd(), 'wallets.json'), 
    'utf8'
  );
  return JSON.parse(raw) as Wallets;
}

async function getTonBalance(client: TonClient, addr: Address): Promise<string> {
  const balance = await client.getBalance(addr);
  return fromNano(balance);
}

class XPContract implements Contract {
  constructor(readonly address: Address) {}
  
  async getXP(provider: ContractProvider, userAddress: Address): Promise<bigint> {
    const args = beginCell()
      .storeAddress(userAddress)
      .endCell();
    
    try {
      const result = await provider.get('get_xp', [{ type: 'slice', cell: args }]);
      
      if (!result.stack.remaining) {
        return 0n;
      }
      
      return result.stack.readBigNumber();
    } catch (e) {
      console.error('Error in getXP:', e);
      return 0n;
    }
  }
}

async function getXpBalance(client: TonClient, contractAddress: Address, userAddress: Address): Promise<string> {
  const contract = new XPContract(contractAddress);
  const provider = client.provider(contractAddress);
  
  try {
    const balance = await contract.getXP(provider, userAddress);
    return balance.toString();
  } catch (e) {
    console.error('Error fetching XP balance:', e);
    return 'Error';
  }
}

async function main() {
  const wallets = loadWallets();
  const testnet = process.argv.includes('--testnet');

  // Создаем TonClient
  const client = new TonClient({
    endpoint: testnet 
      ? 'https://testnet.toncenter.com/api/v2/jsonRPC' 
      : 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: testnet 
      ? '8cf308a3ba1d15eb11875c9c2e48d87cc381d97cb4a30a7288cb19e79f51ce5d'
      : 'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d'
  });

  if (!wallets.contract) throw new Error('wallets.json: "contract" field empty');
  if (!wallets.owner?.address) throw new Error('wallets.json: "owner.address" field empty');
  if (!wallets.owner?.mnemonic) throw new Error('wallets.json: "owner.mnemonic" field empty');

  // Преобразуем мнемонику в ключ
  const key = await mnemonicToWalletKey(wallets.owner.mnemonic.split(' '));
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: key.publicKey
  });
  
  console.log(`\n🔐 Using wallet: ${wallets.owner.address}`);
  console.log(`🌐 Network: ${testnet ? 'Testnet' : 'Mainnet'}`);

  const choices = [
    { name: 'Contract & Owner TON balances', value: 'default' },
    { name: 'Contract XP balance', value: 'contract-xp' },
    { name: 'Owner XP balance', value: 'owner-xp' }
  ];
  
  if (wallets.users && wallets.users.length > 0) {
    choices.push(
      { name: 'User TON balance by ID', value: 'user-ton' },
      { name: 'User XP balance by ID', value: 'user-xp' }
    );
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What do you want to check?',
    choices
  }]);

  console.log('\n═════════ CONFIG ═════════');
  console.log(`✦ Contract: ${wallets.contract}`);
  
  const contractAddress = Address.parse(wallets.contract);
  
  if (action === 'default') {
    const ownerAddress = Address.parse(wallets.owner.address);
    
    console.log('✦ Owner address:', wallets.owner.address);

    const [contractBal, ownerBal] = await Promise.all([
      getTonBalance(client, contractAddress),
      getTonBalance(client, ownerAddress)
    ]);

    console.log('\n═════════ BALANCES (TON) ═════════');
    console.log('✦ Contract TON balance:', contractBal, 'TON');
    console.log('✦ Owner TON balance:', ownerBal, 'TON');
  
  } else if (action === 'contract-xp') {
    const contractBal = await getXpBalance(client, contractAddress, contractAddress);
    console.log('\n═════════ BALANCES (XP) ═════════');
    console.log('✦ Contract XP balance:', contractBal, 'XP');
  
  } else if (action === 'owner-xp') {
    const ownerAddress = Address.parse(wallets.owner.address);
    const ownerBal = await getXpBalance(client, contractAddress, ownerAddress);
    console.log('\n═════════ BALANCES (XP) ═════════');
    console.log('✦ Owner XP balance:', ownerBal, 'XP');
  
  } else if (action === 'user-ton' || action === 'user-xp') {
    if (!wallets.users || wallets.users.length === 0) {
      throw new Error('No users found in wallets.json');
    }

    const { userId } = await inquirer.prompt([{
      type: 'number',
      name: 'userId',
      message: 'Enter user ID:',
      validate: (input: number) => {
        return !!wallets.users?.find(u => u.id === input) || 'Invalid user ID';
      }
    }]);

    const user = wallets.users.find(u => u.id === userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const userAddress = Address.parse(user.address);
    console.log(`✦ Selected user (ID: ${user.id}): ${user.address}`);
    
    if (action === 'user-ton') {
      const tonBal = await getTonBalance(client, userAddress);
      console.log('\n═════════ BALANCES (TON) ═════════');
      console.log(`✦ User TON balance:`, tonBal, 'TON');
    } else {
      const xpBal = await getXpBalance(client, contractAddress, userAddress);
      console.log('\n═════════ BALANCES (XP) ═════════');
      console.log(`✦ User XP balance:`, xpBal, 'XP');
    }
  }

  console.log('\n════════════════════════════');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});