import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { XPContract } from '../wrappers/XPContract';

interface WalletUser {
    id: number;
    address: string;
    addressNonBounce?: string;
    publicKey: string;
    mnemonic: string;
}

interface Wallets {
    contract: string;
    owner: { 
        address: string;
        addressNonBounce: string;
        publicKey: string;
        mnemonic: string;
    };
    user: {
        address: string;
        addressNonBounce: string;
        publicKey: string;
        mnemonic: string;
    };
    users: WalletUser[];
    nextUserId: number;
}

function loadWallets(): Wallets {
    return JSON.parse(
        readFileSync(resolve(process.cwd(), 'wallets.json'), 'utf8')
    );
}

export async function run(provider: NetworkProvider, args: string[]) {
    const wallets = loadWallets();
    const { contract, users } = wallets;
    
    if (!contract) throw new Error('wallets.json: contract not set');

    // Парсинг аргументов командной строки
    const requestedIds = args
        .filter(arg => !isNaN(parseInt(arg)))
        .map(id => parseInt(id));

    // Фильтрация пользователей
    const filteredUsers = requestedIds.length > 0
        ? users.filter(user => requestedIds.includes(user.id))
        : users;

    if (filteredUsers.length === 0) {
        console.log('ℹ No users found matching the specified IDs');
        return;
    }

    const contractAddr = Address.parse(contract);
    const xp = XPContract.createFromAddress(contractAddr);
    const opened = provider.open(xp);

    console.log('\n═══════ CONTRACT INFO ═══════');
    console.log('✦ Contract:', contract);
    console.log('✦ Owner:', (await opened.getOwner()).toString());
    console.log('✦ Version:', (await opened.getVersion()).toString());
    console.log('✦ Last Op:', (await opened.getLastOpTime()).toString());
    
    console.log('\n═════════ USER XP ═════════');
    for (const user of filteredUsers) {
        const userAddr = Address.parse(user.address);
        const xpKey = (await opened.getXPKey(userAddr)).toString();
        const balance = (await opened.getXP(userAddr)).toString();

        console.log('\n✦ User ID:', user.id);
        console.log('Address:', user.address);
        console.log('XP Key:', xpKey);
        console.log('Balance:', balance);
    }
    console.log('\n══════════════════════════');
}