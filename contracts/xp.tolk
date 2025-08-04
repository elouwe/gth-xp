import "@stdlib/tvm-dicts";
import "@stdlib/gas-payments";

@inline
 fun addrHash(a: address): int {

return beginCell().storeAddress(a).endCell().hash();
}

// --------- Constants ---------
const OP_ADD_XP = 0x1234;
const OP_ADD_XP_WITH_ID = 0x5678;
const OP_UPGRADE = 0x8765;
const CONTRACT_VERSION = 4;
const ERR_NOT_OWNER = 401;
const ERR_OVERFLOW = 402;
const ERR_TOO_SOON = 403;
const ERR_INVALID_OP = 404;
const MIN_TIMEOUT = 60;
const MAX_HISTORY = 100;
const MAX_XP_PER_OP = 1000000;

const KEY_LEN = 256;

@pure
fun newDict(): dict asm "NEWDICT";

// ------- Storage Helpers -------
@inline
fun LoadState(): (slice, int, int, cell?, cell?) {
    var raw: cell = contract.getData();
    var s: slice = raw.beginParse();

    if (s.remainingBitsCount() == 0) {
        return (s, CONTRACT_VERSION, 0, null, null);
    }

    var owner: slice = s.loadAddress() as slice;
    var ver: int = s.loadUint(16);
    var lastOpTime: int = s.loadUint(64);
    var balanceDict: cell? = s.loadDict();
    var historyDict: cell? = s.loadDict();

    return (owner, ver, lastOpTime, balanceDict, historyDict);
}

@inline
fun StoreState(owner: slice, ver: int, lastOpTime: int, balanceDict: cell?, historyDict: cell?) {
    contract.setData(
        beginCell()
            .storeSlice(owner)
            .storeUint(ver, 16)
            .storeUint(lastOpTime, 64)
            .storeDict(balanceDict)
            .storeDict(historyDict)
        .endCell()
    );
}


// ------- Helpers: dict utils -------
@inline
fun dictLenAndOldestKey(d: dict): (int, int) {
    var n: int = 0;
    var oldestKey: int = 0;
    var oldestTime: int = 2147483647;

    var (k_opt: int?, v_opt: slice?, ok: bool) = d.uDictGetFirst(KEY_LEN);
    var k: int = 0;

    while (ok) {
        k = k_opt!;             
        var vs: slice = v_opt!;

        var amount: int = vs.loadUint(64);
        var ts: int = vs.loadUint(64);

        if (ts < oldestTime) {
            oldestTime = ts;
            oldestKey = k;
        }
        n += 1;

        (k_opt, v_opt, ok) = d.uDictGetNext(KEY_LEN, k);
    }
    return (n, oldestKey);
}

@inline

@inline
fun generateOpId(txHash: int, timestamp: int): int {
    var c: cell = beginCell()
        .storeUint(txHash, 256)
        .storeUint(timestamp, 64)
        .endCell();
    return c.hash();
}

