// scripts/generate-users-only.ts
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
  console.log('\n═════════ USER GENERATION ═════════');
  
  // Validate and adjust user count parameter
  if (isNaN(count)) {
    console.log('✦ Using default count (3)');
    count = 3;
  }
  if (count < 1) {
    console.log('✦ Minimum count enforced (1)');
    count = 1;
  }
  if (count > 100) {
    console.log('❌ Cannot generate more than 100 users at once');
    console.log('✦ Setting count to maximum (100)');
    count = 100;
  }
  
  console.log(`✦ Generating ${count} new user(s)`);

  // Read existing wallets file
  let walletsData: WalletsFile = {};
  console.log('\n═════════ FILE HANDLING ═════════');
  
  if (existsSync('wallets.json')) {
    try {
      console.log('✦ Loading existing wallets file');
      const rawData = readFileSync('wallets.json', 'utf8');
      walletsData = JSON.parse(rawData);
      console.log('✅ File loaded successfully');
    } catch (e) {
      console.error('❌ Error reading wallets.json:', e);
      console.log('✦ Creating new wallet data structure');
    }
  } else {
    console.log('✦ No existing wallets file found');
    console.log('✦ Creating new wallet data structure');
  }

  // Initialize ID counter
  let nextId = walletsData.nextUserId || 1;
  console.log(`✦ Next available user ID: ${nextId}`);
  
  // Initialize users array if needed
  if (!walletsData.users) {
    console.log('✦ Initializing users array');
    walletsData.users = [];
  }

  // Generate new users
  const newUsers: WalletUser[] = [];
  console.log('\n═════════ WALLET CREATION ═════════');
  
  for (let i = 0; i < count; i++) {
    try {
      // Generate new mnemonic phrase
      console.log(`✦ Generating user #${nextId}...`);
      const mnemonic = await mnemonicNew();
      
      // Derive key pair from mnemonic
      const keyPair = await mnemonicToPrivateKey(mnemonic);
      
      // Create V4 wallet contract
      const wallet = WalletContractV4.create({ 
        workchain: 0, 
        publicKey: keyPair.publicKey 
      });
      
      // Format addresses
      const address = wallet.address.toString();
      const addressNonBounce = wallet.address.toString({ 
        urlSafe: true, 
        bounceable: false 
      });
      
      // Create user data with ID
      const userData: WalletUser = {
        id: nextId++,
        address: address,
        addressNonBounce: addressNonBounce,
        publicKey: keyPair.publicKey.toString('hex'),
        mnemonic: mnemonic.join(' ')
      };
      
      newUsers.push(userData);
      console.log(`✅ User #${userData.id} created`);
      console.log(`  Address: ${address}`);
    } catch (error) {
      console.error(`❌ Failed to generate user:`, error);
    }
  }

  // Update user data
  walletsData.users = [...walletsData.users, ...newUsers];
  walletsData.nextUserId = nextId;
  
  // Save updated file
  console.log('\n═════════ SAVING DATA ═════════');
  writeFileSync('wallets.json', JSON.stringify(walletsData, null, 2));
  console.log(`✅ Successfully saved ${newUsers.length} new users`);
  console.log(`✦ Total users now: ${walletsData.users.length}`);
  
  // Display summary
  if (newUsers.length > 0) {
    console.log('\n═════════ SUMMARY ═════════');
    console.log('✦ Generated users:');
    newUsers.forEach(user => {
      console.log(`  #${user.id}: ${user.address}`);
    });
  } else {
    console.log('\n═════════ SUMMARY ═════════');
    console.log('✦ No new users generated');
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
let userCount = 3;

console.log('\n═════════ CONFIGURATION ═════════');
if (args.length > 0) {
  const count = parseInt(args[0], 10);
  if (!isNaN(count)) {
    userCount = count;
    console.log(`✦ Using requested count: ${userCount}`);
  } else {
    console.log(`✦ Invalid count argument: ${args[0]}`);
    console.log('✦ Using default count (3)');
  }
} else {
  console.log('✦ No count specified, using default (3)');
}

run(userCount).catch(console.error);