// Standard library for funC
//

/*
    This file is part of TON FunC Standard Library.

    FunC Standard Library is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    FunC Standard Library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

*/

/*
  # Tuple manipulation primitives
  The names and the types are mostly self-explaining.
  See [polymorhism with forall](https://ton.org/docs/#/func/functions?id=polymorphism-with-forall)
  for more info on the polymorphic functions.

  Note that currently values of atomic type `tuple` can't be cast to composite tuple type (e.g. `[int, cell]`)
  and vise versa.
*/

/*
  # Lisp-style lists

  Lists can be represented as nested 2-elements tuples.
  Empty list is conventionally represented as TVM `null` value (it can be obtained by calling [null()]).
  For example, tuple `(1, (2, (3, null)))` represents list `[1, 2, 3]`. Elements of a list can be of different types.
*/


/// Adds an element to the beginning of lisp-style list.
@pure
fun cons<X>(head: X, tail: tuple): tuple
    asm "CONS";

/// Extracts the head and the tail of lisp-style list.
@pure
fun uncons<X>(list: tuple): (X, tuple)
    asm "UNCONS";

/// Extracts the tail and the head of lisp-style list.
@pure
fun listNext<X>(list: tuple): (tuple, X)
    asm( -> 1 0) "UNCONS";

/// Returns the head of lisp-style list.
@pure
fun car<X>(list: tuple): X
    asm "CAR";

/// Returns the tail of lisp-style list.
@pure
fun cdr(list: tuple): tuple
    asm "CDR";

/// Creates tuple with zero elements.
@pure
fun emptyTuple(): tuple
    asm "NIL";

/// Appends a value `x` to a `Tuple t = (x1, ..., xn)`, but only if the resulting `Tuple t' = (x1, ..., xn, x)`
/// is of length at most 255. Otherwise throws a type check exception.
@pure
fun tpush<X>(t: tuple, value: X): tuple
    asm "TPUSH";
@pure
fun tuple.tpush<X>(mutate self, value: X): void
    asm "TPUSH";

/// Creates a tuple of length one with given argument as element.
@pure
fun single<X>(x: X): [X]
    asm "SINGLE";

/// Unpacks a tuple of length one
@pure
fun unsingle<X>(t: [X]): X
    asm "UNSINGLE";

/// Creates a tuple of length two with given arguments as elements.
@pure
fun pair<X, Y>(x: X, y: Y): [X, Y]
    asm "PAIR";

/// Unpacks a tuple of length two
@pure
fun unpair<X, Y>(t: [X, Y]): (X, Y)
    asm "UNPAIR";

/// Creates a tuple of length three with given arguments as elements.
@pure
fun triple<X, Y, Z>(x: X, y: Y, z: Z): [X, Y, Z]
    asm "TRIPLE";

/// Unpacks a tuple of length three
@pure
fun untriple<X, Y, Z>(t: [X, Y, Z]): (X, Y, Z)
    asm "UNTRIPLE";

/// Creates a tuple of length four with given arguments as elements.
@pure
fun tuple4<X, Y, Z, W>(x: X, y: Y, z: Z, w: W): [X, Y, Z, W]
    asm "4 TUPLE";

/// Unpacks a tuple of length four
@pure
fun untuple4<X, Y, Z, W>(t: [X, Y, Z, W]): (X, Y, Z, W)
    asm "4 UNTUPLE";

/// Returns the first element of a tuple (with unknown element types).
@pure
fun first<X>(t: tuple): X
    asm "FIRST";

/// Returns the second element of a tuple (with unknown element types).
@pure
fun second<X>(t: tuple): X
    asm "SECOND";

/// Returns the third element of a tuple (with unknown element types).
@pure
fun third<X>(t: tuple): X
    asm "THIRD";

/// Returns the fourth element of a tuple (with unknown element types).
@pure
fun fourth<X>(t: tuple): X
    asm "3 INDEX";

/// Returns the first element of a pair tuple.
@pure
fun pairFirst<X, Y>(p: [X, Y]): X
    asm "FIRST";

/// Returns the second element of a pair tuple.
@pure
fun pairSecond<X, Y>(p: [X, Y]): Y
    asm "SECOND";

/// Returns the first element of a triple tuple.
@pure
fun tripleFirst<X, Y, Z>(p: [X, Y, Z]): X
    asm "FIRST";

/// Returns the second element of a triple tuple.
@pure
fun tripleSecond<X, Y, Z>(p: [X, Y, Z]): Y
    asm "SECOND";

/// Returns the third element of a triple tuple.
@pure
fun tripleThird<X, Y, Z>(p: [X, Y, Z]): Z
    asm "THIRD";


/// Push null element (casted to given type)
/// By the TVM type `Null` FunC represents absence of a value of some atomic type.
/// So `null` can actually have any atomic type.
@pure
fun null<X>(): X
    asm "PUSHNULL";

/// Moves a variable [x] to the top of the stack
fun X.impureTouch<X>(mutate self): void
    asm "NOP";



/// Returns the current Unix time as an Integer
@pure
fun now(): int
    asm "NOW";

/// Returns the internal address of the current smart contract as a Slice with a `MsgAddressInt`.
/// If necessary, it can be parsed further using primitives such as [parse_std_addr].
@pure
fun myAddress(): address
    asm "MYADDR";

