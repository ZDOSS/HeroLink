import { describe, expect, it } from "vitest";
import {
  assertConstrainedList,
  compileCommand,
  compileCommandList,
  ConstrainedCommandSchema,
} from "../../src/schema/commands.js";
const parse = (value: any) => ConstrainedCommandSchema.parse(value);
const branch = (type: string, values: object = {}) =>
  parse({ type: "conditionalBranch", conditionType: type, ...values });
describe("constrained command persistence", () => {
  it("accepts nested then/else structure and all supported operand forms", () => {
    const list = compileCommandList([
      branch("switch", {
        switchId: 1,
        switchValue: false,
        then: [
          branch("selfSwitch", {
            selfSwitchCh: "A",
            selfSwitchValue: false,
            then: [{ type: "wait", frames: 1 }],
            else: [],
          }),
        ],
        else: [{ type: "comment", lines: ["otherwise", "continued"] }],
      }),
    ]);
    expect(() => assertConstrainedList(list)).not.toThrow();
    expect(list.filter((c) => c.code === 411)).toHaveLength(2);
    expect(list.some((c) => c.indent === 2)).toBe(true);
  });
  it.each([
    "unsupported opcode",
    "invalid operands",
    "unmatched else",
    "duplicate else",
    "bad indent",
    "unclosed branch",
    "missing terminator",
  ])("rejects %s in persisted lists", (kind) => {
    const list = compileCommandList([
      branch("switch", {
        switchId: 1,
        switchValue: true,
        then: [{ type: "wait", frames: 1 }],
        else: [],
      }),
    ]);
    if (kind === "unsupported opcode") list[1].code = 355;
    if (kind === "invalid operands") list[1].parameters = ["not a number"];
    if (kind === "unmatched else") list[0].code = 411;
    if (kind === "duplicate else") {
      const i = list.findIndex((c) => c.code === 411);
      list.splice(i + 1, 0, structuredClone(list[i]));
    }
    if (kind === "bad indent") list[1].indent = 0;
    if (kind === "unclosed branch")
      list.splice(
        list.findIndex((c) => c.code === 412),
        1,
      );
    if (kind === "missing terminator") list.pop();
    expect(() => assertConstrainedList(list)).toThrow();
  });
  it("rejects reversed ranges and missing condition operands at both schema and compiler boundaries", () => {
    for (const type of ["controlSwitches", "controlVariables"])
      expect(() => parse({ type, startId: 2, endId: 1, value: true })).toThrow();
    for (const type of ["switch", "variable", "selfSwitch", "actor"]) {
      expect(() => branch(type)).toThrow();
      expect(() =>
        compileCommand({ type: "conditionalBranch", conditionType: type } as any),
      ).toThrow();
    }
    expect(() =>
      compileCommand({ type: "conditionalBranch", conditionType: "unknown" } as any),
    ).toThrow();
    expect(() => compileCommand({ type: "unknown" } as any)).toThrow();
    expect(() => branch("actor", { actorId: 1, actorOp: 1, actorValue: 1 })).toThrow();
    expect(() => branch("actor", { actorId: 1, actorOp: 2, actorValue: 0 })).toThrow();
    expect(() => branch("actor", { actorId: 1, actorOp: 1, actorValue: "Name" })).not.toThrow();
  });
});
