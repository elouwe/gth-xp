// create-wallets.ts
import { WalletContractV4 } from "@ton/ton";
import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { writeFileSync } from "fs";

type WalletInfo = {
  mnemonic: string;
  address: string;
  addressNonBounce: string;
  publicKey: string;
};

async function createWallet(testnet: boolean): Promise<WalletInfo> {
  const mnemonic = await mnemonicNew(24);
  const { publicKey } = await mnemonicToPrivateKey(mnemonic);

  const wallet = WalletContractV4.create({ workchain: 0, publicKey });

  const bounce = wallet.address.toString({ 
    bounceable: true,  
    testOnly: testnet
  });
  
  const nonBounce = wallet.address.toString({ 
    bounceable: false, 
    testOnly: testnet 
  });

  return {
    mnemonic: mnemonic.join(" "),
    address: bounce,
    addressNonBounce: nonBounce,
    publicKey: Buffer.from(publicKey).toString("hex"),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const testnet = args.includes('--testnet');
  
  console.log(`🔌 Using ${testnet ? "TESTNET" : "MAINNET"}\n`);
  
  const owner = await createWallet(testnet);
  const user = await createWallet(testnet);

  console.log("Owner:");
  console.log(`  Mnemonic : ${owner.mnemonic}`);
  console.log(`  Address  : ${owner.address} (bounce)`);
  console.log(`  Non‑bnc  : ${owner.addressNonBounce}\n`);

  console.log("User:");
  console.log(`  Mnemonic : ${user.mnemonic}`);
  console.log(`  Address  : ${user.address} (bounce)`);
  console.log(`  Non‑bnc  : ${user.addressNonBounce}\n`);

  writeFileSync(
    "wallets.json",
    JSON.stringify({ owner, user, contract: "" }, null, 2)
  );

  console.log("✅ wallets.json update");
}

main().catch((e) => {
  console.error("💥 Error:", e);
  process.exit(1);
});