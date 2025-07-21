import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import wallets from '../wallets.json';
import { writeFileSync } from 'fs'; 

export async function run(provider: NetworkProvider) {
    const code = await compile('xp');
    const ownerAddress = Address.parse(wallets.owner.address);
    
    const contract = XPContract.createForDeploy(code, ownerAddress);
    const openedContract = provider.open(contract);
    
    await openedContract.sendDeploy(provider.sender());
    
    console.log('Contract deployed at:', openedContract.address.toString());
    await provider.waitForDeploy(openedContract.address);
    
    const walletsData = {...wallets, contract: openedContract.address.toString()};
    writeFileSync('wallets.json', JSON.stringify(walletsData, null, 2)); 
}