import { compile } from '@ton/blueprint';
import { XPContract } from '../wrappers/XPContract';
import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const code = await compile('xp');
    const owner = provider.sender().address!;
    const contract = XPContract.createForDeploy(code, owner);
    const openedContract = provider.open(contract);
    
    await openedContract.sendDeploy(provider.sender(), toNano('0.05'));
    console.log('Contract deployed at:', openedContract.address.toString());
    await provider.waitForDeploy(openedContract.address);
}