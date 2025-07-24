import { 
    Address, beginCell, Cell, Contract, ContractProvider, 
    Sender, SendMode, toNano, contractAddress, Dictionary
} from '@ton/core';

export class XPContract implements Contract {
    // Operation codes
    static readonly OP_ADD_XP = 0x1234;

    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) {}

    // Create instance from existing address
    static createFromAddress(address: Address): XPContract {
        return new XPContract(address);
    }

    // Prepare contract for deployment
    static createForDeploy(code: Cell, owner: Address): XPContract {
        const data = beginCell()
            .storeAddress(owner)              // Contract owner address
            .storeUint(1, 16)                 // Initial version (16-bit)
            .storeDict(Dictionary.empty(       // Empty XP dictionary
                Dictionary.Keys.Buffer(32),    // Key: 32-byte user address hash
                Dictionary.Values.BigUint(64) // Value: 64-bit XP value
            ))
            .endCell();
        
        // Calculate address from code and data
        const address = contractAddress(0, { code, data });
        return new XPContract(address, { code, data });
    }

    // Deploy contract to blockchain
    async sendDeploy(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.1'),         // Deployment fee
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),   // Empty body
        });
    }

    // Send XP to user
    async sendAddXP(
        provider: ContractProvider,
        via: Sender,
        options: {
            user: Address;
            amount: bigint;
        }
    ) {
        await provider.internal(via, {
            value: toNano('0.2'),         // Operation fee
            body: beginCell()
                .storeUint(XPContract.OP_ADD_XP, 32)  // Operation ID
                .storeUint(0, 4)                      // Flags (4 bits)
                .storeAddress(options.user)            // User address
                .storeUint(options.amount, 64)         // XP amount (64 bits)
                .endCell(),
        });
    }

    // Get user's XP balance (uses cell argument format)
    async getXP(provider: ContractProvider, userAddress: Address): Promise<bigint> {
        // Package address into cell
        const argsCell = beginCell()
            .storeAddress(userAddress)
            .endCell();
        
        // Query contract with cell argument
        const result = await provider.get('get_xp', [
            { 
                type: 'cell',
                cell: argsCell
            }
        ]);
        
        return result.stack.readBigNumber();  // Return XP as bigint
    }

    // Get contract owner address
    async getOwner(provider: ContractProvider): Promise<Address> {
        const result = await provider.get('get_owner', []);
        return result.stack.readAddress();
    }

    // Get contract version
    async getVersion(provider: ContractProvider): Promise<bigint> {
        const result = await provider.get('get_version', []);
        return result.stack.readBigNumber();
    }

    // Calculate level from XP
    async getLevel(provider: ContractProvider, xp: bigint): Promise<bigint> {
        const result = await provider.get('get_level', [
            { type: 'int', value: xp }
        ]);
        return result.stack.readBigNumber();
    }

    // Calculate rank from XP
    async getRank(provider: ContractProvider, xp: bigint): Promise<bigint> {
        const result = await provider.get('get_rank', [
            { type: 'int', value: xp }
        ]);
        return result.stack.readBigNumber();
    }

    // Calculate reputation score
    async getReputation(
        provider: ContractProvider, 
        xp: bigint, 
        days: bigint, 
        rating: bigint, 
        weight: bigint
    ): Promise<bigint> {
        const result = await provider.get('get_reputation', [
            { type: 'int', value: xp },      // Experience points
            { type: 'int', value: days },    // Days active
            { type: 'int', value: rating },  // Community rating
            { type: 'int', value: weight }   // Behavior weight
        ]);
        return result.stack.readBigNumber();
    }
}