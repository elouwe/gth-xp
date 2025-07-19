import { NetworkProvider } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const contractAddress = Address.parse('EQ...'); // Ваш адрес контракта
    const userAddress = Address.parse('EQ...'); // Адрес пользователя
    
    const contract = provider.open(XPContract.createFromAddress(contractAddress));
    await contract.sendAddXP(provider.sender(), {
        user: userAddress,
        amount: 100n
    });
    console.log('XP added successfully!');
}