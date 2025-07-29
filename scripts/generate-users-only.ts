import { writeFileSync, readFileSync, existsSync } from 'fs';
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

interface WalletUser {
  id: number; // Added ID field
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
  nextUserId?: number; // Added field for next ID
}

export async function run(count: number = 3) {
  // Validate and adjust count
  if (isNaN(count)) count = 3;
  if (count < 1) count = 1;
  if (count > 100) {
    console.log('❌ Cannot generate more than 100 users at once');
    count = 100;
  }

  // Read existing file
  let walletsData: WalletsFile = {};
  if (existsSync('wallets.json')) {
    try {
      const rawData = readFileSync('wallets.json', 'utf8');
      walletsData = JSON.parse(rawData);
    } catch (e) {
      console.error('Error reading wallets.json:', e);
      console.log('Creating new wallets file...');
    }
  }

  // Initialize ID counter
  let nextId = walletsData.nextUserId || 1;
  
  // Initialize users array
  if (!walletsData.users) {
    walletsData.users = [];
  }

  // Generate new users
  const newUsers: WalletUser[] = [];
  
  console.log(`Generating ${count} new users...`);
  for (let i = 0; i < count; i++) {
    try {
      // Generate new mnemonic
      const mnemonic = await mnemonicNew();
      
      // Convert mnemonic to private key
      const keyPair = await mnemonicToPrivateKey(mnemonic);
      
      // Create V4 wallet
      const wallet = WalletContractV4.create({ 
        workchain: 0, 
        publicKey: keyPair.publicKey 
      });
      
      // Get addresses
      const address = wallet.address.toString();
      const addressNonBounce = wallet.address.toString({ 
        urlSafe: true, 
        bounceable: false 
      });
      
      // Create user data with ID
      const userData: WalletUser = {
        id: nextId++, // Assign unique ID
        address: address,
        addressNonBounce: addressNonBounce,
        publicKey: keyPair.publicKey.toString('hex'),
        mnemonic: mnemonic.join(' ')
      };
      
      newUsers.push(userData);
      console.log(`✅ User #${userData.id}: ${address}`);
    } catch (error) {
      console.error(`❌ Failed to generate user:`, error);
    }
  }

  // Add new users to data
  walletsData.users = [...walletsData.users, ...newUsers];
  
  // Save next ID for future generations
  walletsData.nextUserId = nextId;
  
  // Save updated file
  writeFileSync('wallets.json', JSON.stringify(walletsData, null, 2));
  console.log(`\n🎉 Successfully added ${newUsers.length} new users to wallets.json`);
  console.log(`Total users now: ${walletsData.users.length}`);
  
  // Display generated users with IDs
  if (newUsers.length > 0) {
    console.log('\n👥 Generated users:');
    newUsers.forEach(user => {
      console.log(`#${user.id}: ${user.address}`);
    });
  }
  
  // Security notice
  if (newUsers.length > 0) {
    console.log('\n⚠️ IMPORTANT SECURITY NOTICE:');
    console.log('1. These mnemonics provide full access to generated wallets');
    console.log('2. Save them in a secure place');
    console.log('3. Never commit wallets.json to public repositories');
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
let userCount = 3;
if (args.length > 0) {
  const count = parseInt(args[0], 10);
  if (!isNaN(count)) {
    userCount = count;
  }
}

run(userCount).catch(console.error);