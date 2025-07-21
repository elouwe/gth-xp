import { NetworkProvider } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { Address, toNano } from '@ton/core';
import { WalletContractV4 } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import wallets from '../wallets.json';

export async function run(provider: NetworkProvider) {
    const contractAddress = Address.parse((wallets as any).contract);
    const userAddress = Address.parse(wallets.user.address);
    const ownerMnemonic = wallets.owner.mnemonic.split(' ');

    const keyPair = await mnemonicToPrivateKey(ownerMnemonic);
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });

    const contract = provider.open(XPContract.createFromAddress(contractAddress));
    const walletContract = provider.open(wallet);
    const sender = walletContract.sender(keyPair.secretKey);

    await contract.sendAddXP(sender, {
        user: userAddress,
        amount: 100n
    });
    console.log('XP added successfully!');
}