import { Address, beginCell } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { readFileSync } from 'fs';
import * as readline from 'readline';

// Data interfaces
interface WalletUser {
  id: number;
  address: string;
  addressNonBounce: string;
  publicKey: string;
  mnemonic: string;
}

interface WalletsFile {
  users?: WalletUser[];
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function verifyWalletData(data: WalletUser) {
  console.log(`\n🚀 Starting comprehensive verification for user #${data.id}`);
  console.log(`📭 Address: ${data.address}`);
  
  // 1. Validate mnemonic phrase format
  console.log("\n🔑 Step 1: Mnemonic phrase validation");
  const words = data.mnemonic.split(' ');
  if (words.length !== 24) {
    console.error(`❌ Invalid mnemonic: Expected 24 words, got ${words.length}`);
    return false;
  }
  console.log("✅ Mnemonic format: 24 words (valid)");
  
  // 2. Validate public key format
  console.log("\n🔑 Step 2: Public key format validation");
  const pubKeyRegex = /^[0-9a-f]{64}$/i;
  if (!pubKeyRegex.test(data.publicKey)) {
    console.error(`❌ Invalid public key format: Must be 64 hex characters`);
    return false;
  }
  console.log("✅ Public key format: 64 hex characters (valid)");
  
  // 3. Validate address formats
  console.log("\n📍 Step 3: Address format validation");
  const addressRegex = /^[a-zA-Z0-9_-]{48}$/;
  if (!addressRegex.test(data.address)) {
    console.error(`❌ Invalid bounceable address format`);
    return false;
  }
  if (!addressRegex.test(data.addressNonBounce)) {
    console.error(`❌ Invalid non-bounceable address format`);
    return false;
  }
  console.log("✅ Both addresses have valid format (48 URL-safe characters)");
  
  try {
    // 4. Derive keys from mnemonic
    console.log("\n🔐 Step 4: Deriving keys from mnemonic");
    const keyPair = await mnemonicToPrivateKey(words);
    console.log("✅ Keys successfully derived from mnemonic");
    
    // 5. Verify public key
    console.log("\n🔍 Step 5: Public key verification");
    const actualPubKeyHex = keyPair.publicKey.toString('hex');
    if (actualPubKeyHex !== data.publicKey) {
      console.error(`❌ Public key mismatch!`);
      console.log(`Expected: ${data.publicKey}`);
      console.log(`Actual:   ${actualPubKeyHex}`);
      return false;
    }
    console.log("✅ Public key matches perfectly");
    
    // 6. Generate address from mnemonic (core verification)
    console.log("\n📍 Step 6: Address generation from mnemonic");
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey
    });
    
    // Get all address formats
    const generatedBounceable = wallet.address.toString();
    const generatedNonBounce = wallet.address.toString({
      urlSafe: true,
      bounceable: false
    });
    const generatedRaw = wallet.address.toString({
      urlSafe: false,
      bounceable: false,
      testOnly: false
    });
    
    console.log("ℹ️ Generated bounceable address:", generatedBounceable);
    console.log("ℹ️ Generated non-bounceable address:", generatedNonBounce);
    console.log("ℹ️ Generated raw address:", generatedRaw);
    
    // 7. Validate address prefixes
    console.log("\n🏷️ Step 7: Address prefix validation");
    const validBounceablePrefixes = ['E', 'k'];
    const validNonBounceablePrefixes = ['U', '0'];
    
    if (!validBounceablePrefixes.includes(data.address[0])) {
      console.error(`❌ Invalid bounceable address prefix: ${data.address[0]}`);
      return false;
    }
    if (!validNonBounceablePrefixes.includes(data.addressNonBounce[0])) {
      console.error(`❌ Invalid non-bounceable address prefix: ${data.addressNonBounce[0]}`);
      return false;
    }
    console.log("✅ Both addresses have valid prefixes");
    