/// Returns the balance of the smart contract as a tuple consisting of an int
/// (balance in nanotoncoins) and a `cell`
/// (a dictionary with 32-bit keys representing the balance of "extra currencies")
/// at the start of Computation Phase.
/// Note that RAW primitives such as [send_raw_message] do not update this field.
@pure
fun getBalance(): [int, cell]
    asm "BALANCE";

/// Returns the logical time of the current transaction.
@pure
fun curLt(): int
    asm "LTIME";

/// Returns the starting logical time of the current block.
@pure
fun blockLt(): int
    asm "BLOCKLT";

/// Computes the representation hash of a `cell` [c] and returns it as a 256-bit unsigned integer `x`.
/// Useful for signing and checking signatures of arbitrary entities represented by a tree of cells.
@pure
fun cellHash(c: cell): int
    asm "HASHCU";

/// Computes the hash of a `slice s` and returns it as a 256-bit unsigned integer `x`.
/// The result is the same as if an ordinary cell containing only data and references from `s` had been created
/// and its hash computed by [cell_hash].
@pure
fun sliceHash(s: slice): int
    asm "HASHSU";

/// Computes sha256 of the data bits of `slice` [s]. If the bit length of `s` is not divisible by eight,
/// throws a cell underflow exception. The hash value is returned as a 256-bit unsigned integer `x`.
@pure
fun stringHash(s: slice): int
    asm "SHA256U";

/*
  # Signature checks
*/

/// Checks the Ed25519-`signature` of a `hash` (a 256-bit unsigned integer, usually computed as the hash of some data)
/// using [public_key] (also represented by a 256-bit unsigned integer).
/// The signature must contain at least 512 data bits; only the first 512 bits are used.
/// The result is `−1` if the signature is valid, `0` otherwise.
/// Note that `CHKSIGNU` creates a 256-bit slice with the hash and calls `CHKSIGNS`.
/// That is, if [hash] is computed as the hash of some data, these data are hashed twice,
/// the second hashing occurring inside `CHKSIGNS`.
@pure
fun checkSignature(hash: int, signature: slice, publicKey: int): int
    asm "CHKSIGNU";

/// Checks whether [signature] is a valid Ed25519-signature of the data portion of `slice data` using `public_key`,
/// similarly to [check_signature].
/// If the bit length of [data] is not divisible by eight, throws a cell underflow exception.
/// The verification of Ed25519 signatures is the standard one,
/// with sha256 used to reduce [data] to the 256-bit number that is actually signed.
@pure
fun checkDataSignature(data: slice, signature: slice, publicKey: int): int
    asm "CHKSIGNS";

/*--
  # Computation of boc size
  The primitives below may be useful for computing storage fees of user-provided data.
*/

/// Returns `(x, y, z, -1)` or `(null, null, null, 0)`.
/// Recursively computes the count of distinct cells `x`, data bits `y`, and cell references `z`
/// in the DAG rooted at `cell` [c], effectively returning the total storage used by this DAG taking into account
/// the identification of equal cells.
/// The values of `x`, `y`, and `z` are computed by a depth-first traversal of this DAG,
/// with a hash table of visited cell hashes used to prevent visits of already-visited cells.
/// The total count of visited cells `x` cannot exceed non-negative [max_cells];
/// otherwise the computation is aborted before visiting the `(max_cells + 1)`-st cell and
/// a zero flag is returned to indicate failure. If [c] is `null`, returns `x = y = z = 0`.
fun computeDataSize(c: cell, maxCells: int): (int, int, int)
    asm "CDATASIZE";

/// Similar to [compute_data_size?], but accepting a `slice` [s] instead of a `cell`.
/// The returned value of `x` does not take into account the cell that contains the `slice` [s] itself;
/// however, the data bits and the cell references of [s] are accounted for in `y` and `z`.
fun sliceComputeDataSize(s: slice, maxCells: int): (int, int, int)
    asm "SDATASIZE";

/// A non-quiet version of [compute_data_size?] that throws a cell overflow exception (`8`) on failure.
@pure
fun isComputeDataSize(c: cell, maxCells: int): (int, int, int, int)
    asm "CDATASIZEQ NULLSWAPIFNOT2 NULLSWAPIFNOT";

/// A non-quiet version of [slice_compute_data_size?] that throws a cell overflow exception (8) on failure.
@pure
fun isSliceComputeDataSize(c: cell, maxCells: int): (int, int, int, int)
    asm "SDATASIZEQ NULLSWAPIFNOT2 NULLSWAPIFNOT";

/// Throws an exception with exit_code excno if cond is not 0 (commented since implemented in compilator)
// () throw_if(int excno, int cond) impure asm "THROWARGIF";

/*-
  # Debug primitives
  Only works for local TVM execution with debug level verbosity
*/
/// Dumps the stack (at most the top 255 values) and shows the total stack depth.
fun dumpStack(): void
    asm "DUMPSTK";

/*
  # Persistent storage save and load
*/

/// Returns the persistent contract storage cell. It can be parsed or modified with slice and builder primitives later.
@pure
fun getData(): cell
    asm "c4 PUSH";

/// Sets `cell` [c] as persistent contract data. You can update persistent contract storage with this primitive.
fun setData(c: cell): void
    asm "c4 POP";

