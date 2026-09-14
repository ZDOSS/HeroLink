import { z } from "zod";
import { EventCommandSchema } from "./entities.js";
import { invalid } from "./safety.js";

export interface EventCommand {
  code: number;
  indent: number;
  parameters: unknown[];
}

const ShowTextCommand = z.object({
  type: z.literal("showText"),
  faceName: z.string().default(""),
  faceIndex: z.number().int().default(0),
  background: z.number().int().default(0),
  position: z.number().int().default(2),
  lines: z.array(z.string()).min(1),
});

const ControlSwitchesCommand = z.object({
  type: z.literal("controlSwitches"),
  startId: z.number().int().positive(),
  endId: z.number().int().positive(),
  value: z.boolean(),
});

const ControlVariablesCommand = z.object({
  type: z.literal("controlVariables"),
  startId: z.number().int().positive(),
  endId: z.number().int().positive(),
  operation: z.enum(["set", "add", "sub"]).default("set"),
  operand: z.number().int().default(0),
});

const CallCommonEventCommand = z.object({
  type: z.literal("callCommonEvent"),
  commonEventId: z.number().int().positive(),
});

const PlaySeCommand = z.object({
  type: z.literal("playSe"),
  name: z.string(),
  volume: z.number().default(90),
  pitch: z.number().default(100),
  pan: z.number().default(0),
});