    // 8. Verify bounceable address
    console.log("\n🟢 Step 8: Bounceable address check");
    if (data.address !== generatedBounceable) {
      console.error(`❌ Bounceable address mismatch!`);
      console.log(`Expected: ${generatedBounceable}`);
      console.log(`Actual:   ${data.address}`);
      return false;
    }
    console.log("✅ Bounceable address matches");
    
    // 9. Verify non-bounceable address
    console.log("\n🔴 Step 9: Non-bounceable address check");
    if (data.addressNonBounce !== generatedNonBounce) {
      console.error(`❌ Non-bounceable address mismatch!`);
      console.log(`Expected: ${generatedNonBounce}`);
      console.log(`Actual:   ${data.addressNonBounce}`);
      return false;
    }
    console.log("✅ Non-bounceable address matches");
    
    // 10. Validate address checksums
    console.log("\n🧮 Step 10: Address checksum verification");
    try {
      Address.parse(data.address);
      Address.parse(data.addressNonBounce);
      console.log("✅ Both addresses have valid checksums");
    } catch (e) {
      console.error("❌ Address checksum validation failed:", e);
      return false;
    }
    
    // 11. Verify address consistency
    console.log("\n🔗 Step 11: Address consistency check");
    const parsedBounceable = Address.parse(data.address);
    const parsedNonBounce = Address.parse(data.addressNonBounce);
    
    if (!parsedBounceable.equals(parsedNonBounce)) {
      console.error("❌ Bounceable and non-bounceable addresses point to different locations!");
      return false;
    }
    console.log("✅ Both addresses represent the same wallet");
    
    // 12. Validate workchain
    console.log("\n⛓️ Step 12: Workchain validation");
    if (parsedBounceable.workChain !== 0) {
      console.error(`❌ Invalid workchain: expected 0, got ${parsedBounceable.workChain}`);
      return false;
    }
    console.log("✅ Address belongs to workchain 0");
    
    // 13. Verify address hash
    console.log("\n🔢 Step 13: Address hash verification");
    const actualHash = parsedBounceable.hash.toString('hex');
    const expectedHash = wallet.address.hash.toString('hex');
    
    if (actualHash !== expectedHash) {
      console.error(`❌ Address hash mismatch!`);
      console.log(`Expected: ${expectedHash}`);
      console.log(`Actual:   ${actualHash}`);
      return false;
    }
    console.log("✅ Address hash matches perfectly");
    
    console.log("\n🎉 All 13 verifications passed successfully!");
    return true;
    
  } catch (error) {
    console.error("\n❌ Critical error during verification:", error);
    return false;
  }
}

async function main() {
  try {
    // Load data from wallets.json
    const rawData = readFileSync('wallets.json', 'utf8');
    const walletsData: WalletsFile = JSON.parse(rawData);
    
    if (!walletsData.users || walletsData.users.length === 0) {
      console.error("❌ No users found in wallets.json");
      return;
    }
    
    // Display user list
    console.log("\n👥 Available users:");
    walletsData.users.forEach(user => {
      console.log(`#${user.id}: ${user.address}`);
    });
    
    // Prompt for user ID
    rl.question('\nEnter user ID to verify: ', async (userId) => {
      const id = parseInt(userId, 10);
      
      if (isNaN(id)) {
        console.error("❌ Invalid ID. Please enter a number.");
        rl.close();
        return;
      }
      
      // Find user
      const user = walletsData.users?.find(u => u.id === id);
      
      if (!user) {
        console.error(`❌ User with ID ${id} not found`);
        rl.close();
        return;
      }
      
      // Start verification
      console.log(`\n🔍 Starting verification for user #${user.id}...`);
      const startTime = Date.now();
      const isValid = await verifyWalletData(user);
      const duration = (Date.now() - startTime) / 1000;
      
      console.log(`\n⏱️ Verification completed in ${duration.toFixed(2)} seconds`);
      console.log(`\n🏁 Final result for user #${user.id}: ${isValid ? "✅ VALID" : "❌ INVALID"}`);
      
      rl.close();
    });
    
  } catch (error) {
    console.error("❌ Error loading wallets.json:", error);
    rl.close();
  }
}

// Launch main function
main();