/*
  # Continuation primitives
*/
/// Usually `c3` has a continuation initialized by the whole code of the contract. It is used for function calls.
/// The primitive returns the current value of `c3`.
fun getC3(): continuation
    asm "c3 PUSH";

/// Updates the current value of `c3`. Usually, it is used for updating smart contract code in run-time.
/// Note that after execution of this primitive the current code
/// (and the stack of recursive function calls) won't change,
/// but any other function call will use a function from the new code.
fun setC3(c: continuation): void
    asm "c3 POP";

/// Transforms a `slice` [s] into a simple ordinary continuation `c`, with `c.code = s` and an empty stack and savelist.
fun bless(s: slice): continuation
    asm "BLESS";

/*--
  # Gas related primitives
*/

/// Sets current gas limit `gl` to its maximal allowed value `gm`, and resets the gas credit `gc` to zero,
/// decreasing the value of `gr` by `gc` in the process.
/// In other words, the current smart contract agrees to buy some gas to finish the current transaction.
/// This action is required to process external messages, which bring no value (hence no gas) with themselves.
///
/// For more details check [accept_message effects](https://docs.ton.org/develop/smart-contracts/guidelines/accept).
fun acceptMessage(): void
    asm "ACCEPT";

/// Sets current gas limit `gl` to the minimum of limit and `gm`, and resets the gas credit `gc` to zero.
/// If the gas consumed so far (including the present instruction) exceeds the resulting value of `gl`,
/// an (unhandled) out of gas exception is thrown before setting new gas limits.
/// Notice that [set_gas_limit] with an argument `limit ≥ 2^63 − 1` is equivalent to [accept_message].
fun setGasLimit(limit: int): void
    asm "SETGASLIMIT";

/// Commits the current state of registers `c4` (“persistent data”) and `c5` (“actions”)
/// so that the current execution is considered “successful” with the saved values even if an exception
/// in Computation Phase is thrown later.
fun commit(): void
    asm "COMMIT";

/// Not implemented
//() buy_gas(int gram) impure asm "BUYGAS";

/// Computes the amount of gas that can be bought for `amount` nanoTONs,
/// and sets `gl` accordingly in the same way as [set_gas_limit].
fun buyGas(amount: int): void
    asm "BUYGAS";

/// Computes the minimum of two integers [x] and [y].
@pure
fun min(x: int, y: int): int
    asm "MIN";

/// Computes the maximum of two integers [x] and [y].
@pure
fun max(x: int, y: int): int
    asm "MAX";

/// Sorts two integers.
@pure
fun minmax(x: int, y: int): (int, int)
    asm "MINMAX";

/// Computes the absolute value of an integer [x].
@pure
fun abs(x: int): int
    asm "ABS";

/*
  # Slice primitives

  It is said that a primitive _loads_ some data,
  if it returns the data and the remainder of the slice
  (so it can also be used as [modifying method](https://docs.ton.org/develop/func/statements#modifying-methods)).

  It is said that a primitive _preloads_ some data, if it returns only the data
  (it can be used as [non-modifying method](https://docs.ton.org/develop/func/statements#non-modifying-methods)).

  Unless otherwise stated, loading and preloading primitives read the data from a prefix of the slice.
*/


/// Converts a `cell` [c] into a `slice`. Notice that [c] must be either an ordinary cell,
/// or an exotic cell (see [TVM.pdf](https://ton-blockchain.github.io/docs/tvm.pdf), 3.1.2)
/// which is automatically loaded to yield an ordinary cell `c'`, converted into a `slice` afterwards.
@pure
fun beginParse(c: cell): slice
    asm "CTOS";

/// Checks if [s] is empty. If not, throws an exception.
fun endParse(s: slice): void
    asm "ENDS";

/// Loads the first reference from the slice.
@pure
fun slice.loadRef(mutate self): cell
    asm( -> 1 0) "LDREF";

/// Preloads the first reference from the slice.
@pure
fun preloadRef(s: slice): cell
    asm "PLDREF";

  /* Functions below are commented because are implemented on compilator level for optimisation */

/// Loads a signed [len]-bit integer from a slice [s].
// (slice, int) ~load_int(slice s, int len) asm(s len -> 1 0) "LDIX";

/// Loads an unsigned [len]-bit integer from a slice [s].
// (slice, int) ~load_uint(slice s, int len) asm( -> 1 0) "LDUX";

/// Preloads a signed [len]-bit integer from a slice [s].
// int preload_int(slice s, int len) asm "PLDIX";

/// Preloads an unsigned [len]-bit integer from a slice [s].
// int preload_uint(slice s, int len) asm "PLDUX";

/// Loads the first `0 ≤ len ≤ 1023` bits from slice [s] into a separate `slice s''`.
// (slice, slice) load_bits(slice s, int len) asm(s len -> 1 0) "LDSLICEX";

/// Preloads the first `0 ≤ len ≤ 1023` bits from slice [s] into a separate `slice s''`.
// slice preload_bits(slice s, int len) asm "PLDSLICEX";

/// Loads serialized amount of TonCoins (any unsigned integer up to `2^120 - 1`).
@pure
fun slice.loadGrams(mutate self): int
    asm( -> 1 0) "LDGRAMS";
@pure
fun slice.loadCoins(mutate self): int
    asm( -> 1 0) "LDGRAMS";

/// Returns all but the first `0 ≤ len ≤ 1023` bits of `slice` [s].
@pure
fun skipBits(s: slice, len: int): slice
    asm "SDSKIPFIRST";
