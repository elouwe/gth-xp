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
  
  console.log('\n═════════ PATHS ═════════');
  console.log('✦ Root directory:', root);
  console.log('✦ Contracts source:', contracts);
  console.log('✦ Build directory:', buildDir);
  
  mkdirSync(buildDir, { recursive: true });
  
  console.log('\n═════════ COMPILING ═════════');
  console.log('✦ Reading source files...');
  
  const result = await compileFunc({
    targets: ["xp.fc"],
    sources: {
      "xp.fc": readFileSync(path.join(contracts, "xp.fc"), "utf8"),
      "stdlib.fc": readFileSync(path.join(contracts, "stdlib.fc"), "utf8"),
    },
  });

  if (result.status === "error") {
    console.error('\n═════════ ERRORS ═════════');
    console.error('❌ FunC compilation failed');
    console.error('✦ Message:', result.message);
    throw new Error('Compilation failed');
  }

  const cell = Cell.fromBoc(Buffer.from(result.codeBoc, "base64"))[0];
  const outputPath = path.join(buildDir, "xp.compiled.cell");
  
  writeFileSync(outputPath, cell.toBoc());
  
  console.log('\n═════════ RESULT ═════════');
  console.log('✅ Contract compiled successfully');
  console.log('✦ Output file:', outputPath);
  console.log('✦ Cell size:', cell.bits.length, 'bits');
  console.log('✦ References:', cell.refs.length);
  console.log('\n══════════════════════════');
}