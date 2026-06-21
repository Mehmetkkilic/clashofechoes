// One-time optimizer for the KayKit character .glb files.
// Each source model ships ~75 animation clips but the game only plays 7. We drop
// the unused clips, then resample/dedup/prune/quantize and meshopt-compress the
// result. Run with: npm run optimize-models
//
// Originals can always be re-downloaded from the KayKit GitHub releases.

import { readFileSync, statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, resample, meshopt } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

// Clip names the client actually uses (src/main.js: makeCharInstance + ATTACK_CLIP).
const KEEP = new Set([
  "Idle",
  "Running_A",
  "Walking_A",
  "1H_Melee_Attack_Chop",
  "Spellcast_Shoot",
  "1H_Ranged_Shoot",
  "Unarmed_Melee_Attack_Punch_A",
]);

const FILES = [
  "public/models/kaykit/Knight.glb",
  "public/models/kaykit/Mage.glb",
  "public/models/kaykit/Rogue.glb",
  "public/models/kaykit/Rogue_Hooded.glb",
  "public/models/kaykit/Skeleton_Warrior.glb",
];

const kb = (bytes) => (bytes / 1024).toFixed(0) + " KB";

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

let before = 0;
let after = 0;

for (const file of FILES) {
  const startBytes = statSync(file).size;
  before += startBytes;

  const doc = await io.read(file);

  const anims = doc.getRoot().listAnimations();
  let kept = 0;
  for (const anim of anims) {
    if (KEEP.has(anim.getName())) kept += 1;
    else anim.dispose();
  }

  await doc.transform(
    resample(),
    dedup(),
    prune({ keepLeaves: false }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: "high" })
  );

  await io.write(file, doc);

  const endBytes = statSync(file).size;
  after += endBytes;
  console.log(
    `${file}: ${kb(startBytes)} -> ${kb(endBytes)}  (kept ${kept}/${anims.length} clips)`
  );
}

console.log(`\nTotal: ${kb(before)} -> ${kb(after)}  (${(100 * (1 - after / before)).toFixed(0)}% smaller)`);
