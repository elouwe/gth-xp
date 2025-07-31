// scripts/deploy.ts
import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { NetworkProvider } from '@ton/blueprint';
import { Address, WalletContractV4, TonClient, toNano } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import wallets from '../wallets.json';
import { writeFileSync } from 'fs';
import { fromNano } from '@ton/core';

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function run(provider: NetworkProvider) {
    console.log('\n═════════ DEPLOYMENT ═════════');
    
    // Verify owner wallet configuration
    console.log('✦ Verifying owner wallet...');
    const ownerWallet = wallets.owner;
    if (!ownerWallet || !ownerWallet.mnemonic) {
        throw new Error('❌ Owner wallet mnemonic missing in configuration');
    }
    
    // Derive wallet keys from mnemonic
    const words = ownerWallet.mnemonic.split(' ');
    const keyPair = await mnemonicToWalletKey(words);
    
    // Create wallet contract instance
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
    });
    
    const walletAddress = wallet.address;
    console.log('✅ Owner wallet address:', walletAddress.toString());
    
    // Configure network parameters
    const network = provider.network();
    console.log('\n═════════ NETWORK ═════════');
    console.log('✦ Selected network:', network.toUpperCase());
    
    // Initialize TonClient with appropriate endpoint
    const client = new TonClient({
        endpoint: network === 'mainnet' 
            ? 'https://mainnet.tonhubapi.com' 
            : 'https://testnet.toncenter.com/api/v2/jsonRPC'
    });
    
    // Check wallet balance
    console.log('\n═════════ BALANCE ═════════');
    const balance = await client.getBalance(walletAddress);
    console.log('✦ Balance:', fromNano(balance), 'TON');
    
    // Validate sufficient balance for deployment
    if (balance < toNano('0.05')) {
        throw new Error(
            `❌ Insufficient balance (${fromNano(balance)} TON)\n` +
            `✦ Send at least 0.05 TON to: ${walletAddress.toString()}`
        );
    }
    
    // Compile contract code
    console.log('\n═════════ COMPILATION ═════════');
    console.log('✦ Compiling contract source...');
    const code = await compile('xp');
    console.log('✅ Contract compiled successfully');
    
    // Prepare contract for deployment
    console.log('\n═════════ DEPLOYING ═════════');
    const contract = XPContract.createForDeploy(code, walletAddress);
    const opened = provider.open(contract);
    
    // Create transaction sender
    const walletContract = provider.open(wallet);
    const sender = walletContract.sender(keyPair.secretKey);
    
    try {
        // Send deployment transaction
        console.log('✦ Sending deployment transaction...');
        await opened.sendDeploy(sender);
        console.log('✅ Deployment transaction sent to network');
    } catch (error) {
        console.error('❌ Deployment transaction failed:', error);
        throw error;
    }

    // Monitor deployment confirmation
    console.log('\n═════════ CONFIRMATION ═════════');
    console.log('✦ Waiting for deployment confirmation...');
    
    let attempt = 1;
    const maxAttempts = 30;
    let deployed = false;
    
    // Polling for contract deployment status
    while (attempt <= maxAttempts) {
        process.stdout.write(`⏳ Attempt ${attempt}/${maxAttempts}... `);
        await delay(3000);  // Wait 3 seconds between checks
        
        deployed = await client.isContractDeployed(opened.address);
        if (deployed) {
            console.log('✅ Contract deployed successfully');
            console.log('✦ Contract address:', opened.address.toString());
            break;
        }
        
        attempt++;
    }
    
    // Handle deployment timeout
    if (!deployed) {
        throw new Error(
            '\n❌ Deployment confirmation timeout\n' +
            `✦ Check contract status manually: ${opened.address.toString()}`
        );
    }

    // Update configuration file
    console.log('\n═════════ SAVING DATA ═════════');
    const updatedWallets = { 
        ...wallets, 
        contract: opened.address.toString() 
    };
    
    writeFileSync('wallets.json', JSON.stringify(updatedWallets, null, 2));
    console.log('✅ Contract address saved to wallets.json');
    console.log('\n═════════ COMPLETE ═════════');
    console.log('✦ Deployment process completed successfully!');
}