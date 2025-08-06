# Gotham XP – Developer Technical Documentation

## TL;DR / Quickstart

```bash
# Install dependencies
npm i

# Compile the smart contract (via @ton/blueprint)
npx blueprint build

# Run tests (if any in /tests)
npx blueprint test

# Run prepared scripts (see “Scripts” section)
# Example: compile via custom scripts/compile.ts
npx blueprint run -t compile
```

## 🛠️ Additional Commands (`package.json`)

> Besides the scripts in `scripts/`, the project provides alias commands via `npm run` for convenience.

### Core
```bash
npm run compile:testnet         # Compile contract for testnet
npm run deploy:testnet          # Deploy contract to testnet
npm run add-xp:testnet          # Add XP on testnet
npm run generate-users -- 5     # Generate N users (e.g. 5)
```

### Database operations
```bash
npm run migration:generate -- ./migrations/InitialSchema  # Generate DB migration
npm run migration:run                                     # Apply DB migrations
npm run init-db                                           # Initialize database (first run)
```

### Wallet verifier
```bash
npm run wallet-verifier  # Check wallets and balances
```

## Architecture at 10,000 Feet

- **XP Smart Contract** in Tolk/FunC stores user XP balances and operation history.
- **TypeScript wrapper `XPContract`** handles message building, deployment, and getters.
- **Scripts** automate: compilation, deployment, XP minting, wallet generation, and DB initialization.
- **Database (PostgreSQL + TypeORM)** — `User` and `Transaction` entities for off-chain audit.

Repository structure:
```
contracts/   # FunC/Tolk contract + stdlib
wrappers/    # TypeScript wrappers (ton-core)
scripts/     # deploy, compile, add-xp, generation, etc.
src/         # TypeORM: datasource + entities
tests/       # contract tests
```


## Smart Contract `contracts/xp.tolk` (FunC/Tolk)

### Constants (OP/errors/limits)

- `OP_ADD_XP = 0x1234` – add XP (opId generated from txHash+timestamp).
- `OP_ADD_XP_WITH_ID = 0x5678` — add XP with explicit `opId` (optional).
- `OP_UPGRADE = 0x8765` — upgrade contract code (`setCodePostponed`), increments version.
- `CONTRACT_VERSION = 4`
- Errors: `ERR_NOT_OWNER = 401`, `ERR_OVERFLOW = 402`, `ERR_TOO_SOON = 403`, `ERR_INVALID_OP = 404`.
- Limits: `MIN_TIMEOUT = 60` sec, `MAX_HISTORY = 100`, `MAX_XP_PER_OP = 1_000_000`.

### Storage layout
```
| owner: slice(address) | version: uint16 | last_op_time: uint64 |
| balance_dict: dict<addrHash -> uint64> |
| history_dict: dict<addrHash -> dict<opId(uint256) -> cell{amount: uint64, ts: uint64, opId: uint256}> >
```

- `addrHash(address)` = `hash(cell(address))`
- First message initializes owner/version.

### Internal Operations

**ADD_XP / ADD_XP_WITH_ID**
- Only `owner`
- Validates amount + cooldown
- Updates balance + history

**UPGRADE**
- Only `owner`
- Applies `setCodePostponed(new_code)`, bumps version

### Getters
- `get_xp(address) -> int`
- `get_user_history(address) -> cell?`
- `get_owner() -> slice`
- `get_version() -> int`
- `get_last_op_time() -> int`
- `get_xp_key(address) -> int`

---

## TypeScript Wrapper `XPContract.ts`

- Factories: `createFromAddress`, `createForDeploy`
- Init: `sendDeploy`, `sendInit`, `isInitialized`
- Actions: `sendAddXP`, `sendUpgrade`
- Getters: `getXP`, `getUserHistory`, `getOwner`, `getVersion`, `getLastOpTime`, `getXPKey`

### Example
```ts
const contract = XPContract.createFromAddress(Address.parse('<contract>'));
const opened = provider.open(contract);
await opened.sendAddXP(sender, { user: Address.parse('<user>'), amount: 100n });
const xp = await opened.getXP(provider, Address.parse('<user>'));
```

## Scripts

- `compile.ts`: compile contract → `build/XP.code.boc`
- `deploy.ts`: deploy from mnemonic
- `create-wallets.ts`: generate/save wallets
- `add-xp.ts`: send XP, write DB log
- `generate-users-only.ts`: generate addresses


## Database (PostgreSQL + TypeORM)

```ts
new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: '<user>',
  password: '<pass>',
  database: 'ton_xp_db',
  entities: [User, Transaction],
  synchronize: false,
});
```

### Entities

**User**
- id, address, publicKey, xp, createdAt, transactions

**Transaction**
- id, opId, txHash, amount, timestamp, senderAddress, receiverAddress,
  contractAddress, contractOwner, contractVersion, lastOpTime, status, description, user

### Migrations
```bash
npx typeorm-ts-node-commonjs migration:run
```

## Security & Invariants

- Only `owner` can call ops
- Anti-spam via cooldown
- History is capped
- Upgrade keeps state


## Testnet Flow

```bash
npx blueprint run -t create-wallets
npx blueprint run -t generate-users-only -- 5
npx blueprint run -t compile
npx blueprint run -t deploy
export TONCENTER_API_KEY=...
npx blueprint run -t add-xp
```

## FAQ

-

## Pre-prod Checklist

- [ ] Secrets in `.env` or KMS  
- [ ] `TONCENTER_API_KEY` set  
- [ ] Tests pass  
- [ ] Deployed & verified  
- [ ] Monitoring active  
- [ ] Backups created

## License & Attribution

- Depends on TON stack, TypeORM, PostgreSQL
- Audit licenses before production