import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileChannel } from "../../src/channel/fileChannel.js";

describe("FileChannel", () => {
  let testDir: string;
  let channel: FileChannel;

  beforeEach(() => {
    testDir = join(tmpdir(), `rpgmv-test-channel-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    channel = new FileChannel(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("ensureDirectory", () => {
    it("creates channel directory if it doesn't exist", () => {
      const channelDir = join(testDir, ".bridge");
      expect(existsSync(channelDir)).toBe(false);

      channel.ensureDirectory();

      expect(existsSync(channelDir)).toBe(true);
    });

    it("does not fail if directory already exists", () => {
      channel.ensureDirectory();
      expect(() => channel.ensureDirectory()).not.toThrow();
    });
  });

  describe("sendCommand", () => {
    it("writes command to commands.json", () => {
      const commandId = channel.sendCommand("INSPECT");

      const commandsPath = join(testDir, ".bridge", "commands.json");
      expect(existsSync(commandsPath)).toBe(true);

      const commands = JSON.parse(readFileSync(commandsPath, "utf-8"));
      expect(commands).toHaveLength(1);
      expect(commands[0].id).toBe(commandId);
      expect(commands[0].command).toBe("INSPECT");
    });

    it("writes command with args", () => {
      const commandId = channel.sendCommand("PREVIEW_ITEM", { itemId: 5 });

      const commandsPath = join(testDir, ".bridge", "commands.json");
      const commands = JSON.parse(readFileSync(commandsPath, "utf-8"));

      expect(commands[0].id).toBe(commandId);
      expect(commands[0].command).toBe("PREVIEW_ITEM");
      expect(commands[0].args).toEqual({ itemId: 5 });
    });

    it("appends to existing commands", () => {
      channel.sendCommand("INSPECT");
      channel.sendCommand("PREVIEW_ITEM", { itemId: 1 });

      const commandsPath = join(testDir, ".bridge", "commands.json");
      const commands = JSON.parse(readFileSync(commandsPath, "utf-8"));

      expect(commands).toHaveLength(2);
      expect(commands[0].command).toBe("INSPECT");
      expect(commands[1].command).toBe("PREVIEW_ITEM");
    });
  });

  describe("readRuntimeState", () => {
    it("returns null if runtime-state.json doesn't exist", () => {
      const state = channel.readRuntimeState();
      expect(state).toBeNull();
    });

    it("reads runtime state from file", () => {
      const mockState = {
        timestamp: Date.now(),
        game: { title: "Test Game", versionId: 1 },
        party: null,
        map: null,
        switches: null,
        variables: null,
      };

      const statePath = join(testDir, ".bridge", "runtime-state.json");
      mkdirSync(join(testDir, ".bridge"), { recursive: true });
      writeFileSync(statePath, JSON.stringify(mockState));

      const state = channel.readRuntimeState();

      expect(state).toEqual(mockState);
    });

    it("returns null if file is invalid JSON", () => {
      const statePath = join(testDir, ".bridge", "runtime-state.json");
      mkdirSync(join(testDir, ".bridge"), { recursive: true });
      writeFileSync(statePath, "invalid json");

      const state = channel.readRuntimeState();

      expect(state).toBeNull();
    });
  });

  describe("readResponses", () => {
    it("returns empty array if responses.json doesn't exist", () => {
      const responses = channel.readResponses();
      expect(responses).toEqual([]);
    });

    it("reads responses from file", () => {
      const mockResponses = [
        { id: "1", command: "INSPECT", success: true, result: {}, error: null },
      ];

      const responsesPath = join(testDir, ".bridge", "responses.json");
      mkdirSync(join(testDir, ".bridge"), { recursive: true });
      writeFileSync(responsesPath, JSON.stringify(mockResponses));

      const responses = channel.readResponses();

      expect(responses).toEqual(mockResponses);
    });
  });

  describe("consumeResponses", () => {
    it("reads and clears responses", () => {
      const mockResponses = [
        { id: "1", command: "INSPECT", success: true, result: {}, error: null },
      ];

      const responsesPath = join(testDir, ".bridge", "responses.json");
      mkdirSync(join(testDir, ".bridge"), { recursive: true });
      writeFileSync(responsesPath, JSON.stringify(mockResponses));

      const responses = channel.consumeResponses();

      expect(responses).toEqual(mockResponses);

      const remaining = JSON.parse(readFileSync(responsesPath, "utf-8"));
      expect(remaining).toEqual([]);
    });

    it("returns empty array if no responses", () => {
      const responses = channel.consumeResponses();
      expect(responses).toEqual([]);
    });
  });

  describe("clear", () => {
    it("clears all channel files", () => {
      const bridgeDir = join(testDir, ".bridge");
      mkdirSync(bridgeDir, { recursive: true });

      writeFileSync(join(bridgeDir, "commands.json"), "[{}]");
      writeFileSync(join(bridgeDir, "responses.json"), "[{}]");
      writeFileSync(join(bridgeDir, "runtime-state.json"), "{}");

      channel.clear();

      expect(JSON.parse(readFileSync(join(bridgeDir, "commands.json"), "utf-8"))).toEqual([]);
      expect(JSON.parse(readFileSync(join(bridgeDir, "responses.json"), "utf-8"))).toEqual([]);
      expect(readFileSync(join(bridgeDir, "runtime-state.json"), "utf-8")).toBe("null");
    });
  });
});
