import { z } from "zod";

export const DamageSchema = z.object({
  type: z.number().int(),
  elementId: z.number().int(),
  formula: z.string(),
  variance: z.number().int(),
  critical: z.boolean(),
});

export const EffectSchema = z.object({
  code: z.number().int(),
  dataId: z.number().int(),
  value1: z.number(),
  value2: z.number(),
});

export const TraitSchema = z.object({
  code: z.number().int(),
  dataId: z.number().int(),
  value: z.number(),
});

export const AudioSchema = z.object({
  name: z.string(),
  volume: z.number(),
  pitch: z.number(),
  pan: z.number(),
});

export const ItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  iconIndex: z.number().int(),
  description: z.string(),
  itypeId: z.number().int(),
  scope: z.number().int(),
  occasion: z.number().int(),
  speed: z.number().int(),
  successRate: z.number().int(),
  repeats: z.number().int(),
  tpGain: z.number().int(),
  hitType: z.number().int(),
  animationId: z.number().int(),
  price: z.number().int(),
  consumable: z.boolean(),
  damage: DamageSchema,
  effects: z.array(EffectSchema),
  note: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const SkillSchema = ItemSchema.omit({ itypeId: true, consumable: true, price: true }).extend(
  {
    stypeId: z.number().int(),
    mpCost: z.number().int(),
    tpCost: z.number().int(),
    message1: z.string(),
    message2: z.string(),
    requiredWtypeId1: z.number().int(),
    requiredWtypeId2: z.number().int(),
  },
);

export const WeaponSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  iconIndex: z.number().int(),
  description: z.string(),
  wtypeId: z.number().int(),
  price: z.number().int(),
  etypeId: z.number().int(),
  params: z.array(z.number().int()).length(8),
  traits: z.array(TraitSchema),
  note: z.string(),
});

export const ArmorSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  iconIndex: z.number().int(),
  description: z.string(),
  atypeId: z.number().int(),
  etypeId: z.number().int(),
  price: z.number().int(),
  params: z.array(z.number().int()).length(8),
  traits: z.array(TraitSchema),
  note: z.string(),
});

export const StateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  iconIndex: z.number().int(),
  restriction: z.number().int(),
  priority: z.number().int(),
  motion: z.number().int(),
  overlay: z.number().int(),
  removeAtBattleEnd: z.boolean(),
  removeByRestriction: z.boolean(),
  autoRemovalTiming: z.number().int(),
  minTurns: z.number().int(),
  maxTurns: z.number().int(),
  removeByDamage: z.number().int(),
  chanceByDamage: z.number().int(),
  removeByWalking: z.number().int(),
  stepsToRemove: z.number().int(),
  message1: z.string(),
  message2: z.string(),
  message3: z.string(),
  message4: z.string(),
  traits: z.array(TraitSchema),
  note: z.string(),
});

export const EnemyActionSchema = z.object({
  conditionType: z.number().int(),
  conditionParam1: z.number().int(),
  conditionParam2: z.number().int(),
  rating: z.number().int(),
  skillId: z.number().int(),
});

export const DropItemSchema = z.object({
  kind: z.number().int(),
  dataId: z.number().int(),
  denominator: z.number().int(),
});

export const EnemySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  battlerName: z.string(),
  battlerHue: z.number().int(),
  params: z.array(z.number().int()).length(8),
  exp: z.number().int(),
  gold: z.number().int(),
  dropItems: z.array(DropItemSchema),
  actions: z.array(EnemyActionSchema),
  traits: z.array(TraitSchema),
  note: z.string(),
});

export const ActorSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  nickname: z.string(),
  classId: z.number().int(),
  initialLevel: z.number().int(),
  maxLevel: z.number().int(),
  profile: z.string(),
  faceName: z.string(),
  faceIndex: z.number().int(),
  characterName: z.string(),
  characterIndex: z.number().int(),
  battlerName: z.string(),
  equips: z.array(z.number().int()),
  traits: z.array(TraitSchema),
  note: z.string(),
});

export const LearningSchema = z.object({
  level: z.number().int(),
  skillId: z.number().int(),
  note: z.string(),
});