@pure
fun slice.skipBits(mutate self, len: int): void
    asm "SDSKIPFIRST";

/// Returns the first `0 ≤ len ≤ 1023` bits of `slice` [s].
@pure
fun firstBits(s: slice, len: int): slice
    asm "SDCUTFIRST";

/// Returns all but the last `0 ≤ len ≤ 1023` bits of `slice` [s].
@pure
fun skipLastBits(s: slice, len: int): slice
    asm "SDSKIPLAST";
@pure
fun slice.skipLastBits(mutate self, len: int): void
    asm "SDSKIPLAST";

/// Returns the last `0 ≤ len ≤ 1023` bits of `slice` [s].
@pure
fun sliceLast(s: slice, len: int): slice
    asm "SDCUTLAST";

/// Loads a dictionary `D` (HashMapE) from `slice` [s].
/// (returns `null` if `nothing` constructor is used).
@pure
fun slice.loadDict(mutate self): cell
    asm( -> 1 0) "LDDICT";

/// Preloads a dictionary `D` from `slice` [s].
@pure
fun preloadDict(s: slice): cell
    asm "PLDDICT";

/// Loads a dictionary as [load_dict], but returns only the remainder of the slice.
@pure
fun skipDict(s: slice): slice
    asm "SKIPDICT";

/// Loads (Maybe ^Cell) from `slice` [s].
/// In other words loads 1 bit and if it is true
/// loads first ref and return it with slice remainder
/// otherwise returns `null` and slice remainder
@pure
fun slice.loadMaybeRef(mutate self): cell
    asm( -> 1 0) "LDOPTREF";

/// Preloads (Maybe ^Cell) from `slice` [s].
@pure
fun preloadMaybeRef(s: slice): cell
    asm "PLDOPTREF";


/// Returns the depth of `cell` [c].
/// If [c] has no references, then return `0`;
/// otherwise the returned value is one plus the maximum of depths of cells referred to from [c].
/// If [c] is a `null` instead of a cell, returns zero.
@pure
fun cellDepth(c: cell): int
    asm "CDEPTH";


/*
  # Slice size primitives
*/

/// Returns the number of references in `slice` [s].
@pure
fun sliceRefs(s: slice): int
    asm "SREFS";

/// Returns the number of data bits in `slice` [s].
@pure
fun sliceBits(s: slice): int
    asm "SBITS";

/// Returns both the number of data bits and the number of references in `slice` [s].
@pure
fun sliceBitsRefs(s: slice): (int, int)
    asm "SBITREFS";

/// Checks whether a `slice` [s] is empty (i.e., contains no bits of data and no cell references).
@pure
fun isSliceEmpty(s: slice): int
    asm "SEMPTY";

/// Checks whether `slice` [s] has no bits of data.
@pure
fun isSliceDataEmpty(s: slice): int
    asm "SDEMPTY";

/// Checks whether `slice` [s] has no references.
@pure
fun isSliceRefsEmpty(s: slice): int
    asm "SREMPTY";

/// Returns the depth of `slice` [s].
/// If [s] has no references, then returns `0`;
/// otherwise the returned value is one plus the maximum of depths of cells referred to from [s].
@pure
fun sliceDepth(s: slice): int
    asm "SDEPTH";

/*
  # Builder size primitives
*/

/// Returns the number of cell references already stored in `builder` [b]
@pure
fun builderRefs(b: builder): int
    asm "BREFS";

/// Returns the number of data bits already stored in `builder` [b].
@pure
fun builderBits(b: builder): int
    asm "BBITS";

/// Returns the depth of `builder` [b].
/// If no cell references are stored in [b], then returns 0;
/// otherwise the returned value is one plus the maximum of depths of cells referred to from [b].
@pure
fun builderDepth(b: builder): int
    asm "BDEPTH";

/*
  # Builder primitives
  It is said that a primitive _stores_ a value `x` into a builder `b`
  if it returns a modified version of the builder `b'` with the value `x` stored at the end of it.
  It can be used as [non-modifying method](https://docs.ton.org/develop/func/statements#non-modifying-methods).

  All the primitives below first check whether there is enough space in the `builder`,
  and only then check the range of the value being serialized.
*/

/// Creates a new empty `builder`.
@pure
fun beginCell(): builder
    asm "NEWC";

/// Converts a `builder` into an ordinary `cell`.
@pure
fun endCell(b: builder): cell
    asm "ENDC";

/// Stores a reference to `cell` [c] into `builder` [b].
@pure
fun storeRef(b: builder, c: cell): builder
    asm(c b) "STREF";

/// Stores an unsigned [len]-bit integer `x` into `b` for `0 ≤ len ≤ 256`.
// builder store_uint(builder b, int x, int len) asm(x b len) "STUX";

/// Stores a signed [len]-bit integer `x` into `b` for` 0 ≤ len ≤ 257`.
// builder store_int(builder b, int x, int len) asm(x b len) "STIX";


/// Stores `slice` [s] into `builder` [b]
@pure
fun storeSlice(b: builder, s: slice): builder
    asm "STSLICER";

