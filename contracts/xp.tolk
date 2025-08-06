import "@stdlib/tvm-dicts";
import "@stdlib/gas-payments";

@inline
fun addrHash(a: address): int {
    return beginCell().storeAddress(a).endCell().hash();
}

// --------- Constants ---------
const OP_ADD_XP: int = 0x1234;
const OP_ADD_XP_WITH_ID: int = 0x5678;
const OP_UPGRADE: int = 0x8765;
const CONTRACT_VERSION: int = 4;
const ERR_NOT_OWNER: int = 401;
const ERR_OVERFLOW: int = 402;
const ERR_TOO_SOON: int = 403;
const ERR_INVALID_OP: int = 404;
const MIN_TIMEOUT: int = 60;
const MAX_HISTORY: int = 100;
const MAX_XP_PER_OP: int = 1000000;

const KEY_LEN: int = 256;

@pure
fun newDict(): dict asm "NEWDICT";

// ------- Storage Helpers -------
@inline
fun LoadState(): (slice, int, int, dict, dict) {
    var raw: cell = contract.getData();
    var s: slice = raw.beginParse();

    if (s.remainingBitsCount() == 0) {
        return (s, CONTRACT_VERSION, 0, newDict(), newDict());
    }

    var owner: slice = s.loadAddress() as slice;
    var ver: int = s.loadUint(16);
    var lastOpTime: int = s.loadUint(64);
    var balanceDict: dict = s.loadDict();
    var historyDict: dict = s.loadDict();

    return (owner, ver, lastOpTime, balanceDict, historyDict);
}

@inline
fun StoreState(owner: slice, ver: int, lastOpTime: int, balanceDict: dict, historyDict: dict) {
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

        if (vs.remainingBitsCount() == 0 && vs.remainingRefsCount() > 0) {
            vs = vs.loadRef().beginParse();
        }

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

    var body: slice = inBody;
    if (body.remainingBitsCount() == 0 && body.remainingRefsCount() > 0) {
        body = body.loadRef().beginParse();
    }

    if (body.remainingBitsCount() == 0 && body.remainingRefsCount() == 0) {
        acceptExternalMessage();

        var cs0: slice = inMsg.beginParse();
        cs0.loadUint(4);                          // tag + flags
        var sender0: address = cs0.loadAddress(); // src
        cs0.loadAddress();                        // dest
        cs0.loadCoins();                          // value.grams
        cs0.loadDict();                           // value.other
        cs0.loadCoins();                          // ihr_fee
        cs0.loadCoins();                          // fwd_fee
        cs0.loadUint(64);                         // created_lt
        cs0.loadUint(32);                         // created_at

        var (owner0, ver0, lastOp0, balanceDict0, historyDict0) = LoadState();
        if (owner0.remainingBitsCount() == 0) {
            StoreState(sender0 as slice, CONTRACT_VERSION, 0, balanceDict0, historyDict0);
        }
        return;
    }

    var op: int = body.loadUint(32);
    body.loadUint(4); 

    if ((op == OP_ADD_XP) || (op == OP_ADD_XP_WITH_ID)) {
        var userAddr: address = body.loadAddress();
        var amount: int = body.loadUint(64);
        var opId: int = 0;

        assert(amount <= MAX_XP_PER_OP) throw ERR_OVERFLOW;

    if (op == OP_ADD_XP_WITH_ID) {
        if (body.remainingBitsCount() >= 256) {
            opId = body.loadUint(256);
        } else {
            opId = generateOpId(txHash, ts);
        }
    } else {
        opId = generateOpId(txHash, ts);
    }

    var cs: slice = inMsg.beginParse();
    cs.loadUint(4);
    var sender: address = cs.loadAddress(); // src

        var (owner, ver, lastOpTime, balanceDict, historyDict) = LoadState();
        assert(addrHash(sender) == addrHash(owner as address)) throw ERR_NOT_OWNER;
        if (lastOpTime > 0) {
            assert(ts - lastOpTime >= MIN_TIMEOUT) throw ERR_TOO_SOON;
        }
        acceptExternalMessage();

        // balances[user] += amount
        var userKey: int = addrHash(userAddr);

        var (c, found) = balanceDict.uDictGetRef(KEY_LEN, userKey);
        var oldXp: int = 0;
        if (found && (c != null)) {
            var csb: slice = c.beginParse();
            oldXp = csb.loadUint(64);
        }
        var newXp: int = oldXp + amount;
        assert(newXp >= oldXp) throw ERR_OVERFLOW;
        assert(newXp <= 18446744073709551615) throw ERR_OVERFLOW;
        var b: builder = beginCell().storeUint(newXp, 64);
        balanceDict.uDictSetRef(KEY_LEN, userKey, b.endCell());

        // history[user][opId] = cell(amount, ts, opId)
        var (hCell, hFound) = historyDict.uDictGetRef(KEY_LEN, userKey);
        var userHistory: dict = newDict();
        if (hFound && (hCell != null)) {
            var hs: slice = hCell.beginParse();
            userHistory = hs.loadDict();
        }

        var opBuilder: builder = beginCell()
            .storeUint(amount, 64)
            .storeUint(ts, 64)
            .storeUint(opId, 256);

        userHistory.uDictSetRef(KEY_LEN, opId, opBuilder.endCell());    
        userHistory = trimHistoryIfNeeded(userHistory, MAX_HISTORY);

        historyDict.uDictSetRef(                                       
            KEY_LEN,
            userKey,
            beginCell().storeDict(userHistory).endCell()
        );

        StoreState(owner, ver, ts, balanceDict, historyDict);
        return; 
    }
    
    if (op == OP_UPGRADE) {
        var csu: slice = inMsg.beginParse();
        csu.loadUint(4);
        var senderU: address = csu.loadAddress();
        csu.loadAddress();
        csu.loadCoins();
        csu.loadDict();
        csu.loadCoins();
        csu.loadCoins();
        csu.loadUint(64);
        csu.loadUint(32);
        
        var (ownerU, verU, lastOpU, balanceDictU, historyDictU) = LoadState();
        assert(addrHash(senderU) == addrHash(ownerU as address)) throw ERR_NOT_OWNER;
        
        var newCode: cell = body.loadRef();
        acceptExternalMessage();
        
        contract.setCodePostponed(newCode);
        StoreState(ownerU, verU + 1, lastOpU, balanceDictU, historyDictU);
        return;
    }

    throw ERR_INVALID_OP;
}

// --------- Get Methods ---------
get fun get_xp(args: slice): int {
    if (args.remainingBitsCount() == 0) {
        return 0;
    }

    try {
        var userAddr: address = args.loadAddress();
        var key: int = addrHash(userAddr);
        var (O, V, T, balanceDict, H) = LoadState();
        if (balanceDict == null) {
            return 0;
        }
        
        var (c, found) = balanceDict.uDictGetRef(KEY_LEN, key);
        if (!found || c == null) {
            return 0;
        }
        
        var s: slice = c.beginParse();
        return s.loadUint(64);
    } catch (e) {
        return 0;
    }
}

get fun get_user_history(args: slice): cell? {
    if (args.remainingBitsCount() == 0) {
        return null;
    }
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
    if (args.remainingBitsCount() == 0) {
        return 0;
    }
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
