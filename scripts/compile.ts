// scripts/compile.ts
import { compileFunc } from "@ton-community/func-js";
import { Cell } from "@ton/core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { NetworkProvider } from '@ton/blueprint'; 

export async function run(provider: NetworkProvider) { 
  const root = process.cwd();
  const contracts = path.join(root, "contracts");
  const buildDir = path.join(root, "build");
  mkdirSync(buildDir, { recursive: true });

  const result = await compileFunc({
    targets: ["xp.fc"],
    sources: {
      "xp.fc": readFileSync(path.join(contracts, "xp.fc"), "utf8"),
      "stdlib.fc": readFileSync(path.join(contracts, "stdlib.fc"), "utf8"),
    },
  });

  if (result.status === "error") {
    console.error("❌ FunC error:", result.message);
    throw new Error("Compilation failed"); 
  }

  const cell = Cell.fromBoc(Buffer.from(result.codeBoc, "base64"))[0];
  writeFileSync(path.join(buildDir, "xp.compiled.cell"), cell.toBoc());
  console.log("✅ Contract compiled → build/xp.compiled.cell");
}