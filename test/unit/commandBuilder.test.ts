import { describe, it, expect } from "vitest";
import {
  compileCommand,
  compileCommandList,
  ConstrainedCommandSchema,
  type ConstrainedCommand,
} from "../../src/schema/commands.js";

describe("command builder", () => {
  describe("compileCommand", () => {
    it("compiles showText to 101 + 401 commands", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "showText",
        lines: ["Hello!", "World!"],
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 101, indent: 0, parameters: ["", 0, 0, 2] },
        { code: 401, indent: 0, parameters: ["Hello!"] },
        { code: 401, indent: 0, parameters: ["World!"] },
      ]);
    });

    it("compiles controlSwitches to code 121", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "controlSwitches",
        startId: 1,
        endId: 3,
        value: true,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 121, indent: 0, parameters: [1, 3, 0] },
      ]);
    });

    it("compiles controlSwitches OFF to code 121 with value 1", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "controlSwitches",
        startId: 1,
        endId: 1,
        value: false,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 121, indent: 0, parameters: [1, 1, 1] },
      ]);
    });

    it("compiles controlVariables SET to code 122", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "controlVariables",
        startId: 1,
        endId: 1,
        operation: "set",
        operand: 42,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 122, indent: 0, parameters: [1, 1, 0, 0, 42] },
      ]);
    });

    it("compiles controlVariables ADD to code 122", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "controlVariables",
        startId: 1,
        endId: 1,
        operation: "add",
        operand: 10,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 122, indent: 0, parameters: [1, 1, 1, 0, 10] },
      ]);
    });

    it("compiles callCommonEvent to code 117", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "callCommonEvent",
        commonEventId: 5,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 117, indent: 0, parameters: [5] },
      ]);
    });

    it("compiles playSe to code 250", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "playSe",
        name: "Cursor1",
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 250, indent: 0, parameters: [{ name: "Cursor1", volume: 90, pitch: 100, pan: 0 }] },
      ]);
    });

    it("compiles transferPlayer to code 201", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "transferPlayer",
        mapId: 3,
        x: 10,
        y: 15,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 201, indent: 0, parameters: [0, 3, 10, 15, 0, 0] },
      ]);
    });

    it("compiles conditionalBranch switch to code 400", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "switch",
        switchId: 2,
        switchValue: true,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 400, indent: 0, parameters: [0, 2, 0] },
      ]);
    });

    it("compiles conditionalBranch variable to code 400", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "variable",
        variableId: 5,
        variableOp: 0,
        variableValue: 100,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 400, indent: 0, parameters: [1, 5, 0, 100, 0] },
      ]);
    });

    it("compiles conditionalBranch selfSwitch to code 400", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "selfSwitch",
        selfSwitchCh: "B",
        selfSwitchValue: true,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 400, indent: 0, parameters: [2, "B", 0] },
      ]);
    });

    it("compiles comment to 108 + 408 commands", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "comment",
        lines: ["First line", "Second line"],
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 108, indent: 0, parameters: ["First line"] },
        { code: 408, indent: 0, parameters: ["Second line"] },
      ]);
    });
  });

  describe("compileCommandList", () => {
    it("appends terminator code 0", () => {
      const commands: ConstrainedCommand[] = [
        ConstrainedCommandSchema.parse({
          type: "comment",
          lines: ["Test"],
        }),
      ];
      const result = compileCommandList(commands);
      expect(result[result.length - 1]).toEqual({ code: 0, indent: 0, parameters: [] });
    });

    it("compiles multiple commands in order", () => {
      const commands: ConstrainedCommand[] = [
        ConstrainedCommandSchema.parse({
          type: "controlSwitches",
          startId: 1,
          endId: 1,
          value: true,
        }),
        ConstrainedCommandSchema.parse({
          type: "showText",
          lines: ["Done!"],
        }),
      ];
      const result = compileCommandList(commands);
      expect(result).toEqual([
        { code: 121, indent: 0, parameters: [1, 1, 0] },
        { code: 101, indent: 0, parameters: ["", 0, 0, 2] },
        { code: 401, indent: 0, parameters: ["Done!"] },
        { code: 0, indent: 0, parameters: [] },
      ]);
    });

    it("returns only terminator for empty list", () => {
      const result = compileCommandList([]);
      expect(result).toEqual([{ code: 0, indent: 0, parameters: [] }]);
    });
  });

  describe("schema validation", () => {
    it("rejects unknown command type", () => {
      expect(() =>
        ConstrainedCommandSchema.parse({ type: "unknown" }),
      ).toThrow();
    });

    it("requires lines for showText", () => {
      expect(() =>
        ConstrainedCommandSchema.parse({ type: "showText" }),
      ).toThrow();
    });

    it("requires positive IDs for controlSwitches", () => {
      expect(() =>
        ConstrainedCommandSchema.parse({
          type: "controlSwitches",
          startId: 0,
          endId: 1,
          value: true,
        }),
      ).toThrow();
    });

    it("requires nonnegative coordinates for transferPlayer", () => {
      expect(() =>
        ConstrainedCommandSchema.parse({
          type: "transferPlayer",
          mapId: 1,
          x: -1,
          y: 0,
        }),
      ).toThrow();
    });

    it("throws for conditionalBranch switch without switchId", () => {
      const cmd = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "switch",
        switchValue: true,
      });
      expect(() => compileCommand(cmd)).toThrow("switchId");
    });

    it("throws for conditionalBranch switch without switchValue", () => {
      const cmd = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "switch",
        switchId: 1,
      });
      expect(() => compileCommand(cmd)).toThrow("switchValue");
    });

    it("throws for conditionalBranch variable without variableId", () => {
      const cmd = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "variable",
      });
      expect(() => compileCommand(cmd)).toThrow("variableId");
    });

    it("throws for conditionalBranch selfSwitch without selfSwitchCh", () => {
      const cmd = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "selfSwitch",
        selfSwitchValue: true,
      });
      expect(() => compileCommand(cmd)).toThrow("selfSwitchCh");
    });

    it("throws for conditionalBranch selfSwitch without selfSwitchValue", () => {
      const cmd = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "selfSwitch",
        selfSwitchCh: "A",
      });
      expect(() => compileCommand(cmd)).toThrow("selfSwitchValue");
    });

    it("throws for conditionalBranch actor without actorId", () => {
      const cmd = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "actor",
      });
      expect(() => compileCommand(cmd)).toThrow("actorId");
    });

    it("compiles conditionalBranch actor to code 400", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "actor",
        actorId: 1,
        actorOp: 0,
        actorValue: 5,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 400, indent: 0, parameters: [3, 1, 0, 5, 0] },
      ]);
    });

    it("compiles conditionalBranch switch OFF to code 400 with value 1", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "switch",
        switchId: 1,
        switchValue: false,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 400, indent: 0, parameters: [0, 1, 1] },
      ]);
    });

    it("compiles conditionalBranch selfSwitch OFF to code 400 with value 1", () => {
      const cmd: ConstrainedCommand = ConstrainedCommandSchema.parse({
        type: "conditionalBranch",
        conditionType: "selfSwitch",
        selfSwitchCh: "A",
        selfSwitchValue: false,
      });
      const result = compileCommand(cmd);
      expect(result).toEqual([
        { code: 400, indent: 0, parameters: [2, "A", 1] },
      ]);
    });
  });
});