/// Stores (serializes) an integer [x] in the range `0..2^120 − 1` into `builder` [b].
/// The serialization of [x] consists of a 4-bit unsigned big-endian integer `l`,
/// which is the smallest integer `l ≥ 0`, such that `x < 2^8l`,
/// followed by an `8l`-bit unsigned big-endian representation of [x].
/// If [x] does not belong to the supported range, a range check exception is thrown.
///
/// Store amounts of TonCoins to the builder as VarUInteger 16
@pure
fun storeGrams(b: builder, x: int): builder
    asm "STGRAMS";
@pure
fun storeCoins(b: builder, x: int): builder
    asm "STGRAMS";

/// Stores dictionary `D` represented by `cell` [c] or `null` into `builder` [b].
/// In other words, stores a `1`-bit and a reference to [c] if [c] is not `null` and `0`-bit otherwise.
@pure
fun storeDict(b: builder, c: cell): builder
    asm(c b) "STDICT";

/// Stores (Maybe ^Cell) to builder:
/// if cell is null store 1 zero bit
/// otherwise store 1 true bit and ref to cell
@pure
fun storeMaybeRef(b: builder, c: cell): builder
    asm(c b) "STOPTREF";


/*
  # Address manipulation primitives
  The address manipulation primitives listed below serialize and deserialize values according to the following TL-B scheme:
  ```TL-B
  addr_none$00 = MsgAddressExt;
  addr_extern$01 len:(## 8) external_address:(bits len)
               = MsgAddressExt;
  anycast_info$_ depth:(#<= 30) { depth >= 1 }
    rewrite_pfx:(bits depth) = Anycast;
  addr_std$10 anycast:(Maybe Anycast)
    workchain_id:int8 address:bits256 = MsgAddressInt;
  addr_var$11 anycast:(Maybe Anycast) addr_len:(## 9)
    workchain_id:int32 address:(bits addr_len) = MsgAddressInt;
  _ _:MsgAddressInt = MsgAddress;
  _ _:MsgAddressExt = MsgAddress;

  int_msg_info$0 ihr_disabled:Bool bounce:Bool bounced:Bool
    src:MsgAddress dest:MsgAddressInt
    value:CurrencyCollection ihr_fee:Grams fwd_fee:Grams
    created_lt:uint64 created_at:uint32 = CommonMsgInfoRelaxed;
  ext_out_msg_info$11 src:MsgAddress dest:MsgAddressExt
    created_lt:uint64 created_at:uint32 = CommonMsgInfoRelaxed;
  ```
  A deserialized `MsgAddress` is represented by a tuple `t` as follows:

  - `addr_none` is represented by `t = (0)`,
    i.e., a tuple containing exactly one integer equal to zero.
  - `addr_extern` is represented by `t = (1, s)`,
    where slice `s` contains the field `external_address`. In other words, `
    t` is a pair (a tuple consisting of two entries), containing an integer equal to one and slice `s`.
  - `addr_std` is represented by `t = (2, u, x, s)`,
    where `u` is either a `null` (if `anycast` is absent) or a slice `s'` containing `rewrite_pfx` (if anycast is present).
    Next, integer `x` is the `workchain_id`, and slice `s` contains the address.
  - `addr_var` is represented by `t = (3, u, x, s)`,
    where `u`, `x`, and `s` have the same meaning as for `addr_std`.
*/

/// Loads from slice [s] the only prefix that is a valid `MsgAddress`,
/// and returns both this prefix `s'` and the remainder `s''` of [s] as slices.
@pure
fun slice.loadMsgAddr(mutate self): address
    asm( -> 1 0) "LDMSGADDR";

/// Decomposes slice [s] containing a valid `MsgAddress` into a `tuple t` with separate fields of this `MsgAddress`.
/// If [s] is not a valid `MsgAddress`, a cell deserialization exception is thrown.
@pure
fun parseAddr(s: slice): tuple
    asm "PARSEMSGADDR";

/// Parses slice [s] containing a valid `MsgAddressInt` (usually a `msg_addr_std`),
/// applies rewriting from the anycast (if present) to the same-length prefix of the address,
/// and returns both the workchain and the 256-bit address as integers.
/// If the address is not 256-bit, or if [s] is not a valid serialization of `MsgAddressInt`,
/// throws a cell deserialization exception.
@pure
fun parseStdAddr(s: slice): (int, int)
    asm "REWRITESTDADDR";

/// A variant of [parse_std_addr] that returns the (rewritten) address as a slice [s],
/// even if it is not exactly 256 bit long (represented by a `msg_addr_var`).
@pure
fun parseVarAddr(s: slice): (int, slice)
    asm "REWRITEVARADDR";

/*
  # Dictionary primitives
*/


/// Sets the value associated with [key_len]-bit key signed index in dictionary [dict] to [value] (cell),
/// and returns the resulting dictionary.
@pure
fun idictSetRef(dict: cell, keyLen: int, index: int, value: cell): cell
    asm(value index dict keyLen) "DICTISETREF";
@pure
fun cell.idictSetRef(mutate self, keyLen: int, index: int, value: cell): void
    asm(value index self keyLen) "DICTISETREF";

/// Sets the value associated with [key_len]-bit key unsigned index in dictionary [dict] to [value] (cell),
/// and returns the resulting dictionary.
@pure
fun udictSetRef(dict: cell, keyLen: int, index: int, value: cell): cell
    asm(value index dict keyLen) "DICTUSETREF";
