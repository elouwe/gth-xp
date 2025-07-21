import { WalletContractV4 } from "@ton/ton";
import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { writeFileSync } from "fs";

async function createWallet() {
    const mnemonic = await mnemonicNew(24);
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    
    const wallet = WalletContractV4.create({
        workchain: 0,
        publicKey: keyPair.publicKey,
    });
    
    return {
        mnemonic: mnemonic.join(" "),
        address: wallet.address.toString(),
    };
}

async function main() {
    const owner = await createWallet();
    const user = await createWallet();
    
    console.log("Owner wallet:");
    console.log(`Mnemonic: ${owner.mnemonic}`);
    console.log(`Address: ${owner.address}\n`);
    
    console.log("User wallet:");
    console.log(`Mnemonic: ${user.mnemonic}`);
    console.log(`Address: ${user.address}`);
    
    writeFileSync("wallets.json", JSON.stringify({ owner, user }, null, 2));
    console.log("\nWallets saved to wallets.json");
}

main().catch(console.error);