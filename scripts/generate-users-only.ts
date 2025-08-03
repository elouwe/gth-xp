// scripts/generate-users-only.ts
// ══════════════════════ IMPORTS ══════════════════════
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

interface WalletUser {
  id: number; 
  address: string;
  addressNonBounce: string;
  publicKey: string;
  mnemonic: string;
}

interface WalletsFile {
  owner?: {
    mnemonic: string;
    address: string;
    addressNonBounce: string;
    publicKey: string;
  };
  contract?: string;
  users?: WalletUser[];
  nextUserId?: number; 
}

export async function run(count: number = 3) {
  console.log('\n═════════════════════ USER GENERATION ═════════════════════');
  console.log('✦ Starting wallet generation process');
  
  // ──────────────── CONFIG VALIDATION ────────────────────────
  console.log('\n═════════════════════ CONFIGURATION ══════════════════════');
  if (isNaN(count)) {
    console.log('✦ Using default count: 3');
    count = 3;
  }
  
  if (count < 1) {
    console.log('✦ Minimum count enforced: 1');
    count = 1;
  }
  
  if (count > 100) {
    console.log('❌ Cannot generate more than 100 users at once');
    console.log('✦ Setting count to maximum: 100');
    count = 100;
  }
  
  console.log(`✦ Generating ${count} new user(s)`);

  // ──────────────── FILE HANDLING ────────────────────────────
  console.log('\n═════════════════════ FILE HANDLING ══════════════════════');
  let walletsData: WalletsFile = {};
  
  if (existsSync('wallets.json')) {
    try {
      console.log('✦ Loading existing wallets file');
      const rawData = readFileSync('wallets.json', 'utf8');
      walletsData = JSON.parse(rawData);
      console.log('✅ File loaded successfully');
    } catch (e) {
      console.error('❌ Error reading wallets.json:');
      console.error('✦ Details:', e);
      console.log('✦ Creating new wallet data structure');
    }
  } else {
    console.log('✦ No existing wallets file found');
    console.log('✦ Initializing new data structure');
  }

  // ──────────────── ID MANAGEMENT ────────────────────────────
  let nextId = walletsData.nextUserId || 1;
  console.log(`✦ Next available user ID: ${nextId}`);
  
  if (!walletsData.users) {
    walletsData.users = [];
    console.log('✦ Initialized users array');
  }

  // ──────────────── USER CREATION ────────────────────────────
  console.log('\n═════════════════════ WALLET CREATION ════════════════════');
  const newUsers: WalletUser[] = [];
  
  for (let i = 0; i < count; i++) {
    console.log(`\n─────── GENERATING USER ${i + 1}/${count} ───────`);
    
    try {
      console.log('✦ Creating mnemonic phrase');
      const mnemonic = await mnemonicNew();
      
      console.log('✦ Deriving key pair');
      const keyPair = await mnemonicToPrivateKey(mnemonic);
      
      console.log('✦ Creating wallet contract');
      const wallet = WalletContractV4.create({ 
        workchain: 0, 
        publicKey: keyPair.publicKey 
      });
      
      const address = wallet.address.toString();
      const addressNonBounce = wallet.address.toString({ 
        urlSafe: true, 
        bounceable: false 
      });
      
      const userData: WalletUser = {
        id: nextId++,
        address: address,
        addressNonBounce: addressNonBounce,
        publicKey: keyPair.publicKey.toString('hex'),
        mnemonic: mnemonic.join(' ')
      };
      
      newUsers.push(userData);
      console.log('✅ User created successfully');
      console.log(`  - ID: ${userData.id}`);
      console.log(`  - Address: ${address}`);
      console.log(`  - Non-bounceable: ${addressNonBounce}`);
    } catch (error) {
      console.error('❌ User creation failed:');
      console.error('✦ Error details:', error);
    }
  }

  // ──────────────── DATA UPDATE ──────────────────────────────
  console.log('\n═════════════════════ DATA UPDATE ═══════════════════════');
  walletsData.users = [...walletsData.users, ...newUsers];
  walletsData.nextUserId = nextId;
  
  console.log(`✦ Added ${newUsers.length} new users`);
  console.log(`✦ Total users now: ${walletsData.users.length}`);
  console.log(`✦ Next available ID: ${walletsData.nextUserId}`);

  // ──────────────── FILE SAVING ──────────────────────────────
  console.log('\n═════════════════════ FILE SAVING ═══════════════════════');
  try {
    writeFileSync('wallets.json', JSON.stringify(walletsData, null, 2));
    console.log('✅ File saved successfully');
    console.log(`✦ Wrote ${walletsData.users.length} users to wallets.json`);
  } catch (e) {
    console.error('❌ Failed to save file:');
    console.error('✦ Error details:', e);
  }

  // ──────────────── SUMMARY REPORT ───────────────────────────
  console.log('\n══════════════════════ SUMMARY ══════════════════════════');
  console.log('✦ Operation results:');
  console.log(`  - Requested users: ${count}`);
  console.log(`  - Created users: ${newUsers.length}`);
  console.log(`  - Total users in system: ${walletsData.users.length}`);
  
  if (newUsers.length > 0) {
    console.log('\n✦ New user IDs:');
    newUsers.forEach(user => {
      console.log(`  - #${user.id}: ${user.address}`);
    });
  } else {
    console.log('\n✦ No new users generated');
  }
  
  console.log('\n═════════════════════ COMPLETION ════════════════════════');
  console.log('✦ Wallet generation process finished');
  console.log('✦ Timestamp:', new Date().toISOString());
}

// ──────────────────── COMMAND LINE HANDLING ──────────────────
console.log('\n═══════════════════ CONFIGURATION ═════════════════════');
const args = process.argv.slice(2);
let userCount = 3;

if (args.length > 0) {
  const count = parseInt(args[0], 10);
  if (!isNaN(count)) {
    userCount = count;
    console.log(`✦ Using requested count: ${userCount}`);
  } else {
    console.log(`✦ Invalid count argument: ${args[0]}`);
    console.log('✦ Using default count: 3');
  }
} else {
  console.log('✦ No count specified, using default: 3');
}

run(userCount).catch(e => {
  console.error('\n═════════════════════ CRITICAL ERROR ═════════════════════');
  console.error('❌ Unhandled exception:');
  console.error('✦ Message:', e.message);
  console.error('✦ Stack:', e.stack);
  process.exit(1);
});
// ══════════════════════ END ════════════════════