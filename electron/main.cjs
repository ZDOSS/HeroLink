// Electron bootstrap must stay .cjs in this ESM package.
import("./main.mjs").catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
