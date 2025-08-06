// scripts/compile.ts 
// ===================== IMPORTS =====================
import { NetworkProvider } from '@ton/blueprint';
import { runTolkCompiler, getTolkCompilerVersion } from '@ton/tolk-js';
import { Cell } from '@ton/core';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

// ===================== FS UTILITIES =====================
function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

// ===================== ENTRY FINDER =====================
function findEntry(projectRoot: string): { entryRel: string; entryFull: string } {
  console.log('✦ Starting entry point search...');
  
  // ─────── Explicit paths ───────
  const fromEnv = process.env.TOLK_ENTRY;
  const cliArg = process.argv.find((a) => a.startsWith('--entry='));
  const fromCli = cliArg ? cliArg.split('=')[1] : undefined;
  const candidateEnv = fromCli || fromEnv;

  if (candidateEnv) {
    console.log('✦ Using explicit entry path');
    const full = path.resolve(projectRoot, candidateEnv);
    
    if (!existsSync(full)) {
      throw new Error(
        `❌ Specified entry not found: ${candidateEnv} (searched at ${full})`
      );
    }
    
    const rel = path.relative(projectRoot, full) || path.basename(full);
    return { entryRel: rel, entryFull: full };
  }

  // ─────── Auto-discovery ───────
  console.log('✦ Scanning common locations...');
  const candidates = [
    'xp.tolk',
    'contracts/xp.tolk',
    'contract/xp.tolk',
    'src/xp.tolk',
    'src/contracts/xp.tolk',
    'ton/xp.tolk',
    'packages/contract/xp.tolk',
  ];
  
  for (const rel of candidates) {
    const full = path.join(projectRoot, rel);
    if (existsSync(full)) {
      console.log(`✅ Found at: ${rel}`);
      return { entryRel: rel, entryFull: full };
    }
  }
  
  throw new Error(
    `❌ xp.tolk not found. Specify via TOLK_ENTRY or --entry=path\n` +
    `✦ Checked locations: ${candidates.join(', ')}`
  );
}

// ===================== MAIN COMPILATION =====================
export async function run(_provider: NetworkProvider) {
  console.log('\n══════════ TOLK COMPILER ══════════');
  console.log('✦ Initializing compilation process');
  
  try {
    const projectRoot = process.cwd();
    const outDir = path.join(projectRoot, 'build');
    ensureDir(outDir);

    // ─────── Entry discovery ───────
    console.log('\n─────── ENTRY POINT ───────');
    const { entryRel, entryFull } = findEntry(projectRoot);
    console.log(`✦ Selected: ${entryRel}`);

    // ─────── Compilation ───────
    console.log('\n─────── COMPILATION ───────');
    console.log('✦ Starting Tolk compiler...');
    
    const res = await runTolkCompiler({
      entrypointFileName: entryRel,
      fsReadCallback: (p: string) => {
        const try1 = path.resolve(projectRoot, p);
        if (existsSync(try1)) return readFileSync(try1, 'utf-8');

        const try2 = path.resolve(path.dirname(entryFull), p);
        if (existsSync(try2)) return readFileSync(try2, 'utf-8');

        if (path.isAbsolute(p) && existsSync(p)) return readFileSync(p, 'utf-8');

        throw new Error(`❌ File read error: ${p}`);
      },
      withSrcLineComments: true,
    });

    if (res.status === 'error') {
      throw new Error(`❌ Compiler error: ${res.message}`);
    }

    // ─────── Output handling ───────
    console.log('\n─────── OUTPUT GENERATION ───────');
    const codeCell = Cell.fromBoc(Buffer.from(res.codeBoc64, 'base64'))[0];
    
    const bocPath = path.join(outDir, 'XP.code.boc');
    const metaPath = path.join(outDir, 'XP.compilation.json');
    
    writeFileSync(bocPath, codeCell.toBoc());
    console.log(`✦ Compiled cell written: ${path.relative(projectRoot, bocPath)}`);

    const version = await getTolkCompilerVersion();
    writeFileSync(
      metaPath,
      JSON.stringify(
        {
          tool: '@ton/tolk-js',
          version,
          entry: entryRel,
          codeHashHex: res.codeHashHex,
        },
        null,
        2
      )
    );
    console.log(`✦ Metadata written: ${path.relative(projectRoot, metaPath)}`);

    // ─────── Success report ───────
    console.log('\n══════════ COMPILATION REPORT ══════════');
    console.log(`✅ Compilation successful!`);
    console.log(`✦ Tolk version: ${version}`);
    console.log(`✦ Entry point: ${entryRel}`);
    console.log(`✦ Code hash:   ${res.codeHashHex}`);
    console.log(`✦ Cell stats:  ${codeCell.bits.length} bits, ${codeCell.refs.length} refs`);
    console.log(`✦ Output dir:  ${path.relative(projectRoot, outDir)}`);
    
  } catch (e) {
    // ─────── Error handling ───────
    console.log('\n══════════ COMPILATION FAILED ══════════');
    console.error('❌ Critical error:');
    
    if (e instanceof Error) {
      console.error(`✦ Message: ${e.message}`);
      console.error('✦ Action:  Check entry file and dependencies');
    } else {
      console.error('✦ Unknown error occurred');
    }
    
    process.exit(1);
  }
}
// ══════════════════════ END ════════════════════