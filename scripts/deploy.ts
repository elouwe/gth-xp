// scripts/deploy.ts
// ══════════════════════ IMPORTS ══════════════════════
import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { NetworkProvider } from '@ton/blueprint';
import { Address, WalletContractV4, TonClient, toNano } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import wallets from '../wallets.json';
import { writeFileSync } from 'fs';
import { fromNano } from '@ton/core';

// ══════════════════════ UTILITIES ═══════════════════════
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════ MAIN EXECUTION ═══════════════════════
export async function run(provider: NetworkProvider) {
    console.log('\n═════════════════════ DEPLOYMENT INIT ═════════════════════');
    console.log('✦ Starting contract deployment process');
    console.log('✦ Timestamp:', new Date().toISOString());

    // ─────────────────── WALLET VERIFICATION ───────────────────
    console.log('\n═════════════════════ WALLET CONFIG ═════════════════════');
    const ownerWallet = wallets.owner;
    if (!ownerWallet || !ownerWallet.mnemonic) {
        console.error('❌ Owner wallet configuration missing');
        throw new Error('Owner wallet mnemonic missing in configuration');
    }
    console.log('✅ Wallet configuration verified');

    // ─────────────────── KEY DERIVATION ────────────────────────
    console.log('\n═════════════════════ KEY SETUP ════════════════════════');
    const words = ownerWallet.mnemonic.split(' ');
    const keyPair = await mnemonicToWalletKey(words);
    console.log('✦ Key derivation completed');
    console.log(`  - Public key: ${keyPair.publicKey.toString('hex')}`);

    // ─────────────────── WALLET CONTRACT ───────────────────────
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
    });
    const walletAddress = wallet.address;
    console.log('\n═════════════════════ WALLET ADDRESS ═══════════════════');
    console.log(`✦ Owner wallet address: ${walletAddress.toString()}`);

    // ─────────────────── NETWORK CONFIG ────────────────────────
    console.log('\n═════════════════════ NETWORK SETUP ════════════════════');
    const network = provider.network();
    const endpoint = network === 'mainnet' 
        ? 'https://mainnet.tonhubapi.com' 
        : 'https://testnet.toncenter.com/api/v2/jsonRPC';
    
    console.log('✦ Network configuration:');
    console.log(`  - Selected: ${network.toUpperCase()}`);
    console.log(`  - Endpoint: ${endpoint}`);

    const client = new TonClient({ endpoint });
    console.log('✅ TonClient initialized');

    // ─────────────────── BALANCE CHECK ─────────────────────────
    console.log('\n═════════════════════ BALANCE VERIFICATION ═════════════');
    const balance = await client.getBalance(walletAddress);
    const balanceTON = fromNano(balance);
    console.log(`✦ Wallet balance: ${balanceTON} TON`);

    if (balance < toNano('0.05')) {
        console.error(`❌ Insufficient balance (${balanceTON} TON)`);
        console.log(`✦ Minimum required: 0.05 TON`);
        console.log(`✦ Send funds to: ${walletAddress.toString()}`);
        throw new Error('Insufficient balance for deployment');
    }
    console.log('✅ Sufficient balance verified');

    // ─────────────────── CONTRACT COMPILATION ──────────────────
    console.log('\n═════════════════════ COMPILATION ══════════════════════');
    console.log('✦ Compiling contract source...');
    
    try {
        const code = await compile('xp');
        console.log('✅ Contract compiled successfully');
        console.log(`  - Cell hash: ${code.hash().toString('hex')}`);
    } catch (error) {
        console.error('❌ Compilation failed:');
        console.error('✦ Error details:', error);
        throw error;
    }

    // ─────────────────── DEPLOYMENT PREP ───────────────────────
    console.log('\n═════════════════════ DEPLOYMENT SETUP ═════════════════');
    const code = await compile('xp');
    const contract = XPContract.createForDeploy(code, walletAddress);
    const opened = provider.open(contract);
    
    console.log('✦ Contract details:');
    console.log(`  - Address: ${opened.address.toString()}`);
    console.log(`  - Workchain: ${opened.address.workChain}`);
    console.log('✅ Deployment package prepared');

    // ─────────────────── TRANSACTION EXECUTION ─────────────────
    console.log('\n═════════════════════ TRANSACTION ══════════════════════');
    const walletContract = provider.open(wallet);
    const sender = walletContract.sender(keyPair.secretKey);
    
    try {
        console.log('✦ Sending deployment transaction...');
        await opened.sendDeploy(sender);
        console.log('✅ Deployment transaction broadcasted');
        console.log(`  - Sender: ${walletAddress.toString()}`);
        console.log(`  - Contract: ${opened.address.toString()}`);
    } catch (error) {
        console.error('❌ Transaction failed:');
        console.error('✦ Error details:', error);
        throw error;
    }

    // ─────────────────── CONFIRMATION MONITORING ───────────────
    console.log('\n═════════════════════ CONFIRMATION ═════════════════════');
    console.log('✦ Monitoring deployment status...');
    
    let attempt = 1;
    const maxAttempts = 30;
    let deployed = false;
    
    while (attempt <= maxAttempts) {
        process.stdout.write(`  ⏳ Polling attempt ${attempt}/${maxAttempts}... `);
        await delay(3000);
        
        deployed = await client.isContractDeployed(opened.address);
        if (deployed) {
            console.log('SUCCESS ✅');
            break;
        } else {
            console.log('pending');
        }
        attempt++;
    }
    
    if (!deployed) {
        console.error('\n❌ Deployment confirmation timeout');
        console.log(`✦ Contract address: ${opened.address.toString()}`);
        console.log('✦ Please verify deployment status manually');
        throw new Error('Deployment confirmation timeout');
    }
    
    console.log('\n✅ Contract deployment confirmed');
    console.log(`✦ Contract address: ${opened.address.toString()}`);

    // ─────────────────── CONFIG UPDATE ─────────────────────────
    console.log('\n═════════════════════ CONFIG UPDATE ════════════════════');
    const updatedWallets = { 
        ...wallets, 
        contract: opened.address.toString() 
    };
    
    try {
        writeFileSync('wallets.json', JSON.stringify(updatedWallets, null, 2));
        console.log('✅ Configuration updated:');
        console.log(`  - File: wallets.json`);
        console.log(`  - Contract: ${opened.address.toString()}`);
    } catch (error) {
        console.error('❌ Config update failed:');
        console.error('✦ Error details:', error);
        throw error;
    }

    // ─────────────────── COMPLETION ────────────────────────────
    console.log('\n═════════════════════ DEPLOYMENT SUMMARY ═══════════════');
    console.log('✦ Deployment process completed successfully ✅');
    console.log('✦ Contract details:');
    console.log(`  - Address: ${opened.address.toString()}`);
    console.log(`  - Network: ${network.toUpperCase()}`);
    console.log(`✦ Timestamp: ${new Date().toISOString()}`);
    console.log('\n════════════════════════════════════════════════════════');
}
// ══════════════════════ END ════════════════════