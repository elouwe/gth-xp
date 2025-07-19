import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type XPContractConfig = {};

export function xPContractConfigToCell(config: XPContractConfig): Cell {
    return beginCell().endCell();
}

export class XPContract implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new XPContract(address);
    }

    static createFromConfig(config: XPContractConfig, code: Cell, workchain = 0) {
        const data = xPContractConfigToCell(config);
        const init = { code, data };
        return new XPContract(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
