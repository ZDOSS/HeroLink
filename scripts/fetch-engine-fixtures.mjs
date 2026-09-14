import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";

// Reference exports are fetched at immutable commits for compatibility testing.
// They remain outside the distributable application; no game strings are executed.
export const sources = {
  mv: "https://raw.githubusercontent.com/Apress/beg-rpg-maker-mv/008e49db37e27b4da612c53fe2061bee09f2c28e/9781484219669/9781484219669_Ch1/Chapter%201/data/",
  mz: "https://raw.githubusercontent.com/nz-prism/RPG-Maker-MZ/72424a466258667e6128eeff4d5c08c38a69e333/FieldAction/data/",
};
const destination = join(process.cwd(), ".cache/engine-fixtures");
async function download(url, file, json = true) {
  if (existsSync(file)) {
    if (json) JSON.parse(readFileSync(file, "utf8"));
    return;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Reference fixture download failed: ${response.status} ${url}`);
  const text = await response.text();
  if (json) JSON.parse(text);
  writeFileAtomic.sync(file, text);
}
for (const [engine, base] of Object.entries(sources)) {
  const dir = join(destination, engine);
  mkdirSync(dir, { recursive: true });
  await Promise.all(
    [
      "Actors.json",
      "Skills.json",
      "States.json",
      "Enemies.json",
      "Weapons.json",
      "Animations.json",
      "Map001.json",
    ].map((name) => download(base + name, join(dir, name))),
  );
}
await download(
  "https://raw.githubusercontent.com/rpgtkoolmv/corescript/182e31449707ba7e406db0485c44c2a9d11e2dcd/js/rpg_objects/Game_Interpreter.js",
  join(destination, "Game_Interpreter.js"),
  false,
);
await download(
  "https://raw.githubusercontent.com/rpgtkoolmv/corescript/182e31449707ba7e406db0485c44c2a9d11e2dcd/LICENSE",
  join(destination, "corescript-LICENSE"),
  false,
);
process.stderr.write("Pinned MV/MZ reference exports are available for compatibility tests.\n");
