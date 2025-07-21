import { NetworkProvider } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { Address } from '@ton/core';
import wallets from '../wallets.json';

export async function run(provider: NetworkProvider) {
    const contractAddress = Address.parse((wallets as any).contract);
    const userAddress = Address.parse(wallets.user.address);
    
    const contract = provider.open(XPContract.createFromAddress(contractAddress));
    const xp = await contract.getXP(userAddress);
    console.log(`User ${userAddress.toString()} has ${xp} XP`);
}