@pure
fun cell.udictSetRef(mutate self, keyLen: int, index: int, value: cell): void
    asm(value index self keyLen) "DICTUSETREF";

@pure
fun idictGetRef(dict: cell, keyLen: int, index: int): cell
    asm(index dict keyLen) "DICTIGETOPTREF";
@pure
fun isIdictGetRef(dict: cell, keyLen: int, index: int): (cell, int)
    asm(index dict keyLen) "DICTIGETREF" "NULLSWAPIFNOT";
@pure
fun isUdictGetRef(dict: cell, keyLen: int, index: int): (cell, int)
    asm(index dict keyLen) "DICTUGETREF" "NULLSWAPIFNOT";
@pure
fun idictSetGetRef(dict: cell, keyLen: int, index: int, value: cell): (cell, cell)
    asm(value index dict keyLen) "DICTISETGETOPTREF";
@pure
fun udictSetGetRef(dict: cell, keyLen: int, index: int, value: cell): (cell, cell)
    asm(value index dict keyLen) "DICTUSETGETOPTREF";
@pure
fun isIdictDelete(dict: cell, keyLen: int, index: int): (cell, int)
    asm(index dict keyLen) "DICTIDEL";
@pure
fun isUdictDelete(dict: cell, keyLen: int, index: int): (cell, int)
    asm(index dict keyLen) "DICTUDEL";
@pure
fun isIdictGet(dict: cell, keyLen: int, index: int): (slice, int)
    asm(index dict keyLen) "DICTIGET" "NULLSWAPIFNOT";
@pure
fun isUdictGet(dict: cell, keyLen: int, index: int): (slice, int)
    asm(index dict keyLen) "DICTUGET" "NULLSWAPIFNOT";
@pure
fun isIdictDeleteGet(dict: cell, keyLen: int, index: int): (cell, slice, int)
    asm(index dict keyLen) "DICTIDELGET" "NULLSWAPIFNOT";
@pure
fun isUdictDeleteGet(dict: cell, keyLen: int, index: int): (cell, slice, int)
    asm(index dict keyLen) "DICTUDELGET" "NULLSWAPIFNOT";
@pure
fun cell.isIdictDeleteGet(mutate self, keyLen: int, index: int): (slice, int)
    asm(index self keyLen) "DICTIDELGET" "NULLSWAPIFNOT";
@pure
fun cell.isUdictDeleteGet(mutate self, keyLen: int, index: int): (slice, int)
    asm(index self keyLen) "DICTUDELGET" "NULLSWAPIFNOT";
@pure
fun udictSet(dict: cell, keyLen: int, index: int, value: slice): cell
    asm(value index dict keyLen) "DICTUSET";
@pure
fun cell.udictSet(mutate self, keyLen: int, index: int, value: slice): void
    asm(value index self keyLen) "DICTUSET";
@pure
fun idictSet(dict: cell, keyLen: int, index: int, value: slice): cell
    asm(value index dict keyLen) "DICTISET";
@pure
fun cell.idictSet(mutate self, keyLen: int, index: int, value: slice): void
    asm(value index self keyLen) "DICTISET";
@pure
fun dictSet(dict: cell, keyLen: int, index: slice, value: slice): cell
    asm(value index dict keyLen) "DICTSET";
@pure
fun cell.dictSet(mutate self, keyLen: int, index: slice, value: slice): void
    asm(value index self keyLen) "DICTSET";
@pure
fun isUdictAdd(dict: cell, keyLen: int, index: int, value: slice): (cell, int)
    asm(value index dict keyLen) "DICTUADD";
@pure
fun isUdictReplace(dict: cell, keyLen: int, index: int, value: slice): (cell, int)
    asm(value index dict keyLen) "DICTUREPLACE";
@pure
fun isIdictAdd(dict: cell, keyLen: int, index: int, value: slice): (cell, int)
    asm(value index dict keyLen) "DICTIADD";
@pure
fun isIdictReplace(dict: cell, keyLen: int, index: int, value: slice): (cell, int)
    asm(value index dict keyLen) "DICTIREPLACE";
@pure
fun udictSetBuilder(dict: cell, keyLen: int, index: int, value: builder): cell
    asm(value index dict keyLen) "DICTUSETB";
@pure
fun cell.udictSetBuilder(mutate self, keyLen: int, index: int, value: builder): void
    asm(value index self keyLen) "DICTUSETB";
@pure
fun idictSetBuilder(dict: cell, keyLen: int, index: int, value: builder): cell
    asm(value index dict keyLen) "DICTISETB";
@pure
fun cell.idictSetBuilder(mutate self, keyLen: int, index: int, value: builder): void
    asm(value index self keyLen) "DICTISETB";
@pure
fun dictSetBuilder(dict: cell, keyLen: int, index: slice, value: builder): cell
    asm(value index dict keyLen) "DICTSETB";
@pure
fun cell.dictSetBuilder(mutate self, keyLen: int, index: slice, value: builder): void
    asm(value index self keyLen) "DICTSETB";
@pure
fun isUdictAddBuilder(dict: cell, keyLen: int, index: int, value: builder): (cell, int)
    asm(value index dict keyLen) "DICTUADDB";
@pure
fun isUdictReplaceBuilder(dict: cell, keyLen: int, index: int, value: builder): (cell, int)
    asm(value index dict keyLen) "DICTUREPLACEB";
