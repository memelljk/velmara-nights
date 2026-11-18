// main.ts — the hand-in program for Velmara Nights (make.fun bounty gta6-01).
//
// What it does, in order:
//   1. works out where the entry must land — MAKEFUN_OUTPUT_DIR when the
//      grader's stand-in is in play, /output on the platform itself;
//   2. copies the playable game (game/) and the screenshot sheet
//      (screenshots/) across, replacing whatever a previous run left there;
//   3. asks the kit library to describe the result as a dossier and writes
//      dossier.json beside the copies, byte for byte as the scorer will
//      rebuild it when it checks this entry.
//
// Standard library only, no network, no clock, no randomness: run it twice
// and the second run overwrites the first with identical bytes.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
for (const part of ['game', 'screenshots'] as const) {
  const target = join(outputDir, part);
  rmSync(target, { recursive: true, force: true });
  cpSync(join(repoRoot, part), target, { recursive: true });
}

const dossierBytes = buildDossier(outputDir, {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierBytes);

console.log(`velmara-nights: game + screenshots copied to ${outputDir}`);
console.log(`velmara-nights: dossier.json written (${dossierBytes.length} bytes)`);
