import {
  Address,
  beginCell,
  Cell,
  Contract,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
  contractAddress,
  Dictionary,
} from '@ton/core';

export class XPContract implements Contract {
  static readonly OP_ADD_XP = 0x1234;
  static readonly OP_ADD_XP_WITH_ID = 0x5678;
  static readonly OP_UPGRADE = 0x8765;

  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address): XPContract {
    return new XPContract(address);
  }

  static createForDeploy(code: Cell, owner: Address): XPContract {
    const balanceDict = Dictionary.empty(
      Dictionary.Keys.Buffer(32),
      Dictionary.Values.BigUint(64)
    );
    
    const userHistoryDict = Dictionary.empty(
      Dictionary.Keys.Buffer(32),
      Dictionary.Values.Dictionary(
        Dictionary.Keys.BigUint(256),
        Dictionary.Values.Cell()
      )
    );

    const data = beginCell()
      .storeAddress(owner)
      .storeUint(4, 16)
      .storeUint(0, 64)
      .storeDict(balanceDict)
      .storeDict(userHistoryDict)
      .endCell();

    const addr = contractAddress(0, { code, data });
    return new XPContract(addr, { code, data });
  }

  async sendDeploy(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendAddXP(
    provider: ContractProvider,
    via: Sender,
    options: { user: Address; amount: bigint; opId?: bigint }
  ) {
    const opcode = options.opId ? XPContract.OP_ADD_XP_WITH_ID : XPContract.OP_ADD_XP;
    const body = beginCell()
      .storeUint(opcode, 32)
      .storeUint(0, 4)
      .storeAddress(options.user)
      .storeUint(options.amount, 64);

    if (options.opId) {
      body.storeUint(options.opId, 256);
    }

    await provider.internal(via, {
      value: toNano('0.2'),
      body: body.endCell(),
    });
  }

  async sendUpgrade(
    provider: ContractProvider,
    via: Sender,
    options: { newCode: Cell }
  ) {
    const body = beginCell()
      .storeUint(XPContract.OP_UPGRADE, 32)
      .storeRef(options.newCode)
      .endCell();

    await provider.internal(via, {
      value: toNano('0.5'),
      body: body,
    });
  }

  async getXP(provider: ContractProvider, user: Address): Promise<bigint> {
    const args = beginCell().storeAddress(user).endCell();
    const res = await provider.get('get_xp', [
      { type: 'slice', cell: args },
    ]);
    return res.stack.readBigNumber();
  }

  async getUserHistory(
    provider: ContractProvider, 
    user: Address
  ): Promise<Cell | null> {
    const args = beginCell().storeAddress(user).endCell();
    const res = await provider.get('get_user_history', [
      { type: 'slice', cell: args },
    ]);
    
    try {
      return res.stack.readCell();
    } catch (e) {
      return null;
    }
  }

  async getOwner(provider: ContractProvider): Promise<Address> {
    const res = await provider.get('get_owner', []);
    return res.stack.readAddress();
  }

  async getVersion(provider: ContractProvider): Promise<bigint> {
    const res = await provider.get('get_version', []);
    return res.stack.readBigNumber();
  }

  async getLastOpTime(provider: ContractProvider): Promise<bigint> {
    const res = await provider.get('get_last_op_time', []);
    return res.stack.readBigNumber();
  }

  async getXPKey(provider: ContractProvider, user: Address): Promise<bigint> {
    const args = beginCell().storeAddress(user).endCell();
    const res = await provider.get('get_xp_key', [
      { type: 'slice', cell: args },
    ]);
    return res.stack.readBigNumber();
  }
}