// scripts/add-xp.ts

import { NetworkProvider } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { Address, toNano } from '@ton/core';
import { WalletContractV4 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import wallets from '../wallets.json';

export async function run(provider: NetworkProvider) {
    const contractAddress = Address.parse(wallets.contract);
    const userAddress = Address.parse(wallets.user.address);
    const ownerMnemonic = wallets.owner.mnemonic.split(' ');

    console.log('Contract address:', contractAddress.toString());
    console.log('User address:', userAddress.toString());
    console.log('Owner mnemonic:', ownerMnemonic.slice(0, 3).join(' ') + '...');

    const keyPair = await mnemonicToPrivateKey(ownerMnemonic);
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });

    const contract = provider.open(XPContract.createFromAddress(contractAddress));
    const walletContract = provider.open(wallet);
    const sender = walletContract.sender(keyPair.secretKey);

    try {
        console.log('Sending add XP transaction...');
        await contract.sendAddXP(sender, {
            user: userAddress,
            amount: 1n 
        });
        console.log('1 XP added successfully!');
    } catch (error) {
        console.error('❌ Error adding XP:', error);
    }
}