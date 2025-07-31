import { Address, beginCell } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { readFileSync } from 'fs';
import * as readline from 'readline';

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ============================== VERIFICATION FUNCTIONS ==============================
async function verifyWalletData(data: WalletUser) {
  console.log('\n═════════ VERIFICATION STARTED ═════════');
  console.log(`✦ User ID: #${data.id}`);
  console.log(`✦ Address: ${data.address}`);
  
  // Section 1: Mnemonic Verification
  console.log('\n═════════ MNEMONIC VERIFICATION ═════════');
  const words = data.mnemonic.split(' ');
  if (words.length !== 24) {
    console.error(`❌ FAILED: Expected 24 words, got ${words.length}`);
    return false;
  }
  console.log('✅ PASSED: 24-word mnemonic format');
  
  // Section 2: Public Key Verification
  console.log('\n═════════ PUBLIC KEY VERIFICATION ═════════');
  const pubKeyRegex = /^[0-9a-f]{64}$/i;
  if (!pubKeyRegex.test(data.publicKey)) {
    console.error('❌ FAILED: Must be 64 hex characters');
    return false;
  }
  console.log('✅ PASSED: 64-character hex format');
  
  // Section 3: Address Format Verification
  console.log('\n═════════ ADDRESS FORMAT VERIFICATION ═════════');
  const addressRegex = /^[a-zA-Z0-9_-]{48}$/;
  const bounceValid = addressRegex.test(data.address);
  const nonBounceValid = addressRegex.test(data.addressNonBounce);
  
  console.log(`✦ Bounceable: ${bounceValid ? '✅' : '❌'}`);
  console.log(`✦ Non-bounceable: ${nonBounceValid ? '✅' : '❌'}`);
  
  if (!bounceValid || !nonBounceValid) {
    return false;
  }
  
  try {
    // Section 4: Key Derivation
    console.log('\n═════════ KEY DERIVATION ═════════');
    const keyPair = await mnemonicToPrivateKey(words);
    console.log('✅ PASSED: Keys derived from mnemonic');
    
    // Section 5: Public Key Match
    console.log('\n═════════ PUBLIC KEY MATCH ═════════');
    const actualPubKeyHex = keyPair.publicKey.toString('hex');
    if (actualPubKeyHex !== data.publicKey) {
      console.error('❌ FAILED: Public key mismatch');
      console.log(`  Stored: ${data.publicKey}`);
      console.log(`  Derived: ${actualPubKeyHex}`);
      return false;
    }
    console.log('✅ PASSED: Public keys match');
    
    // Section 6: Address Generation
    console.log('\n═════════ ADDRESS GENERATION ═════════');
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey
    });
    
    const generatedBounceable = wallet.address.toString();
    const generatedNonBounce = wallet.address.toString({ urlSafe: true, bounceable: false });
    
    // Section 7: Address Prefix Check
    console.log('\n═════════ ADDRESS PREFIX CHECK ═════════');
    const validBounceablePrefixes = ['E', 'k'];
    const validNonBounceablePrefixes = ['U', '0'];
    
    const bouncePrefixValid = validBounceablePrefixes.includes(data.address[0]);
    const nonBouncePrefixValid = validNonBounceablePrefixes.includes(data.addressNonBounce[0]);
    
    console.log(`✦ Bounceable prefix: ${bouncePrefixValid ? '✅' : '❌'} (${data.address[0]})`);
    console.log(`✦ Non-bounceable prefix: ${nonBouncePrefixValid ? '✅' : '❌'} (${data.addressNonBounce[0]})`);
    
    if (!bouncePrefixValid || !nonBouncePrefixValid) {
      return false;
    }
    
    // Section 8: Address Match Verification
    console.log('\n═════════ ADDRESS MATCH VERIFICATION ═════════');
    const bounceMatch = data.address === generatedBounceable;
    const nonBounceMatch = data.addressNonBounce === generatedNonBounce;
    
    console.log(`✦ Bounceable match: ${bounceMatch ? '✅' : '❌'}`);
    if (!bounceMatch) {
      console.log(`  Stored:    ${data.address}`);
      console.log(`  Generated: ${generatedBounceable}`);
    }
    
    console.log(`✦ Non-bounceable match: ${nonBounceMatch ? '✅' : '❌'}`);
    if (!nonBounceMatch) {
      console.log(`  Stored:    ${data.addressNonBounce}`);
      console.log(`  Generated: ${generatedNonBounce}`);
    }
    
    if (!bounceMatch || !nonBounceMatch) {
      return false;
    }
    
    // Section 9: Checksum Validation
    console.log('\n═════════ CHECKSUM VALIDATION ═════════');
    try {
      Address.parse(data.address);
      Address.parse(data.addressNonBounce);
      console.log('✅ PASSED: Both addresses have valid checksums');
    } catch (e) {
      console.error('❌ FAILED: Checksum validation error:', e);
      return false;
    }
    
    // Section 10: Address Consistency
    console.log('\n═════════ ADDRESS CONSISTENCY ═════════');
    const parsedBounceable = Address.parse(data.address);
    const parsedNonBounce = Address.parse(data.addressNonBounce);
    
    if (!parsedBounceable.equals(parsedNonBounce)) {
      console.error('❌ FAILED: Addresses represent different locations');
      return false;
    }
    console.log('✅ PASSED: Both addresses represent same wallet');
    
    // Section 11: Workchain Validation
    console.log('\n═════════ WORKCHAIN VALIDATION ═════════');
    if (parsedBounceable.workChain !== 0) {
      console.error(`❌ FAILED: Expected workchain 0, got ${parsedBounceable.workChain}`);
      return false;
    }
    console.log('✅ PASSED: Workchain 0');
    
    // Section 12: Hash Verification
    console.log('\n═════════ HASH VERIFICATION ═════════');
    const actualHash = parsedBounceable.hash.toString('hex');
    const expectedHash = wallet.address.hash.toString('hex');
    
    if (actualHash !== expectedHash) {
      console.error('❌ FAILED: Address hash mismatch');
      console.log(`  Expected: ${expectedHash}`);
      console.log(`  Actual:   ${actualHash}`);
      return false;
    }
    console.log('✅ PASSED: Address hash matches');
    
    // Final Result
    console.log('\n═════════ VERIFICATION COMPLETE ═════════');
    console.log('ALL 12 VERIFICATIONS PASSED SUCCESSFULLY!');
    return true;
    
  } catch (error) {
    console.error('\n═════════ CRITICAL ERROR ═════════');
    console.error('❌ Verification process failed:', error);
    return false;
  }
}

