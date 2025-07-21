import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Cell, Address } from '@ton/core';
import { XPContract } from '../wrappers/XPContract';
import '@ton/test-utils';
import { readFileSync } from 'fs';

describe('XPContract', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let xpContract: SandboxContract<XPContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        user = await blockchain.treasury('user');
        
        const codeBoc = readFileSync('build/xp.compiled.cell');
        const code = Cell.fromBoc(codeBoc)[0];
        
        const contract = XPContract.createForDeploy(code, owner.address);
        xpContract = blockchain.openContract(contract);
        await xpContract.sendDeploy(owner.getSender());
    });

    it('should deploy and add XP', async () => {
        await xpContract.sendAddXP(owner.getSender(), {
            user: user.address,
            amount: 100n
        });
        
        const xp = await xpContract.getXP(user.address);
        expect(xp).toEqual(100n);
    });

    it('should prevent non-owner from adding XP', async () => {
        const hacker = await blockchain.treasury('hacker');
        
        const result = await blockchain.sendMessage(hacker.getSender().open({
            to: xpContract.address,
            value: toNano('0.1'),
            body: beginCell()
                .storeUint(XPContract.OP_ADD_XP, 32)
                .storeAddress(user.address)
                .storeUint(100n, 64)
                .endCell()
        }));

        expect(result.transactions).toHaveTransaction({
            from: hacker.address,
            to: xpContract.address,
            success: false,
            exitCode: 35,
        });
        
        const xp = await xpContract.getXP(user.address);
        expect(xp).toEqual(0n);
    });
});