// --------- Entry Point ---------
fun onInternalMessage(msgValue: int, inMsg: cell, inBody: slice): void {
    var ts: int = blockchain.now();
    var txHash: int = inMsg.hash();

    if (inBody.remainingBitsCount() == 0) {
        acceptExternalMessage();
        var cs: slice     = inMsg.beginParse();
        cs.loadUint(4);
        var sender: address = cs.loadAddress();
        cs.loadCoins();
        cs.loadUint(64);
        cs.loadUint(32);
        var (owner0, ver0, lastOp0, balanceDict0, historyDict0) = LoadState();
        if (owner0.remainingBitsCount() == 0) {
            StoreState(sender as slice, CONTRACT_VERSION, 0, balanceDict0, historyDict0);
        }
        return;
    }

    var op: int = inBody.loadUint(32);
    inBody.loadUint(4);

    if ((op == OP_ADD_XP) | (op == OP_ADD_XP_WITH_ID)) {
        var userAddr: address = inBody.loadAddress();
        var   amount: int    = inBody.loadUint(64);
        var   opId: int     = 0;

        assert(amount <= MAX_XP_PER_OP) throw ERR_OVERFLOW;

        if (op == OP_ADD_XP_WITH_ID) {
            opId = inBody.loadUint(256);
        } else {
            opId = generateOpId(txHash, ts);
        }

        var cs: slice     = inMsg.beginParse();
        cs.loadUint(4);
        var sender: address = cs.loadAddress();
        cs.loadCoins();
        cs.loadUint(64);
        cs.loadUint(32);

        var (owner, ver, lastOpTime, balanceDict, historyDict) = LoadState();
        assert(addrHash(sender) == addrHash(owner as address)) throw ERR_NOT_OWNER;
if (lastOpTime > 0) {
            assert(ts - lastOpTime >= MIN_TIMEOUT) throw ERR_TOO_SOON;
        }
        acceptExternalMessage();

        var userKey: int = addrHash(userAddr);

        var (c, found) = balanceDict.uDictGetRef(KEY_LEN, userKey);
        var oldXp: int = 0;
        if (found && (c != null)) {
            var cs: slice = c.beginParse();
            oldXp = cs.loadUint(64);
        }
        var newXp: int = oldXp + amount;
        assert(newXp >= oldXp) throw ERR_OVERFLOW;
        assert(newXp <= 18446744073709551615) throw ERR_OVERFLOW;
        var b: builder = beginCell().storeUint(newXp, 64);
        balanceDict.uDictSetRef(KEY_LEN, userKey, b.endCell());

        var (userHistory, userFound) = historyDict.uDictGetRef(KEY_LEN, userKey);
        var opBuilder: builder = beginCell()
            .storeUint(amount, 64)
            .storeUint(ts, 64)
            .storeUint(opId, 256);

        userHistory.uDictSetRef(KEY_LEN, opId, opBuilder.endCell());
        userHistory = trimHistoryIfNeeded(userHistory, MAX_HISTORY);
        historyDict.uDictSetRef(KEY_LEN, userKey, beginCell().storeDict(userHistory).endCell());

        StoreState(owner, ver, ts, balanceDict, historyDict);
        return;
    }
    
    if (op == OP_UPGRADE) {
        var cs: slice     = inMsg.beginParse();
        cs.loadUint(4);
        var sender: address = cs.loadAddress();
        
        var (owner, ver, lastOpTime, balanceDict, historyDict) = LoadState();
        assert(addrHash(sender) == addrHash(owner as address)) throw ERR_NOT_OWNER;
        
        var newCode: cell = inBody.loadRef();
        acceptExternalMessage();
        
        contract.setCodePostponed(newCode);
        StoreState(owner, ver + 1, lastOpTime, balanceDict, historyDict);
        return;
    }

    throw ERR_INVALID_OP;
}

// --------- Get Methods ---------
get fun get_xp(args: slice): int {
    if (args.remainingBitsCount() == 0) { return 0; }
    try {
        var userAddr: address = args.loadAddress();
        var key: int = addrHash(userAddr);
        var (O, V, T, balanceDict, H) = LoadState();
        if ((balanceDict == null)) { return 0; }
        var (v, found) = balanceDict.uDictGet(KEY_LEN, key);
        if (!found || (v == null)) { return 0; }
        return v.loadUint(64);
    } catch (e) {
        return 0;
    }
}

get fun get_user_history(args: slice): cell? {
    if (args.remainingBitsCount() == 0) { return null; }
    var userAddr: address = args.loadAddress();
    var key: int = addrHash(userAddr);
    var (O, V, T, B, historyDict) = LoadState();
    var (history, found) = historyDict.uDictGetRef(KEY_LEN, key);
    return found ? history : null;
}

get fun get_owner(): slice {
    var (owner, V, T, D, H) = LoadState();
    return owner;
}

get fun get_version(): int {
    var (O, ver, T, D, H) = LoadState();
    return ver;
}

get fun get_last_op_time(): int {
    var (O, V, lastOpTime, D, H) = LoadState();
    return lastOpTime;
}

get fun get_xp_key(args: slice): int {
    if (args.remainingBitsCount() == 0) { return 0; }
    var userAddr: address = args.loadAddress();
    return addrHash(userAddr);
}

@inline
fun trimHistoryIfNeeded(d: dict, max: int): dict {
    var (n, oldestKey) = dictLenAndOldestKey(d);
    if (n <= max) {
        return d;
    }
    d.uDictDelete(KEY_LEN, oldestKey);
    return d;
}
