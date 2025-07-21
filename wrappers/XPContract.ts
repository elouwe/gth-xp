import { 
    Address, beginCell, Cell, Contract, ContractProvider, 
    Sender, SendMode, toNano, contractAddress, Dictionary
} from '@ton/core';

export class XPContract implements Contract {
    static readonly OP_ADD_XP = 0x1234;

    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    static createFromAddress(address: Address): XPContract {
        return new XPContract(address);
    }

    static createForDeploy(code: Cell, owner: Address): XPContract {
        const emptyDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        const data = beginCell()
            .storeAddress(owner)
            .storeDict(emptyDict)
            .endCell();
        const address = contractAddress(0, { code, data });
        return new XPContract(address, { code, data });
    }

    async sendDeploy(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendAddXP(
        provider: ContractProvider,
        via: Sender,
        options: {
            user: Address;
            amount: bigint;
        }
    ) {
        await provider.internal(via, {
            value: toNano('0.1'),
            body: beginCell()
                .storeUint(XPContract.OP_ADD_XP, 32)
                .storeAddress(options.user)
                .storeUint(options.amount, 64)
                .endCell(),
        });
    }

    async getXP(provider: ContractProvider, user: Address): Promise<bigint> {
        const result = await provider.get('get_xp', [
            { type: 'slice', cell: beginCell().storeAddress(user).endCell() }
        ]);
        return result.stack.readBigNumber();
    }
}