// ============================== MAIN EXECUTION ==============================
async function main() {
  console.log('\n══════════ WALLET VERIFIER ══════════');
  
  try {
    // Load wallet data
    console.log('\n✦ Loading wallet data...');
    const rawData = readFileSync('wallets.json', 'utf8');
    const walletsData: WalletsFile = JSON.parse(rawData);
    
    if (!walletsData.users || walletsData.users.length === 0) {
      console.error('❌ No users found in wallets.json');
      return;
    }
    console.log(`✅ Loaded ${walletsData.users.length} users`);
    
    // Display user list
    console.log('\n═════════ AVAILABLE USERS ═════════');
    walletsData.users.forEach(user => {
      console.log(`#${user.id.toString().padEnd(3)} - ${user.address}`);
    });
    
    // User selection
    rl.question('\n✦ Enter user ID to verify: ', async (userId) => {
      const startTime = Date.now();
      const id = parseInt(userId, 10);
      
      if (isNaN(id)) {
        console.error('❌ Invalid ID. Please enter a number');
        rl.close();
        return;
      }
      
      // Find user
      const user = walletsData.users?.find(u => u.id === id);
      
      if (!user) {
        console.error(`❌ User #${id} not found`);
        rl.close();
        return;
      }
      
      console.log(`\n✦ Selected user: #${user.id}`);
      
      // Perform verification
      const isValid = await verifyWalletData(user);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Final result
      console.log('\n═════════ FINAL RESULT ═════════');
      console.log(`✦ Verification time: ${duration} seconds`);
      console.log(`✦ User #${user.id}: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      console.log('\n════════════════════════════════════');
      
      rl.close();
    });
    
  } catch (error) {
    console.error('\n═════════ LOADING ERROR ═════════');
    console.error('❌ Error loading wallets.json:', error);
    rl.close();
  }
}

// Start the verification process
main();