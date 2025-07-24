import { Address, fromNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Wallets {
  contract: string;
  owner: {
    address: string;
  };
}

// Load wallet data from JSON file
function loadWallets(): Wallets {
  const raw = readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8');
  return JSON.parse(raw) as Wallets;
}

export async function run(provider: NetworkProvider) {
  const wallets = loadWallets();

  // Validate wallet data
  if (!wallets.contract) throw new Error('wallets.json: "contract" field empty 🫠');
  if (!wallets.owner?.address) throw new Error('wallets.json: "owner.address" field empty 🫠');

  const contractAddress = Address.parse(wallets.contract);
  const ownerAddress = Address.parse(wallets.owner.address);

  // Unified balance fetcher for different providers
  const getBalance = async (addr: Address): Promise<bigint> => {
    const api = provider.api() as any;

    // Handle TonCenter (v2) API
    if (typeof api.getBalance === 'function') {
      return BigInt(await api.getBalance(addr));
    }
    // Handle TonClient4/LiteClient API
    if (typeof api.getAccount === 'function') {
      const { last } = await api.getLastBlock();
      const { account } = await api.getAccount(last.seqno, addr);
      return BigInt(account.balance.coins);
    }
    throw new Error('Unsupported client: Cannot fetch balance 😭');
  };

  // Fetch both balances in parallel
  const [contractBal, ownerBal] = await Promise.all([
    getBalance(contractAddress),
    getBalance(ownerAddress)
  ]);

  // Display formatted balances
  console.log(`Contract balance: ${fromNano(contractBal)} TON`);
  console.log(`Owner balance   : ${fromNano(ownerBal)} TON`);
}