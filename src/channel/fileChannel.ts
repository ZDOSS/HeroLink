import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import writeFileAtomic from "write-file-atomic";

export interface BridgeCommand {
  id: string;
  command: string;
  args?: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string | null;
  command: string;
  success: boolean;
  result: unknown;
  error: string | null;
}

export interface RuntimeState {
  timestamp: number;
  game: {
    title: string;
    versionId: number;
  } | null;
  party: {
    members: Array<{
      id: number;
      name: string;
      level: number;
      hp: number;
      mp: number;
      tp: number;
    }>;
    gold: number;
  } | null;
  map: {
    mapId: number;
    displayName: string;
    playerX: number | null;
    playerY: number | null;
    playerDirection: number | null;
  } | null;
  switches: boolean[] | null;
  variables: number[] | null;
}

export class FileChannel {
  private readonly channelDir: string;

  constructor(projectDir: string, channelSubdir = ".bridge") {
    this.channelDir = join(projectDir, channelSubdir);
  }

  /**
   * Ensure the channel directory exists.
   */
  ensureDirectory(): void {
    if (!existsSync(this.channelDir)) {
      mkdirSync(this.channelDir, { recursive: true });
    }
  }

  /**
   * Read the current runtime state written by the plugin.
   */
  readRuntimeState(): RuntimeState | null {
    const filepath = join(this.channelDir, "runtime-state.json");
    if (!existsSync(filepath)) {
      return null;
    }
    try {
      const content = readFileSync(filepath, "utf-8");
      return JSON.parse(content) as RuntimeState;
    } catch {
      return null;
    }
  }

  /**
   * Send a command to the plugin by writing to commands.json.
   * Returns the command ID for tracking responses.
   */
  sendCommand(command: string, args?: Record<string, unknown>): string {
    this.ensureDirectory();

    const id = randomUUID();
    const cmd: BridgeCommand = { id, command, args };

    // Read existing commands
    const commands = this.readCommands();
    commands.push(cmd);

    // Write back atomically
    const filepath = join(this.channelDir, "commands.json");
    writeFileAtomic.sync(filepath, JSON.stringify(commands, null, 2), "utf-8");

    return id;
  }

  /**
   * Send multiple commands at once.
   */
  sendCommands(commands: Array<{ command: string; args?: Record<string, unknown> }>): string[] {
    this.ensureDirectory();

    const ids: string[] = [];
    const existingCommands = this.readCommands();

    for (const cmd of commands) {
      const id = randomUUID();
      existingCommands.push({ id, command: cmd.command, args: cmd.args });
      ids.push(id);
    }

    const filepath = join(this.channelDir, "commands.json");
    writeFileAtomic.sync(filepath, JSON.stringify(existingCommands, null, 2), "utf-8");

    return ids;
  }

  /**
   * Read responses from the plugin.
   */
  readResponses(): BridgeResponse[] {
    const filepath = join(this.channelDir, "responses.json");
    if (!existsSync(filepath)) {
      return [];
    }
    try {
      const content = readFileSync(filepath, "utf-8");
      return JSON.parse(content) as BridgeResponse[];
    } catch {
      return [];
    }
  }

  /**
   * Read and clear responses (atomic read-then-delete).
   */
  consumeResponses(): BridgeResponse[] {
    const responses = this.readResponses();
    if (responses.length > 0) {
      const filepath = join(this.channelDir, "responses.json");
      writeFileAtomic.sync(filepath, "[]", "utf-8");
    }
    return responses;
  }

  /**
   * Wait for a specific command response by ID.
   * Polls responses.json until the response appears or timeout.
   * Removes the matched response from the file after finding it.
   */
  async waitForResponse(commandId: string, timeoutMs = 5000): Promise<BridgeResponse | null> {
    const startTime = Date.now();
    const pollInterval = 100; // ms

    while (Date.now() - startTime < timeoutMs) {
      const responses = this.readResponses();
      const responseIndex = responses.findIndex((r) => r.id === commandId);

      if (responseIndex !== -1) {
        // Re-read the file to merge any responses the plugin may have
        // appended between our read and this write (TOCTOU prevention).
        const filepath = join(this.channelDir, "responses.json");
        const currentResponses = this.readResponses();
        const currentIndex = currentResponses.findIndex((r) => r.id === commandId);
        if (currentIndex !== -1) {
          const remaining = currentResponses.filter((_, i) => i !== currentIndex);
          writeFileAtomic.sync(filepath, JSON.stringify(remaining, null, 2), "utf-8");
        }
        return responses[responseIndex];
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return null;
  }

  /**
   * Clear all channel files (useful for testing).
   */
  clear(): void {
    this.ensureDirectory();
    const files = ["commands.json", "responses.json", "runtime-state.json"];
    for (const file of files) {
      const filepath = join(this.channelDir, file);
      if (existsSync(filepath)) {
        // runtime-state.json holds an object, so clear with "null"
        // commands.json and responses.json hold arrays, so clear with "[]"
        const content = file === "runtime-state.json" ? "null" : "[]";
        writeFileAtomic.sync(filepath, content, "utf-8");
      }
    }
  }

  /**
   * Read commands from commands.json (internal helper).
   */
  private readCommands(): BridgeCommand[] {
    const filepath = join(this.channelDir, "commands.json");
    if (!existsSync(filepath)) {
      return [];
    }
    try {
      const content = readFileSync(filepath, "utf-8");
      return JSON.parse(content) as BridgeCommand[];
    } catch {
      return [];
    }
  }
}
