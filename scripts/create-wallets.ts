// scripts/create-wallets.ts
// ===================== IMPORTS =====================
// ─────── Core libraries ───────
import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { Address, WalletContractV4, TonClient, toNano } from '@ton/ton';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { fromNano } from '@ton/core';

// ─────── File system utilities ───────
import { writeFileSync } from 'fs';

// ===================== UTILITY FUNCTIONS =====================
// ─────── Delay helper ───────
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================== MAIN EXECUTION =====================
export async function run() {
    // ─────── Owner wallet creation ───────
    console.log('\n═════════ OWNER WALLET ═════════');
    console.log('✦ Generating new owner wallet...');
    
    const ownerMnemonic = await mnemonicNew();
    const ownerKeyPair = await mnemonicToWalletKey(ownerMnemonic);
    const ownerWallet = WalletContractV4.create({
        workchain: 0,
        publicKey: ownerKeyPair.publicKey
    });
    const ownerAddress = ownerWallet.address;
    const ownerAddressNonBounce = ownerAddress.toString({ 
        urlSafe: true, 
        bounceable: false 
    });
    
    console.log('✅ Owner wallet generated');
    console.log('✦ Address:', ownerAddress.toString());
    console.log('✦ Non-bounce address:', ownerAddressNonBounce);
    console.log('✦ Mnemonic:', ownerMnemonic.join(' '));
    console.log('✦ IMPORTANT: Save this mnemonic phrase in a secure place!');

    // ─────── Network configuration ───────
    const isTestnet = process.argv.includes('--testnet');
    const network = isTestnet ? 'testnet' : 'mainnet';
    
    console.log('\n═════════ NETWORK ═════════');
    console.log('✦ Selected network:', network.toUpperCase());
    
    const client = new TonClient({
        endpoint: network === 'mainnet' 
            ? 'https://mainnet.tonhubapi.com' 
            : 'https://testnet.toncenter.com/api/v2/jsonRPC'
    });
    
    // ─────── Balance check ───────
    console.log('\n═════════ BALANCE ═════════');
    const balance = await client.getBalance(ownerAddress);
    const balanceTON = fromNano(balance);
    console.log('✦ Owner balance:', balanceTON, 'TON');
    
    if (Number(balanceTON) < 0.05) {
        console.error('\n❌ Insufficient balance');
        console.log('✦ Required: at least 0.05 TON');
        console.log('✦ Please send funds to:', ownerAddress.toString());
        
        if (isTestnet) {
            console.log('✦ Testnet faucet: https://t.me/testgiver_ton_bot');
        }
        
        console.log('✦ After funding, rerun this script');
        return;
    }

    // ─────── Contract compilation ───────
    console.log('\n═════════ COMPILATION ═════════');
    console.log('✦ Compiling contract...');
    const code = await compile('xp');
    console.log('✅ Contract compiled');
    
    // ─────── Deployment process ───────
    console.log('\n═════════ DEPLOYMENT ═════════');
    console.log('✦ Deploying contract...');
    
    const contract = XPContract.createForDeploy(code, ownerAddress);
    const contractAddress = contract.address;
    const openedWallet = client.open(ownerWallet);
    const openedContract = client.open(contract);
    const sender = openedWallet.sender(ownerKeyPair.secretKey);
    
    try {
        await openedContract.sendDeploy(sender);
        console.log('✅ Deployment transaction sent');
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        throw error;
    }

    // ─────── Deployment confirmation ───────
    console.log('\n═════════ CONFIRMATION ═════════');
    console.log('✦ Waiting for deployment confirmation...');
    
    let deployed = false;
    for (let i = 1; i <= 30; i++) {
        await delay(3000);
        deployed = await client.isContractDeployed(contractAddress);
        
        if (deployed) {
            console.log('\n✅ Contract deployed!');
            console.log('✦ Address:', contractAddress.toString());
            break;
        }
        
        process.stdout.write(`⏳ ${i}/30`);
        if (i < 30) process.stdout.write(', ');
    }
    
    // ─────── Deployment timeout handling ───────
    if (!deployed) {
        const explorerUrl = isTestnet
            ? `https://testnet.tonscan.org/address/${contractAddress.toString()}`
            : `https://tonscan.org/address/${contractAddress.toString()}`;
        
        console.error('\n❌ Deployment timeout');
        console.log('✦ Check transaction manually:', explorerUrl);
        return;
    }

    // ─────── Data saving ───────
    console.log('\n═════════ SAVING DATA ═════════');
    const walletsData = {
        owner: {
            mnemonic: ownerMnemonic.join(' '),
            address: ownerAddress.toString(),
            addressNonBounce: ownerAddressNonBounce,
            publicKey: ownerKeyPair.publicKey.toString('hex')
        },
        contract: contractAddress.toString()
    };
    
    writeFileSync('wallets.json', JSON.stringify(walletsData, null, 2));
    console.log('✅ Data saved to wallets.json');
    
    // ─────── Completion ───────
    console.log('\n═════════ COMPLETE ═════════');
    console.log('✦ Deployment successful!');
}

// ===================== ERROR HANDLER =====================
run().catch(error => {
    console.error('\n❌ UNHANDLED ERROR:');
    console.error('✦ Error message:', error.message);
    process.exit(1);
});
// ══════════════════════ END ════════════════════