@pure
fun isIdictAddBuilder(dict: cell, keyLen: int, index: int, value: builder): (cell, int)
    asm(value index dict keyLen) "DICTIADDB";
@pure
fun isIdictReplaceBuilder(dict: cell, keyLen: int, index: int, value: builder): (cell, int)
    asm(value index dict keyLen) "DICTIREPLACEB";
@pure
fun udictDeleteGetMin(dict: cell, keyLen: int): (cell, int, slice, int)
    asm(-> 0 2 1 3) "DICTUREMMIN" "NULLSWAPIFNOT2";
@pure
fun cell.`udict::delete_get_min`(mutate self, keyLen: int): (int, slice, int)
    asm(-> 0 2 1 3) "DICTUREMMIN" "NULLSWAPIFNOT2";
@pure
fun idictDeleteGetMin(dict: cell, keyLen: int): (cell, int, slice, int)
    asm(-> 0 2 1 3) "DICTIREMMIN" "NULLSWAPIFNOT2";
@pure
fun cell.`idict::delete_get_min`(mutate self, keyLen: int): (int, slice, int)
    asm(-> 0 2 1 3) "DICTIREMMIN" "NULLSWAPIFNOT2";
@pure
fun dictDeleteGetMin(dict: cell, keyLen: int): (cell, slice, slice, int)
    asm(-> 0 2 1 3) "DICTREMMIN" "NULLSWAPIFNOT2";
@pure
fun cell.`dict::delete_get_min`(mutate self, keyLen: int): (slice, slice, int)
    asm(-> 0 2 1 3) "DICTREMMIN" "NULLSWAPIFNOT2";
@pure
fun udictDeleteGetMax(dict: cell, keyLen: int): (cell, int, slice, int)
    asm(-> 0 2 1 3) "DICTUREMMAX" "NULLSWAPIFNOT2";
@pure
fun cell.`udict::delete_get_max`(mutate self, keyLen: int): (int, slice, int)
    asm(-> 0 2 1 3) "DICTUREMMAX" "NULLSWAPIFNOT2";
@pure
fun idictDeleteGetMax(dict: cell, keyLen: int): (cell, int, slice, int)
    asm(-> 0 2 1 3) "DICTIREMMAX" "NULLSWAPIFNOT2";
@pure
fun cell.`idict::delete_get_max`(mutate self, keyLen: int): (int, slice, int)
    asm(-> 0 2 1 3) "DICTIREMMAX" "NULLSWAPIFNOT2";
@pure
fun dictDeleteGetMax(dict: cell, keyLen: int): (cell, slice, slice, int)
    asm(-> 0 2 1 3) "DICTREMMAX" "NULLSWAPIFNOT2";
@pure
fun cell.`dict::delete_get_max`(mutate self, keyLen: int): (slice, slice, int)
    asm(-> 0 2 1 3) "DICTREMMAX" "NULLSWAPIFNOT2";
@pure
fun isUdictGetMin(dict: cell, keyLen: int): (int, slice, int)
    asm (-> 1 0 2) "DICTUMIN" "NULLSWAPIFNOT2";
@pure
fun isUdictGetMax(dict: cell, keyLen: int): (int, slice, int)
    asm (-> 1 0 2) "DICTUMAX" "NULLSWAPIFNOT2";
@pure
fun isUdictGetMinRef(dict: cell, keyLen: int): (int, cell, int)
    asm (-> 1 0 2) "DICTUMINREF" "NULLSWAPIFNOT2";
@pure
fun isUdictGetMaxRef(dict: cell, keyLen: int): (int, cell, int)
    asm (-> 1 0 2) "DICTUMAXREF" "NULLSWAPIFNOT2";
@pure
fun isIdictGetMin(dict: cell, keyLen: int): (int, slice, int)
    asm (-> 1 0 2) "DICTIMIN" "NULLSWAPIFNOT2";
@pure
fun isIdictGetMax(dict: cell, keyLen: int): (int, slice, int)
    asm (-> 1 0 2) "DICTIMAX" "NULLSWAPIFNOT2";
@pure
fun isIdictGetMinRef(dict: cell, keyLen: int): (int, cell, int)
    asm (-> 1 0 2) "DICTIMINREF" "NULLSWAPIFNOT2";
@pure
fun isIdictGetMaxRef(dict: cell, keyLen: int): (int, cell, int)
    asm (-> 1 0 2) "DICTIMAXREF" "NULLSWAPIFNOT2";
