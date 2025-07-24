// scripts/deploy.ts
import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { NetworkProvider } from '@ton/blueprint';
import { Address, WalletContractV4, TonClient, toNano } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import wallets from '../wallets.json';
import { writeFileSync } from 'fs';
import { fromNano } from '@ton/core'; // Added for balance formatting

// Utility for waiting between checks
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function run(provider: NetworkProvider) {
    // Load owner wallet data from wallets.json
    const ownerWallet = wallets.owner;
    if (!ownerWallet || !ownerWallet.mnemonic) {
        throw new Error('Owner wallet mnemonic missing in wallets.json');
    }
    
    // Derive key pair from mnemonic
    const words = ownerWallet.mnemonic.split(' ');
    const keyPair = await mnemonicToWalletKey(words);
    
    // Create wallet contract (v4)
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey
    });
    
    const walletAddress = wallet.address;
    console.log('✅ Owner wallet address:', walletAddress.toString());
    
    // Open wallet and prepare sender
    const walletContract = provider.open(wallet);
    const sender = walletContract.sender(keyPair.secretKey);
    
    // Initialize TON client with appropriate endpoint
    const client = new TonClient({
        endpoint: provider.network() === 'mainnet' 
            ? 'https://mainnet.tonhubapi.com' 
            : 'https://testnet.toncenter.com/api/v2/jsonRPC'
    });
    
    // Check and display wallet balance
    const balance = await client.getBalance(walletAddress);
    console.log(`💰 Wallet balance: ${balance} nanoton (${fromNano(balance)} TON)`);
    
    // Verify sufficient deployment funds
    if (balance < toNano('0.05')) {
        throw new Error(`Insufficient balance. Send 0.05+ TON to ${walletAddress.toString()}`);
    }
    
    // Compile contract code
    const code = await compile('xp');
    const contract = XPContract.createForDeploy(code, walletAddress);
    const opened = provider.open(contract);

    // Deploy contract
    console.log('Deploying contract...');
    try {
        await opened.sendDeploy(sender);
        console.log('✅ Deployment transaction sent');
    } catch (error) {
        console.error('🚨 Deployment failed:', error);
        throw error;
    }

    // Verify contract deployment status
    let attempt = 1;
    const maxAttempts = 20;
    while (attempt <= maxAttempts) {
        process.stdout.write(`\r⏳ Checking deployment status (${attempt}/${maxAttempts})...`);
        await delay(2000);
        
        const isDeployed = await client.isContractDeployed(opened.address);
        if (isDeployed) {
            console.log('\n✅ Contract deployed at:', opened.address.toString());
            break;
        }
        
        attempt++;
    }
    
    if (attempt > maxAttempts) {
        throw new Error('Deployment confirmation timeout');
    }

    // Save contract address to wallets.json
    const updatedWallets = { 
        ...wallets, 
        contract: opened.address.toString() 
    };
    writeFileSync('wallets.json', JSON.stringify(updatedWallets, null, 2));
    console.log('✅ Contract address saved to wallets.json');
}