export const ClassSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  expParams: z.array(z.number().int()),
  params: z.array(z.array(z.number().int())),
  learnings: z.array(LearningSchema),
  traits: z.array(TraitSchema),
  note: z.string(),
});

export const EventCommandSchema = z.object({
  code: z.number().int(),
  indent: z.number().int(),
  parameters: z.array(z.unknown()),
});

export const CommonEventSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  trigger: z.number().int(),
  switchId: z.number().int(),
  list: z.array(EventCommandSchema),
});

export const TroopMemberSchema = z.object({
  enemyId: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  hidden: z.boolean(),
});

export const TroopPageConditionSchema = z.object({
  actorHp: z.number(),
  actorId: z.number().int(),
  actorValid: z.boolean(),
  enemyHp: z.number(),
  enemyIndex: z.number().int(),
  enemyValid: z.boolean(),
  switchId: z.number().int(),
  switchValid: z.boolean(),
  turnA: z.number().int(),
  turnB: z.number().int(),
  turnEnding: z.boolean(),
  turnValid: z.boolean(),
});

export const TroopPageSchema = z.object({
  conditions: TroopPageConditionSchema,
  list: z.array(EventCommandSchema),
  span: z.number().int(),
});

export const TroopSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  members: z.array(TroopMemberSchema),
  pages: z.array(TroopPageSchema),
});

export const MapInfoSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  parentId: z.number().int(),
  order: z.number().int(),
  expanded: z.boolean(),
  scrollX: z.number().int(),
  scrollY: z.number().int(),
});

export const MapEventPageConditionSchema = z.object({
  actorId: z.number().int(),
  actorValid: z.boolean(),
  itemId: z.number().int(),
  itemValid: z.boolean(),
  selfSwitchCh: z.string(),
  selfSwitchValid: z.boolean(),
  switch1Id: z.number().int(),
  switch1Valid: z.boolean(),
  switch2Id: z.number().int(),
  switch2Valid: z.boolean(),
  variableId: z.number().int(),
  variableValid: z.boolean(),
  variableValue: z.number().int(),
});

export const MapEventImageSchema = z.object({
  tileId: z.number().int(),
  characterName: z.string(),
  characterIndex: z.number().int(),
  direction: z.number().int(),
  pattern: z.number().int(),
});

export const MoveRouteSchema = z.object({
  list: z.array(EventCommandSchema),
  repeat: z.boolean(),
  skippable: z.boolean(),
  wait: z.boolean(),
});

export const MapEventPageSchema = z.object({
  conditions: MapEventPageConditionSchema,
  directionFix: z.boolean(),
  image: MapEventImageSchema,
  list: z.array(EventCommandSchema),
  moveFrequency: z.number().int(),
  moveRoute: MoveRouteSchema,
  moveSpeed: z.number().int(),
  moveType: z.number().int(),
  priorityType: z.number().int(),
  stepAnime: z.boolean(),
  through: z.boolean(),
  trigger: z.number().int(),
  walkAnime: z.boolean(),
});

export const MapEventSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  pages: z.array(MapEventPageSchema),
  note: z.string(),
});

export const PluginEntrySchema = z.object({
  name: z.string(),
  status: z.boolean(),
  description: z.string(),
  parameters: z.record(z.string(), z.string()),
});

export type Item = z.infer<typeof ItemSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Weapon = z.infer<typeof WeaponSchema>;
export type Armor = z.infer<typeof ArmorSchema>;
export type State = z.infer<typeof StateSchema>;
export type Enemy = z.infer<typeof EnemySchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type Class = z.infer<typeof ClassSchema>;
export type CommonEvent = z.infer<typeof CommonEventSchema>;
export type Troop = z.infer<typeof TroopSchema>;
export type MapInfo = z.infer<typeof MapInfoSchema>;
export type MapEvent = z.infer<typeof MapEventSchema>;
export type PluginEntry = z.infer<typeof PluginEntrySchema>;
export type EventCommand = z.infer<typeof EventCommandSchema>;
export type Damage = z.infer<typeof DamageSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type Trait = z.infer<typeof TraitSchema>;
