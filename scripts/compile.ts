// ══════════════════════ IMPORTS ══════════════════════
import { compileFunc } from "@ton-community/func-js";
import { Cell } from "@ton/core";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { NetworkProvider } from '@ton/blueprint';

// ══════════════════════ MAIN EXECUTION ══════════════════════
export async function run(provider: NetworkProvider) {
  console.log('\n═════════════════════ COMPILATION START ═════════════════════');
  console.log('✦ Starting contract compilation');
  console.log('✦ Timestamp:', new Date().toISOString());
  
  // ─────────────────── PATH CONFIGURATION ───────────────────
  const root = process.cwd();
  const contracts = path.join(root, "contracts");
  const buildDir = path.join(root, "build");
  
  console.log('\n═════════════════════ PATH CONFIG ═════════════════════');
  console.log('✦ Root directory:', root);
  console.log('✦ Contracts source:', contracts);
  console.log('✦ Build directory:', buildDir);
  
  try {
    mkdirSync(buildDir, { recursive: true });
    console.log('✅ Build directory verified');
  } catch (error: any) {  // Added type annotation
    console.error('❌ Build directory creation failed:');
    console.error('✦ Error:', error.message);
    throw error;
  }

  // ────────────────── COMPILATION PROCESS ───────────────────
  console.log('\n═════════════════════ COMPILATION ═════════════════════');
  console.log('✦ Reading source files...');
  
  try {
    const result = await compileFunc({
      targets: ["xp.fc"],
      sources: {
        "xp.fc": readFileSync(path.join(contracts, "xp.fc"), "utf8"),
        "stdlib.fc": readFileSync(path.join(contracts, "stdlib.fc"), "utf8"),
      },
    });

    // ──────────────── ERROR HANDLING ────────────────────────
    if (result.status === "error") {
      console.error('\n═════════════════════ ERRORS ═════════════════════');
      console.error('❌ FunC compilation failed');
      console.error('✦ Message:', result.message);
      
      // Type-safe log access
      if ('log' in result) {
        console.error('\n─────── COMPILATION LOG ───────');
        console.error(result.log);
      }
      
      throw new Error('Compilation failed');
    }

    // ────────────────── OUTPUT HANDLING ─────────────────────
    const cell = Cell.fromBoc(Buffer.from(result.codeBoc, "base64"))[0];
    const outputPath = path.join(buildDir, "xp.compiled.cell");
    
    writeFileSync(outputPath, cell.toBoc());
    
    console.log('\n═════════════════════ RESULT ═════════════════════');
    console.log('✅ Contract compiled successfully');
    console.log('✦ Output file:', outputPath);
    console.log('✦ Cell size:', cell.bits.length, 'bits');
    console.log('✦ References:', cell.refs.length);
    console.log('✦ Hash:', cell.hash().toString('hex'));
    
  } catch (error: any) {  // Added type annotation
    console.error('\n═════════════════════ FATAL ERROR ═════════════════════');
    console.error('❌ Unhandled compilation error');
    console.error('✦ Message:', error.message);
    throw error;
  }

  // ─────────────────── COMPLETION ──────────────────────────
  console.log('\n═════════════════════ COMPLETION ═════════════════════');
  console.log('✦ Contract compilation finished');
  console.log('✦ Timestamp:', new Date().toISOString());
  console.log('══════════════════════════════════════════════════════════');
}
// ══════════════════════ END ════════════════════