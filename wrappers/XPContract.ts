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
  Dictionary,
} from '@ton/core';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

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
      Dictionary.Keys.Buffer(32),           // 256-bit key = addrHash
      Dictionary.Values.BigUint(64)         // XP as uint64
    );

    const userHistoryDict = Dictionary.empty(
      Dictionary.Keys.Buffer(32),           // 256-bit key = addrHash
      Dictionary.Values.Dictionary(
        Dictionary.Keys.BigUint(256),       // opId = uint256
        Dictionary.Values.Cell()            // value = cell(amount, ts, opId)
      )
    );

    const data = beginCell()
      .storeAddress(owner)
      .storeUint(4, 16)   // version
      .storeUint(0, 64)   // last_op_time
      .storeDict(balanceDict)
      .storeDict(userHistoryDict)
      .endCell();

    const addr = contractAddress(0, { code, data });
    return new XPContract(addr, { code, data });
  }

  static async generateUser(): Promise<{ address: string; mnemonic: string }> {
    try {
      const mnemonic = await mnemonicNew();
      const keyPair = await mnemonicToPrivateKey(mnemonic);
      const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
      });
      return {
        address: wallet.address.toString(),
        mnemonic: mnemonic.join(' '),
      };
    } catch (error) {
      console.error('Failed to generate user:', error);
      throw new Error('User generation failed');
    }
  }

  async sendDeploy(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.1'),
      sendMode: 1,
      body: beginCell().endCell(),
    });
  }

  async sendInit(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      value: toNano('0.05'),
      sendMode: 1, // ✅
      body: beginCell().endCell(),
    });
  }

  async isInitialized(provider: ContractProvider): Promise<boolean> {
    try {
      const state = await provider.getState();
      return state.state.type === 'active';
    } catch {
      return false;
    }
  }

  getAddXPMessageBody(options: { user: Address; amount: bigint; opId?: bigint }): Cell {
    const opcode = options.opId ? XPContract.OP_ADD_XP_WITH_ID : XPContract.OP_ADD_XP;

    const b = beginCell()
      .storeUint(opcode, 32)
      .storeUint(0, 4)
      .storeAddress(options.user)
      .storeUint(options.amount, 64);

    if (options.opId) {
      b.storeUint(options.opId, 256);
    }
    return b.endCell();
  }

  async sendAddXP(
    provider: ContractProvider,
    via: Sender,
    options: { user: Address; amount: bigint; opId?: bigint }
  ) {
    const body = this.getAddXPMessageBody(options);
    console.log('addXP body bits/refs:', body.bits.length, body.refs.length, 'opId?', !!options.opId);
    await provider.internal(via, {
      value: toNano('0.05'),
      sendMode: 1,
      body,
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
      // sendMode: SendMode.PAY_GAS_SEPARATELY,
      sendMode: 1,
      body,
    });
  }

  async getXP(provider: ContractProvider, user: Address): Promise<bigint> {
    const args = beginCell().storeAddress(user).endCell();
    const res = await provider.get('get_xp', [{ type: 'slice', cell: args }]);
    return res.stack.readBigNumber();
  }

  async getUserHistory(
    provider: ContractProvider,
    user: Address
  ): Promise<Cell | null> {
    const args = beginCell().storeAddress(user).endCell();
    const res = await provider.get('get_user_history', [{ type: 'slice', cell: args }]);
    try {
      return res.stack.readCell();
    } catch {
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
    const res = await provider.get('get_xp_key', [{ type: 'slice', cell: args }]);
    return res.stack.readBigNumber();
  }
}
