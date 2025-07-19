import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { XPContract } from '../wrappers/XPContract';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

describe('XPContract', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;
    let xpContract: SandboxContract<XPContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        user = await blockchain.treasury('user');
        const code = await compile('xp');
        xpContract = blockchain.openContract(XPContract.createForDeploy(code, owner.address));
        await xpContract.sendDeploy(owner.getSender(), toNano('0.05'));
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
        const result = await xpContract.sendAddXP(hacker.getSender(), {
            user: user.address,
            amount: 100n
        });
        expect(result.transactions).toHaveTransaction({
            from: hacker.address,
            to: xpContract.address,
            success: false,
            exitCode: 35,
        });
    });
});