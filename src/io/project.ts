import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { EngineAdapter } from "../engine/adapter.js";
import { MvAdapter } from "../engine/mv.js";
import { MzAdapter } from "../engine/mz.js";
import { ProjectNotFoundError } from "../errors.js";
import { logger } from "../log.js";
import { type NormalizedModel, buildNormalizedModel } from "../model/normalized.js";
import { recoverInterruptedTransaction } from "../mutate/apply.js";
import { getRelPath } from "../mutate/paths.js";
import { Staging } from "../mutate/staging.js";
import { withProjectLock } from "./lock.js";
import { resolveProjectPathSafe } from "./paths.js";

export interface Project {
  projectDir: string;
  adapter: EngineAdapter;
  model: NormalizedModel;
  staging: Staging;
}

const MV_MARKER = "Game.rpgproject";
const MZ_MARKER = "Game.mzproject";

export function detectAdapter(projectDir: string): EngineAdapter {
  if (existsSync(join(projectDir, MZ_MARKER))) {
    return new MzAdapter();
  }
  return new MvAdapter();
}

export function findProjectDir(startDir: string): string {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, MV_MARKER)) || existsSync(join(dir, MZ_MARKER))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new ProjectNotFoundError(startDir);
    }
    dir = parent;
  }
}

export function loadProject(directory: string, adapter?: EngineAdapter): Project {
  if (!existsSync(join(directory, MV_MARKER)) && !existsSync(join(directory, MZ_MARKER))) {
    throw new ProjectNotFoundError(directory);
  }

  const projectDir = realpathSync(directory);
  const engineAdapter = adapter ?? detectAdapter(projectDir);

  const bridgeDir = resolveProjectPathSafe(projectDir, ".bridge");
  if (!existsSync(bridgeDir)) {
    mkdirSync(bridgeDir, { recursive: true });
    logger.info({ bridgeDir }, "Created .bridge directory");
  }

  return withProjectLock(projectDir, () => {
    recoverInterruptedTransaction(projectDir);
    const model = buildNormalizedModel(projectDir, engineAdapter);
    const staging = new Staging(projectDir, () =>
      Object.fromEntries(
        [...model.fileSnapshots].map(([file, snapshot]) => [
          getRelPath(file, projectDir),
          snapshot.hash,
        ]),
      ),
    );

    return {
      projectDir,
      adapter: engineAdapter,
      model,
      staging,
    };
  });
}
