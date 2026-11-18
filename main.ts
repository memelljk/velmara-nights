// Velmara Nights — hand-in program (Node 22, standard library only).
//
// The entry is the static game in game/ plus the maker's screenshots in
// screenshots/. This program copies both into the output directory and writes
// dossier.json there with the kit's buildDossier, byte for byte the way the
// scorer will rebuild it. Run it locally with:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// MAKEFUN_OUTPUT_DIR stands in for the grader's /output outside its container.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's caps: at most 4 screenshots of 256 KiB, at most 993 entries and
// 48 MiB under game/, paths under game/ at most 1000 bytes, dossier text
// capped at 160 KiB. Passing them here makes this program refuse exactly
// what the scorer would refuse.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Velmara Nights handed in: ${dossier.length} dossier bytes -> ${outputDir}`);
