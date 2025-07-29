import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { Address, WalletContractV4, TonClient, toNano } from '@ton/ton';
import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { writeFileSync } from 'fs';
import { fromNano } from '@ton/core';

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function run() {
    // Generate new owner wallet
    console.log('🔑 Generating new owner wallet...');
    const ownerMnemonic = await mnemonicNew();
    const ownerKeyPair = await mnemonicToWalletKey(ownerMnemonic);
    
    const ownerWallet = WalletContractV4.create({
        workchain: 0,
        publicKey: ownerKeyPair.publicKey
    });
    
    const ownerAddress = ownerWallet.address;
    const ownerAddressNonBounce = ownerAddress.toString({ urlSafe: true, bounceable: false });
    
    console.log('✅ Owner wallet address:', ownerAddress.toString());
    console.log('📝 Owner mnemonic:', ownerMnemonic.join(' '));
    console.log('⚠️ IMPORTANT: Save this mnemonic phrase in a secure place!');

    // Determine network from arguments
    const isTestnet = process.argv.includes('--testnet');
    const network = isTestnet ? 'testnet' : 'mainnet';
    
    // Create client
    const client = new TonClient({
        endpoint: network === 'mainnet' 
            ? 'https://mainnet.tonhubapi.com' 
            : 'https://testnet.toncenter.com/api/v2/jsonRPC'
    });
    
    // Check balance
    const balance = await client.getBalance(ownerAddress);
    const balanceTON = fromNano(balance);
    console.log(`💰 Owner balance: ${balanceTON} TON`);
    
    if (Number(balanceTON) < 0.05) {
        console.error('\n❌ Insufficient balance. Send at least 0.05 TON to this address:');
        console.error(ownerAddress.toString());
        
        if (isTestnet) {
            console.error('\nYou can use the testnet faucet: https://t.me/testgiver_ton_bot');
        }
        
        console.error('After funding, rerun this script to deploy the contract.');
        return;
    }

    // Deploy contract
    console.log('\n🛠️ Compiling contract...');
    const code = await compile('xp');
    
    console.log('🚀 Deploying contract...');
    const contract = XPContract.createForDeploy(code, ownerAddress);
    const contractAddress = contract.address;
    
    // Open wallet and contract directly through client
    const openedWallet = client.open(ownerWallet);
    const openedContract = client.open(contract);
    
    // Create transaction sender
    const sender = openedWallet.sender(ownerKeyPair.secretKey);
    
    try {
        await openedContract.sendDeploy(sender);
        console.log('✅ Deployment transaction sent');
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        throw error;
    }

    // Wait for deployment confirmation
    console.log('\n⏳ Waiting for deployment confirmation...');
    let deployed = false;
    for (let i = 0; i < 30; i++) {
        await delay(3000);
        deployed = await client.isContractDeployed(contractAddress);
        if (deployed) {
            console.log('✅ Contract deployed!');
            break;
        }
        process.stdout.write('.');
    }
    
    if (!deployed) {
        console.error('\n❌ Deployment timeout. Check transaction manually:');
        const explorerUrl = isTestnet
            ? `https://testnet.tonscan.org/address/${contractAddress.toString()}`
            : `https://tonscan.org/address/${contractAddress.toString()}`;
        console.log(explorerUrl);
        return;
    }

    // Save data
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
    console.log('\n💾 Owner and contract data saved to wallets.json');
    console.log('✨ Deployment complete!');
}

// Run script
run().catch(console.error);