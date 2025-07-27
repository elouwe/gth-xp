// scripts/check-balance.ts
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

function loadWallets(): Wallets {
  const raw = readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8');
  return JSON.parse(raw) as Wallets;
}

export async function run(provider: NetworkProvider) {
  const wallets = loadWallets();

  if (!wallets.contract) throw new Error('wallets.json: "contract" field empty 🫠');
  if (!wallets.owner?.address) throw new Error('wallets.json: "owner.address" field empty 🫠');

  const contractAddress = Address.parse(wallets.contract);
  const ownerAddress = Address.parse(wallets.owner.address);

  const getBalance = async (addr: Address): Promise<bigint> => {
    const api = provider.api() as any;

    if (typeof api.getBalance === 'function') {
      return BigInt(await api.getBalance(addr));
    }
    if (typeof api.getAccount === 'function') {
      const { last } = await api.getLastBlock();
      const { account } = await api.getAccount(last.seqno, addr);
      return BigInt(account.balance.coins);
    }
    throw new Error('Unsupported client: Cannot fetch balance 😭');
  };

  const [contractBal, ownerBal] = await Promise.all([
    getBalance(contractAddress),
    getBalance(ownerAddress)
  ]);

  console.log(`Contract balance: ${fromNano(contractBal)} TON`);
  console.log(`Owner balance   : ${fromNano(ownerBal)} TON`);
}