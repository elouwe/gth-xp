import { NetworkProvider } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { Address } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const contractAddress = Address.parse('EQ...'); // Ваш адрес контракта
    const userAddress = Address.parse('EQ...'); // Адрес пользователя
    
    const contract = provider.open(XPContract.createFromAddress(contractAddress));
    const xp = await contract.getXP(userAddress);
    console.log(`User ${userAddress.toString()} has ${xp} XP`);
}