const TransferPlayerCommand = z.object({
  type: z.literal("transferPlayer"),
  mapId: z.number().int().positive(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  direction: z.number().int().default(0),
});

const ConditionalBranchCommand = z.object({
  type: z.literal("conditionalBranch"),
  conditionType: z.enum(["switch", "variable", "selfSwitch", "actor"]),
  switchId: z.number().int().positive().optional(),
  switchValue: z.boolean().optional(),
  variableId: z.number().int().positive().optional(),
  variableValue: z.number().int().optional(),
  variableOp: z.number().int().min(0).max(5).default(0),
  selfSwitchCh: z.enum(["A", "B", "C", "D"]).optional(),
  selfSwitchValue: z.boolean().optional(),
  actorId: z.number().int().positive().optional(),
  actorOp: z.number().int().min(0).max(6).default(0),
  actorValue: z.union([z.string(), z.number().int()]).optional(),
});

const CommentCommand = z.object({
  type: z.literal("comment"),
  lines: z.array(z.string()).min(1),
});

// === Advanced event commands (v6 per-opcode schemas) ===

const ControlSelfSwitchCommand = z.object({
  type: z.literal("controlSelfSwitch"),
  selfSwitchCh: z.enum(["A", "B", "C", "D"]),
  value: z.boolean(),
});

const ChangeGoldCommand = z.object({
  type: z.literal("changeGold"),
  operation: z.enum(["increase", "decrease"]),
  operand: z.number().int().nonnegative(),
});

const ChangeItemsCommand = z.object({
  type: z.literal("changeItems"),
  itemId: z.number().int().positive(),
  operation: z.enum(["increase", "decrease"]),
  operand: z.number().int().nonnegative(),
});

const ChangeHpCommand = z.object({
  type: z.literal("changeHp"),
  actorId: z.number().int().positive(),
  operation: z.enum(["increase", "decrease"]),
  operand: z.number().int().nonnegative(),
  allowKnockout: z.boolean().default(false),
});

const ShowAnimationCommand = z.object({
  type: z.literal("showAnimation"),
  characterId: z.number().int().min(-1),
  animationId: z.number().int().positive(),
  waitForCompletion: z.boolean().default(false),
});

const WaitCommand = z.object({
  type: z.literal("wait"),
  frames: z.number().int().positive(),
});

const PlayBgmCommand = z.object({
  type: z.literal("playBgm"),
  name: z.string().min(1),
  volume: z.number().int().min(0).max(100).default(90),
  pitch: z.number().int().min(50).max(150).default(100),
  pan: z.number().int().min(-100).max(100).default(0),
});

const LabelCommand = z.object({
  type: z.literal("label"),
  name: z.string().min(1),
});

const JumpToLabelCommand = z.object({
  type: z.literal("jumpToLabel"),
  name: z.string().min(1),
});

const BaseCommandSchema = z.discriminatedUnion("type", [
  ShowTextCommand,
  ControlSwitchesCommand,
  ControlVariablesCommand,
  CallCommonEventCommand,
  PlaySeCommand,
  TransferPlayerCommand,
  ConditionalBranchCommand,
  CommentCommand,
  ControlSelfSwitchCommand,
  ChangeGoldCommand,
  ChangeItemsCommand,
  ChangeHpCommand,
  ShowAnimationCommand,
  WaitCommand,
  PlayBgmCommand,
  LabelCommand,
  JumpToLabelCommand,
]);

export type ConstrainedCommand = z.infer<typeof BaseCommandSchema> & {
  then?: ConstrainedCommand[];
  else?: ConstrainedCommand[];
};
export const ConstrainedCommandSchema: z.ZodType<ConstrainedCommand, z.ZodTypeDef, unknown> =
  z.lazy(() =>
    z
      .discriminatedUnion("type", [
        ShowTextCommand,
        ControlSwitchesCommand,
        ControlVariablesCommand,
        CallCommonEventCommand,
        PlaySeCommand,
        TransferPlayerCommand,
        ConditionalBranchCommand.extend({
          // biome-ignore lint/suspicious/noThenProperty: declarative branch body, never callable
          then: z.array(ConstrainedCommandSchema).default([]),
          else: z.array(ConstrainedCommandSchema).optional(),
        }),
        CommentCommand,
        ControlSelfSwitchCommand,
        ChangeGoldCommand,
        ChangeItemsCommand,
        ChangeHpCommand,
        ShowAnimationCommand,
        WaitCommand,
        PlayBgmCommand,
        LabelCommand,
        JumpToLabelCommand,
      ])
      .superRefine((command, ctx) => {
        const fail = (message: string) => ctx.addIssue({ code: "custom", message });
        if (
          (command.type === "controlSwitches" || command.type === "controlVariables") &&
          command.endId < command.startId
        )
          fail("endId must be at least startId");
        if (command.type === "conditionalBranch") {
          if (
            command.conditionType === "switch" &&
            (command.switchId === undefined || command.switchValue === undefined)
          )
            fail("Switch condition requires switchId and switchValue");
          if (
            command.conditionType === "variable" &&
            (command.variableId === undefined || command.variableValue === undefined)
          )
            fail("Variable condition requires variableId and variableValue");
          if (
            command.conditionType === "selfSwitch" &&
            (command.selfSwitchCh === undefined || command.selfSwitchValue === undefined)
          )
            fail("Self-switch condition requires channel and value");
          if (
            command.conditionType === "actor" &&
            (command.actorId === undefined ||
              (command.actorOp === 1
                ? typeof command.actorValue !== "string"
                : command.actorOp > 1 &&
                  (typeof command.actorValue !== "number" || command.actorValue <= 0)))
          )
            fail(
              "Actor condition requires a valid actor and operand (name for operation 1, ID for 2–6)",
            );
        }
      }),
  );

export function compileCommand(command: ConstrainedCommand, indent = 0): EventCommand[] {
  switch (command.type) {
    case "showText":
      return compileShowText(command, indent);
    case "controlSwitches":
      return compileControlSwitches(command, indent);
    case "controlVariables":
      return compileControlVariables(command, indent);
    case "callCommonEvent":
      return compileCallCommonEvent(command, indent);
    case "playSe":
      return compilePlaySe(command, indent);
    case "transferPlayer":
      return compileTransferPlayer(command, indent);
    case "conditionalBranch":
      return compileConditionalBranch(command, indent);
    case "comment":
      return compileComment(command, indent);
    case "controlSelfSwitch":
      return compileControlSelfSwitch(command, indent);
    case "changeGold":
      return compileChangeGold(command, indent);
    case "changeItems":
      return compileChangeItems(command, indent);
    case "changeHp":
      return compileChangeHp(command, indent);
    case "showAnimation":
      return compileShowAnimation(command, indent);
    case "wait":
      return compileWait(command, indent);
    case "playBgm":
      return compilePlayBgm(command, indent);
    case "label":
      return compileLabel(command, indent);
    case "jumpToLabel":
      return compileJumpToLabel(command, indent);
    default: {
      const _exhaustive: never = command;
      throw new Error(`Unknown command type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function compileShowText(cmd: z.infer<typeof ShowTextCommand>, indent: number): EventCommand[] {
  const commands: EventCommand[] = [
    { code: 101, indent, parameters: [cmd.faceName, cmd.faceIndex, cmd.background, cmd.position] },
  ];
  for (const line of cmd.lines) {
    commands.push({ code: 401, indent, parameters: [line] });
  }
  return commands;
}

function compileControlSwitches(
  cmd: z.infer<typeof ControlSwitchesCommand>,
  indent: number,
): EventCommand[] {
  return [{ code: 121, indent, parameters: [cmd.startId, cmd.endId, cmd.value ? 0 : 1] }];
}

function compileControlVariables(
  cmd: z.infer<typeof ControlVariablesCommand>,
  indent: number,
): EventCommand[] {
  const opMap = { set: 0, add: 1, sub: 2 };
  return [
    {
      code: 122,
      indent,
      parameters: [cmd.startId, cmd.endId, opMap[cmd.operation], 0, cmd.operand],
    },
  ];
}

function compileCallCommonEvent(
  cmd: z.infer<typeof CallCommonEventCommand>,
  indent: number,
): EventCommand[] {
  return [{ code: 117, indent, parameters: [cmd.commonEventId] }];
}

function compilePlaySe(cmd: z.infer<typeof PlaySeCommand>, indent: number): EventCommand[] {
  return [
    {
      code: 250,
      indent,
      parameters: [{ name: cmd.name, volume: cmd.volume, pitch: cmd.pitch, pan: cmd.pan }],
    },
  ];
}

function compileTransferPlayer(
  cmd: z.infer<typeof TransferPlayerCommand>,
  indent: number,
): EventCommand[] {
  return [{ code: 201, indent, parameters: [0, cmd.mapId, cmd.x, cmd.y, cmd.direction, 0] }];
}

function compileConditionalBranch(
  cmd: z.infer<typeof ConditionalBranchCommand>,
  indent: number,
): EventCommand[] {
  switch (cmd.conditionType) {
    case "switch":
      if (cmd.switchId === undefined || cmd.switchValue === undefined) {
        throw new Error("Switch condition requires switchId and switchValue");
      }
      return [{ code: 111, indent, parameters: [0, cmd.switchId, cmd.switchValue ? 0 : 1] }];
    case "variable":
      if (cmd.variableId === undefined) {
        throw new Error("Variable condition requires variableId");
      }
      return [
        {
          code: 111,
          indent,
          parameters: [1, cmd.variableId, 0, cmd.variableValue, cmd.variableOp],
        },
      ];
    case "selfSwitch":
      if (cmd.selfSwitchCh === undefined || cmd.selfSwitchValue === undefined) {
        throw new Error("Self-switch condition requires selfSwitchCh and selfSwitchValue");
      }
      return [
        { code: 111, indent, parameters: [2, cmd.selfSwitchCh, cmd.selfSwitchValue ? 0 : 1] },
      ];
    case "actor":
      if (cmd.actorId === undefined) {
        throw new Error("Actor condition requires actorId");
      }
      return [
        { code: 111, indent, parameters: [4, cmd.actorId, cmd.actorOp, cmd.actorValue ?? 0] },
      ];
    default: {
      const _exhaustive: never = cmd.conditionType;
      throw new Error(`Unknown condition type: ${_exhaustive}`);
    }
  }
}

function compileComment(cmd: z.infer<typeof CommentCommand>, indent: number): EventCommand[] {
  const commands: EventCommand[] = [];
  for (let i = 0; i < cmd.lines.length; i++) {
    commands.push({
      code: i === 0 ? 108 : 408,
      indent,
      parameters: [cmd.lines[i]],
    });
  }
  return commands;
}

function compileControlSelfSwitch(
  cmd: z.infer<typeof ControlSelfSwitchCommand>,
  indent: number,
): EventCommand[] {
  return [{ code: 123, indent, parameters: [cmd.selfSwitchCh, cmd.value ? 0 : 1] }];
}

function compileChangeGold(cmd: z.infer<typeof ChangeGoldCommand>, indent: number): EventCommand[] {
  return [
    { code: 125, indent, parameters: [cmd.operation === "increase" ? 0 : 1, 0, cmd.operand] },
  ];
}

function compileChangeItems(
  cmd: z.infer<typeof ChangeItemsCommand>,
  indent: number,
): EventCommand[] {
  return [
    {
      code: 126,
      indent,
      parameters: [cmd.itemId, cmd.operation === "increase" ? 0 : 1, 0, cmd.operand],
    },
  ];
}

function compileChangeHp(cmd: z.infer<typeof ChangeHpCommand>, indent: number): EventCommand[] {
  return [
    {
      code: 311,
      indent,
      parameters: [
        0,
        cmd.actorId,
        cmd.operation === "increase" ? 0 : 1,
        0,
        cmd.operand,
        cmd.allowKnockout,
      ],
    },
  ];
}

function compileShowAnimation(
  cmd: z.infer<typeof ShowAnimationCommand>,
  indent: number,
): EventCommand[] {
  return [
    {
      code: 212,
      indent,
      parameters: [cmd.characterId, cmd.animationId, cmd.waitForCompletion],
    },
  ];
}

function compileWait(cmd: z.infer<typeof WaitCommand>, indent: number): EventCommand[] {
  return [{ code: 230, indent, parameters: [cmd.frames] }];
}

function compilePlayBgm(cmd: z.infer<typeof PlayBgmCommand>, indent: number): EventCommand[] {
  return [
    {
      code: 241,
      indent,
      parameters: [{ name: cmd.name, volume: cmd.volume, pitch: cmd.pitch, pan: cmd.pan }],
    },
  ];
}

function compileLabel(cmd: z.infer<typeof LabelCommand>, indent: number): EventCommand[] {
  return [{ code: 118, indent, parameters: [cmd.name] }];
}

function compileJumpToLabel(
  cmd: z.infer<typeof JumpToLabelCommand>,
  indent: number,
): EventCommand[] {
  return [{ code: 119, indent, parameters: [cmd.name] }];
}

// Positional parameters match RPG Maker MV Game_Interpreter command111/311/212.
// Branch bodies must be nested, including the child terminators used by skipBranch.
export function compileCommandList(commands: ConstrainedCommand[], indent = 0): EventCommand[] {
  const result: EventCommand[] = [];
  for (const input of commands) {
    const cmd = ConstrainedCommandSchema.parse(input);
    result.push(...compileCommand(cmd, indent));
    if (cmd.type === "conditionalBranch") {
      result.push(...compileCommandList(cmd.then ?? [], indent + 1));
      if (cmd.else) {
        result.push({ code: 411, indent, parameters: [] });
        result.push(...compileCommandList(cmd.else, indent + 1));
      }
      result.push({ code: 412, indent, parameters: [] });
    }
  }
  result.push({ code: 0, indent, parameters: [] });
  return result;
}

// Persisted staging is untrusted too. Only builder-supported opcodes and operand
// modes are accepted; in particular scripts, variable-script operands and move
// scripts cannot be smuggled through an edited staging file.
export function assertConstrainedList(value: unknown): void {
  const list = EventCommandSchema.array().min(1).parse(value);
  const n = z.number().int();
  const id = n.positive();
  const bit = z.union([z.literal(0), z.literal(1)]);
  const empty = z.tuple([]);
  const audio = z
    .object({
      name: z.string(),
      volume: n.min(0).max(100),
      pitch: n.min(50).max(150),
      pan: n.min(-100).max(100),
    })
    .strict();
  const parameters: Record<number, z.ZodTypeAny> = {
    0: empty,
    101: z.tuple([z.string(), n.min(0).max(7), n.min(0).max(2), n.min(0).max(2)]),
    401: z.tuple([z.string()]),
    108: z.tuple([z.string()]),
    408: z.tuple([z.string()]),
    121: z.tuple([id, id, bit]),
    122: z.tuple([id, id, n.min(0).max(2), z.literal(0), n]),
    117: z.tuple([id]),
    250: z.tuple([audio]),
    241: z.tuple([audio]),
    201: z.tuple([
      z.literal(0),
      id,
      n.nonnegative(),
      n.nonnegative(),
      z.union([z.literal(0), z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
      z.literal(0),
    ]),
    123: z.tuple([z.enum(["A", "B", "C", "D"]), bit]),
    125: z.tuple([bit, z.literal(0), n.nonnegative()]),
    126: z.tuple([id, bit, z.literal(0), n.nonnegative()]),
    311: z.tuple([z.literal(0), id, bit, z.literal(0), n.nonnegative(), z.boolean()]),
    212: z.tuple([n.min(-1), id, z.boolean()]),
    230: z.tuple([id]),
    118: z.tuple([z.string().min(1)]),
    119: z.tuple([z.string().min(1)]),
    111: z.union([
      z.tuple([z.literal(0), id, bit]),
      z.tuple([z.literal(1), id, z.literal(0), n, n.min(0).max(5)]),
      z.tuple([z.literal(2), z.enum(["A", "B", "C", "D"]), bit]),
      z.tuple([z.literal(4), id, n.min(0).max(6), z.union([n, z.string()])]),
    ]),
    411: empty,
    412: empty,
  };
  const branches: { indent: number; otherwise: boolean }[] = [];
  for (const command of list) {
    const schema = parameters[command.code];
    if (!schema?.safeParse(command.parameters).success)
      invalid(`Unsupported command or operands: ${command.code}`);
    if (command.code === 411 || command.code === 412) {
      const branch = branches.at(-1);
      if (!branch || branch.indent !== command.indent || (command.code === 411 && branch.otherwise))
        invalid("Unbalanced event branch");
      if (command.code === 412) branches.pop();
      else branch.otherwise = true;
    } else {
      if (command.indent !== branches.length) invalid("Invalid event command indentation");
      if (command.code === 111) branches.push({ indent: command.indent, otherwise: false });
    }
  }
  if (branches.length || list.at(-1)?.code !== 0 || list.at(-1)?.indent !== 0)
    invalid("Event list must end outside all branches");
}
