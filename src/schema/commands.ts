import { z } from "zod";

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
  variableOp: z.number().int().default(0),
  selfSwitchCh: z.string().optional(),
  selfSwitchValue: z.boolean().optional(),
  actorId: z.number().int().positive().optional(),
  actorOp: z.number().int().default(0),
  actorValue: z.number().int().optional(),
});

const CommentCommand = z.object({
  type: z.literal("comment"),
  lines: z.array(z.string()).min(1),
});

export const ConstrainedCommandSchema = z.discriminatedUnion("type", [
  ShowTextCommand,
  ControlSwitchesCommand,
  ControlVariablesCommand,
  CallCommonEventCommand,
  PlaySeCommand,
  TransferPlayerCommand,
  ConditionalBranchCommand,
  CommentCommand,
]);

export type ConstrainedCommand = z.infer<typeof ConstrainedCommandSchema>;

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
          parameters: [1, cmd.variableId, cmd.variableOp, cmd.variableValue ?? 0, 0],
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
        { code: 111, indent, parameters: [3, cmd.actorId, cmd.actorOp, cmd.actorValue ?? 0, 0] },
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

export function compileCommandList(commands: ConstrainedCommand[]): EventCommand[] {
  const result: EventCommand[] = [];
  for (const cmd of commands) {
    result.push(...compileCommand(cmd));
  }
  result.push({ code: 0, indent: 0, parameters: [] });
  return result;
}