@pure
fun isUdictGetNext(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTUGETNEXT" "NULLSWAPIFNOT2";
@pure
fun isUdictGetNexteq(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTUGETNEXTEQ" "NULLSWAPIFNOT2";
@pure
fun isUdictGetPrev(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTUGETPREV" "NULLSWAPIFNOT2";
@pure
fun isUdictGetPreveq(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTUGETPREVEQ" "NULLSWAPIFNOT2";
@pure
fun isIdictGetNext(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTIGETNEXT" "NULLSWAPIFNOT2";
@pure
fun isIdictGetNexteq(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTIGETNEXTEQ" "NULLSWAPIFNOT2";
@pure
fun isIdictGetPrev(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTIGETPREV" "NULLSWAPIFNOT2";
@pure
fun isIdictGetPreveq(dict: cell, keyLen: int, pivot: int): (int, slice, int)
    asm(pivot dict keyLen -> 1 0 2) "DICTIGETPREVEQ" "NULLSWAPIFNOT2";

/// Creates an empty dictionary, which is actually a null value. Equivalent to PUSHNULL
@pure
fun newDict(): cell
    asm "NEWDICT";
/// Checks whether a dictionary is empty. Equivalent to cell_null?.
@pure
fun isDictEmpty(c: cell): int
    asm "DICTEMPTY";


/* Prefix dictionary primitives */
@pure
fun isPfxdictGet(dict: cell, keyLen: int, key: slice): (slice, slice, slice, int)
    asm(key dict keyLen) "PFXDICTGETQ" "NULLSWAPIFNOT2";
@pure
fun isPfxdictSet(dict: cell, keyLen: int, key: slice, value: slice): (cell, int)
    asm(value key dict keyLen) "PFXDICTSET";
@pure
fun isPfxdictDelete(dict: cell, keyLen: int, key: slice): (cell, int)
    asm(key dict keyLen) "PFXDICTDEL";

/// Returns the value of the global configuration parameter with integer index `i` as a `cell` or `null` value.
@pure
fun configParam(x: int): cell
    asm "CONFIGOPTPARAM";
/// Checks whether c is a null. Note, that FunC also has polymorphic null? built-in.
@pure
fun isCellNull(c: cell): int
    asm "ISNULL";

/// Creates an output action which would reserve exactly amount nanotoncoins (if mode = 0), at most amount nanotoncoins (if mode = 2), or all but amount nanotoncoins (if mode = 1 or mode = 3), from the remaining balance of the account. It is roughly equivalent to creating an outbound message carrying amount nanotoncoins (or b − amount nanotoncoins, where b is the remaining balance) to oneself, so that the subsequent output actions would not be able to spend more money than the remainder. Bit +2 in mode means that the external action does not fail if the specified amount cannot be reserved; instead, all remaining balance is reserved. Bit +8 in mode means `amount <- -amount` before performing any further actions. Bit +4 in mode means that amount is increased by the original balance of the current account (before the compute phase), including all extra currencies, before performing any other checks and actions. Currently, amount must be a non-negative integer, and mode must be in the range 0..15.
fun rawReserve(amount: int, mode: int): void
    asm "RAWRESERVE";
/// Similar to raw_reserve, but also accepts a dictionary extra_amount (represented by a cell or null) with extra currencies. In this way currencies other than TonCoin can be reserved.
fun rawReserveExtra(amount: int, extraAmount: cell, mode: int): void
    asm "RAWRESERVEX";
/// Sends a raw message contained in msg, which should contain a correctly serialized object Message X, with the only exception that the source address is allowed to have dummy value addr_none (to be automatically replaced with the current smart contract address), and ihr_fee, fwd_fee, created_lt and created_at fields can have arbitrary values (to be rewritten with correct values during the action phase of the current transaction). Integer parameter mode contains the flags. Currently mode = 0 is used for ordinary messages; mode = 128 is used for messages that are to carry all the remaining balance of the current smart contract (instead of the value originally indicated in the message); mode = 64 is used for messages that carry all the remaining value of the inbound message in addition to the value initially indicated in the new message (if bit 0 is not set, the gas fees are deducted from this amount); mode' = mode + 1 means that the sender wants to pay transfer fees separately; mode' = mode + 2 means that any errors arising while processing this message during the action phase should be ignored. Finally, mode' = mode + 32 means that the current account must be destroyed if its resulting balance is zero. This flag is usually employed together with +128.
fun sendRawMessage(msg: cell, mode: int): void
    asm "SENDRAWMSG";
/// Creates an output action that would change this smart contract code to that given by cell new_code. Notice that this change will take effect only after the successful termination of the current run of the smart contract
fun setCode(newCode: cell): void
    asm "SETCODE";

/// Generates a new pseudo-random unsigned 256-bit integer x. The algorithm is as follows: if r is the old value of the random seed, considered as a 32-byte array (by constructing the big-endian representation of an unsigned 256-bit integer), then its sha512(r) is computed; the first 32 bytes of this hash are stored as the new value r' of the random seed, and the remaining 32 bytes are returned as the next random value x.
fun random(): int
    asm "RANDU256";
/// Generates a new pseudo-random integer z in the range 0..range−1 (or range..−1, if range < 0). More precisely, an unsigned random value x is generated as in random; then z := x * range / 2^256 is computed.
fun rand(range: int): int
    asm "RAND";
/// Returns the current random seed as an unsigned 256-bit Integer.
fun getSeed(): int
    asm "RANDSEED";
/// Sets the random seed to unsigned 256-bit seed.
fun setSeed(_: int): void
    asm "SETRAND";
/// Mixes unsigned 256-bit integer x into the random seed r by setting the random seed to sha256 of the concatenation of two 32-byte strings: the first with the big-endian representation of the old seed r, and the second with the big-endian representation of x.
fun randomize(x: int): void
    asm "ADDRAND";
/// Equivalent to randomize(cur_lt());.
fun randomizeLt(): void
    asm "LTIME" "ADDRAND";

/// Checks whether the data parts of two slices coinside
@pure
fun equalSliceBits(a: slice, b: slice): int
    asm "SDEQ";

/// Concatenates two builders
@pure
fun storeBuilder(to: builder, from: builder): builder
    asm "STBR";
