// wrappers/XPContract.ts
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
  Dictionary
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
    const data = beginCell()
      .storeAddress(owner)
      .storeUint(1, 16)
      .storeUint(0, 32)  // Initial last_op_time = 0
      .storeDict(
        Dictionary.empty(
          Dictionary.Keys.Buffer(32),
          Dictionary.Values.BigUint(64)
        )
      )
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
    options: { user: Address; amount: bigint }
  ) {
    await provider.internal(via, {
      value: toNano('0.2'),
      body: beginCell()
        .storeUint(XPContract.OP_ADD_XP, 32)
        .storeUint(0, 4) // flags
        .storeAddress(options.user)
        .storeUint(options.amount, 64)
        .endCell(),
    });
  }

  async getXP(provider: ContractProvider, user: Address): Promise<bigint> {
    const args = beginCell().storeAddress(user).endCell();
    const res  = await provider.get('get_xp', [
      { type: 'slice', cell: args },
    ]);
    return res.stack.readBigNumber();
  }

  async getXPKey(provider: ContractProvider, user: Address): Promise<bigint> {
    const args = beginCell().storeAddress(user).endCell();
    const res  = await provider.get('get_xp_key', [
      { type: 'slice', cell: args },
    ]);
    return res.stack.readBigNumber();
  }

  async getOwner(provider: ContractProvider): Promise<Address> {
    const res = await provider.get('get_owner', []);
    return res.stack.readAddress();
  }

  async getVersion(provider: ContractProvider): Promise<bigint> {
    const res = await provider.get('get_version', []);
    return res.stack.readBigNumber();
  }

  async getLevel(provider: ContractProvider, xp: bigint): Promise<bigint> {
    const res = await provider.get('get_level', [
      { type: 'int', value: xp },
    ]);
    return res.stack.readBigNumber();
  }

  async getRank(provider: ContractProvider, xp: bigint): Promise<bigint> {
    const res = await provider.get('get_rank', [
      { type: 'int', value: xp },
    ]);
    return res.stack.readBigNumber();
  }

  async getReputation(
    provider: ContractProvider,
    xp: bigint,
    days: bigint,
    rating: bigint,
    weight: bigint
  ): Promise<bigint> {
    const res = await provider.get('get_reputation', [
      { type: 'int', value: xp },
      { type: 'int', value: days },
      { type: 'int', value: rating },
      { type: 'int', value: weight },
    ]);
    return res.stack.readBigNumber();
  }

  async getLastOpTime(provider: ContractProvider): Promise<bigint> {
    const res = await provider.get('get_last_op_time', []);
    return res.stack.readBigNumber();
  }
}