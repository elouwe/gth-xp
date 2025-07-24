import { Blockchain } from '@ton/sandbox';
import {
    Cell,
    Address,
    toNano,
    beginCell,
    Dictionary,
    contractAddress as getContractAddress,
    TupleItem,
} from '@ton/core';
import { compile } from '@ton/blueprint';

describe('XPContract', () => {
    let code: Cell;
    let blockchain: Blockchain;
    let owner: any;
    let user: any;
    let attacker: any;
    let xpAddress: Address;

    beforeAll(async () => {
        code = await compile('xp');
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // Создаем кошельки
        owner = await blockchain.treasury('owner');
        user = await blockchain.treasury('user');
        attacker = await blockchain.treasury('attacker');

        // Создаем данные контракта
        const data = beginCell()
            .storeAddress(owner.address)
            .storeUint(1, 16)
            .storeDict(Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.BigUint(64)))
            .endCell();

        // Вычисляем адрес контракта
        xpAddress = getContractAddress(0, { code, data });

        // Деплоим контракт
        await owner.send({
            to: xpAddress,
            value: toNano('0.1'),
            bounce: false,
            init: { code, data },
            body: new Cell(),
        });
    });

    async function sendAddXP(sender: any, user: Address, amount: bigint) {
        const body = beginCell()
            .storeUint(0x1234, 32) // OP_ADD_XP
            .storeAddress(user)
            .storeUint(amount, 64)
            .endCell();

        return await sender.send({
            to: xpAddress,
            value: toNano('0.5'),
            bounce: false,
            body,
        });
    }

    async function getXP(user: Address): Promise<bigint> {
        const userCell = beginCell()
            .storeBit(true)   // bounceable
            .storeBit(true)   // testOnly
            .storeBit(false)  // anycast
            .storeInt(user.workChain, 8)
            .storeBuffer(user.hash)
            .endCell();
            
        const result = await blockchain.runGetMethod(xpAddress, 'get_xp', [
            { type: 'slice', cell: userCell }
        ]);
        if (result.stack.length === 0) return 0n;
        const item = result.stack[0];
        if (item.type === 'int') {
            return BigInt(item.value);
        }
        return 0n;
    }

    async function runGetMethod(method: string, args: TupleItem[] = []) {
        const result = await blockchain.runGetMethod(xpAddress, method, args);
        return result.stack;
    }

    function getExitCode(tx: any): number | undefined {
        return tx?.description?.computePhase?.exitCode;
    }

    async function getOwner(): Promise<Address> {
        const stack = await runGetMethod('get_owner');
        if (stack.length === 0) throw new Error('Empty stack');
        const item = stack[0];
        if (item.type === 'slice') {
            const addr = item.cell.beginParse().loadAddress(); 
            return addr;
        }
        throw new Error('Owner not found');
    }

    async function getVersion(): Promise<number> {
        const stack = await runGetMethod('get_version');
        if (stack.length === 0) throw new Error('Empty stack');
        const item = stack[0];
        if (item.type === 'int') {
            return Number(item.value);
        }
        return 0;
    }

    async function getLevel(xp: bigint): Promise<number> {
        const stack = await runGetMethod('get_level', [
            { type: 'int', value: xp },
        ]);
        if (stack.length === 0) throw new Error('Empty stack');
        const item = stack[0];
        return item.type === 'int' ? Number(item.value) : 0;
    }

    async function getRank(xp: bigint): Promise<number> {
        const stack = await runGetMethod('get_rank', [
            { type: 'int', value: xp },
        ]);
        if (stack.length === 0) throw new Error('Empty stack');
        const item = stack[0];
        return item.type === 'int' ? Number(item.value) : 0;
    }

    async function getReputation(
        xp: bigint,
        d: bigint,
        r: bigint,
        bw: bigint,
    ): Promise<number> {
        const stack = await runGetMethod('get_reputation', [
            { type: 'int', value: xp },
            { type: 'int', value: d },
            { type: 'int', value: r },
            { type: 'int', value: bw },
        ]);
        if (stack.length === 0) throw new Error('Empty stack');
        const item = stack[0];
        if (item.type === 'int') {
            return Number(item.value);
        }
        return 0;
    }

    it('should deploy correctly', async () => {
        const ownerAddress = await getOwner();
        expect(ownerAddress.toString()).toEqual(owner.address.toString());

        const contract = await blockchain.getContract(xpAddress);
        expect(contract.balance > 0n).toBeTruthy();

        const version = await getVersion();
        expect(version).toEqual(1);
    });

    it('should add XP correctly', async () => {
        const result = await sendAddXP(owner, user.address, 100n);
        const lastTx = result.transactions[result.transactions.length - 1];
        expect(getExitCode(lastTx)).toEqual(0);

        const xp = await getXP(user.address);
        expect(xp).toEqual(100n);
    });

    it('should reject overflow', async () => {
        const MAX_UINT64 = 18446744073709551615n;
        await sendAddXP(owner, user.address, MAX_UINT64 - 1n);
        const result = await sendAddXP(owner, user.address, 2n);
        const lastTx = result.transactions[result.transactions.length - 1];
        expect(getExitCode(lastTx)).toEqual(402); // ERR_OVERFLOW
    });

    it('should prevent non-owner from adding XP', async () => {
        const result = await sendAddXP(attacker, user.address, 100n);
        const lastTx = result.transactions[result.transactions.length - 1];
        expect(getExitCode(lastTx)).toEqual(401); // ERR_NOT_OWNER
    });

    it('should calculate level correctly', async () => {
        const testCases = [
            { xp: 0, lvl: 0 },
            { xp: 99, lvl: 0 },
            { xp: 100, lvl: 1 },
            { xp: 249, lvl: 1 },
            { xp: 250, lvl: 2 },
            { xp: 499, lvl: 2 },
            { xp: 500, lvl: 3 },
        ];
        for (const { xp, lvl } of testCases) {
            const level = await getLevel(BigInt(xp));
            expect(level).toEqual(lvl);
        }
    });

    it('should calculate rank correctly', async () => {
        const testCases = [
            { xp: 0, rank: 0 },
            { xp: 99, rank: 0 },
            { xp: 100, rank: 1 },
            { xp: 249, rank: 1 },
            { xp: 250, rank: 2 },
            { xp: 499, rank: 2 },
            { xp: 500, rank: 3 },
        ];
        for (const { xp, rank } of testCases) {
            const r = await getRank(BigInt(xp));
            expect(r).toEqual(rank);
        }
    });

    it('should calculate reputation correctly', async () => {
        const testCases = [
            { xp: 0, d: 0, r: 0, bw: 0, rep: 18 },
            { xp: 100, d: 0, r: 0, bw: 0, rep: 28 },
            { xp: 100, d: 5, r: 1, bw: 0, rep: 43 },
            { xp: 500, d: 10, r: 5, bw: 5, rep: 63 },
            { xp: 1000, d: 20, r: 10, bw: 10, rep: 100 },
        ];
        for (const { xp, d, r, bw, rep } of testCases) {
            const reputation = await getReputation(
                BigInt(xp),
                BigInt(d),
                BigInt(r),
                BigInt(bw),
            );
            expect(reputation).toEqual(rep);
        }
    });
});