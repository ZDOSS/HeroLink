# RPG Maker MV Content Bridge — Engineering Design Spec

**Spec revision:** 0.2 (phased version ladder)
**Status:** Approved for implementation
**Implementer:** M3 (Minimax M3, driven via Claude Code)
**Release model:** "vN" denotes a product release on the version ladder in §2. Each version is independently shippable and strictly additive (it never removes a prior capability). **MVP = v6 = full functionality.** (Distinct from this spec document's own *revision* number above.)
**Provenance:** Expands the prior `rpg-maker-mv-bridge-handoff.md` research note into a concrete, executable spec. Where the research note deliberated (JS vs TS, Fastify vs Express, Zod vs JSON Schema), this spec resolves the decision and explains why.

---

## 0. How to use this spec (read first, M3)

This document is the single source of truth for the project. Build in **version order**: §2 is the capability map (what ships in each release) and §15 is the per-version build steps with a **Definition of Done (DoD)**. Do not skip ahead — each version's DoD gates the next.

Three rules govern everything you do:

1. **Never mutate a project file without going through the mutation pipeline (§6.2).** No tool writes to disk directly. Ever.
2. **Treat the data shapes in §5 as a *reference baseline*, not gospel.** Generate Zod schemas from the real fixture project and the official docs, then validate the fixture against them (§5.7). If a field in §5 disagrees with real exported MV data, the real data wins — fix the schema, don't fix the data.
3. **The hard invariants in §17 are non-negotiable.** Copy them verbatim into `AGENTS.md` at the repo root so they stay in your context on every run.

When something is genuinely ambiguous and not covered here, stop and surface it as an open question (§18) rather than guessing. Do not invent game-design content; this is tooling, not a game.

---

## 1. Product summary & goals

A **local, file-based bridge** that lets an AI client read, draft, validate, and safely write **content** into a RPG Maker MV project. The product is a **content-augmentation assistant**, not a live game controller.

**Primary goals (full product — phased across the version ladder in §2):**

- Read and summarize an MV project's database and maps.
- Draft new database content (items, skills, weapons, armors, etc.) and common events.
- Validate references and detect broken/dangling data before it ever lands on disk.
- Apply changes through a **propose → validate → preview → apply → rollback** pipeline, never blind overwrites.
- Expose all of this as **MCP tools over stdio** so AI clients (Claude Code, Claude Desktop, Cline, Cursor) can drive it.

**Headline success criterion (first achievable at v3):** a user can ask their AI client to "add three healing items and a fire skill," review a semantic diff, apply it, run the game, and — if they dislike it — roll it back to a byte-identical previous state.

---

## 2. Version roadmap (capability map)

One axis only: a **strictly-additive version ladder**. Each version is independently shippable, builds on the previous, and adds one coherent capability. **MVP = v6 = full functionality.** This section is the *what ships when*; §15 is the *how to build it + done-criteria*.

| Ver | Headline capability | Writes? | Surface |
|---|---|---|---|
| **v1** | Read & summarize a project (project intelligence) | No | MCP stdio + dev CLI |
| **v2** | Audit & validate (a "linter" for a project) | No | MCP |
| **v3** | Safe **database** mutation (the headline moment) | Yes — `data/` DB files | MCP |
| **v4** | Author events & map events, manage plugins | Yes — events, `js/plugins*` | MCP |
| **v5** | In-engine integration (bounded runtime) | Runtime (bounded) | MCP + MV plugin |
| **v6** | Full surface: HTTP/UI, MZ, advanced events, packaging | Yes | MCP + HTTP/UI + plugin |

**v1 — Read & Summarize.**
Locate, load, and normalize an MV project; list/search every database entity, map, event (summaries), note/`meta`, and plugin; report project status. Exposed over MCP stdio plus a dev CLI.
*Tools:* `get_project_status`, `list_project_data`, `list_entities`, `get_entity`, `list_maps`, `get_map_events`, `search_events`, `search_notes`, `list_plugins`.
*Not yet:* no validation engine, no writes of any kind.
*Why first:* proves the data model + engine adapter + normalized model against real projects at **zero mutation risk**, and is immediately useful (the AI can answer questions about a project).

**v2 — Audit & Validate.**
Full reference-integrity + schema-conformance auditing — a linter for an MV project. Still read-only.
*Adds:* `validate_project_refs` (audits the on-disk project); all entity Zod schemas finalized (§5.7).
*Not yet:* no writes.
*Why here:* validation is the gate the writer depends on; shipping it read-only first lets users trust the audit before they trust the mutator.

**v3 — Safe Database Mutation.** *(First version that writes.)*
The full propose → validate → diff → apply → rollback pipeline (§6.2) for **database entities**: items, skills, weapons, armors, states, enemies, actors, classes. Backups, atomic writes, staleness detection, transaction journal, rollback.
*Adds:* `create_item_draft`, `create_skill_draft`, `create_entity_draft`, `update_entity_draft`, `list_pending_changes`, `diff_pending_changes`, `discard_pending_changes`, `validate_project_refs{includePending:true}`, `apply_patch`, `rollback_last_patch`, `list_backups`.
*Not yet:* no event authoring, no plugin writes, no map-event creation.
*This is the headline product moment* — the §1 success criterion is met here.

**v4 — Events, Maps & Plugins.**
Extend mutation to the harder, positional content, all through the v3 pipeline: the constrained common-event builder (§5.4); create/edit **map events**; plugin management (add plugin files, edit `plugins.js` entries and parameters).
*Adds:* `create_common_event_draft`, `create_map_event_draft`, `update_map_event_draft`, `set_plugin_param_draft`, `add_plugin_draft`.
*Not yet:* still **no free-form opcode arrays** — only the constrained builder; no in-engine features.

**v5 — In-Engine Integration.** *(First touch of a running game.)*
The bounded MV runtime plugin (§13): read-only runtime inspection, content preview, an allowlisted plugin-command set, and the documented bridge↔plugin channel.
*Adds:* `js/plugins/BridgeInspector.js`, the channel, and MCP tools `inspect_runtime`, `preview_entity` (contracts finalized at v5).
*Not yet:* no autonomous gameplay control — that is a permanent non-goal (below).

**v6 — Full Surface (MVP / full functionality).**
The convergence point. Each sub-feature is independently gated (§15) and none blocks the others:
- **Fastify HTTP API** reusing layers L1–L4 (§6.1), plus an optional local UI.
- **MZ engine adapter** — the §6.4 seam realized; the same tools and tests run against an MZ fixture.
- **Advanced event authoring** — arbitrary, schema-guarded event-command sets beyond the constrained builder.
- **Electron** desktop packaging.

### Permanent non-goals (never on the ladder, at any version)
- **Autonomous live gameplay control** (player movement, battle automation).
- **Arbitrary code execution / `eval` of project strings** — damage formulas, notes, and script commands are never executed by the bridge (§11).
- **Blind overwrites** — every write goes through the §6.2 pipeline, forever.

### Not on the ladder, but possible later if justified
- **Map tile/geometry painting** (bulk `Map.data[]` editing) — a different risk profile from map *events*; out unless specifically scheduled.
- **Python sidecar** — only if a generation/ML library gives a demonstrated advantage; record the justification in §18 first.

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **Project** | A directory containing `Game.rpgproject`, `data/`, `js/`, etc. |
| **Database entity** | A record in a `data/*.json` array (item, skill, actor, …). |
| **Normalized model** | The bridge's in-memory representation of the project (§6.3). |
| **Draft** | A proposed create/update, staged but not yet written. |
| **Changeset / staging** | The ordered set of pending drafts awaiting apply. |
| **Transaction** | One atomic `apply` of the whole changeset; the unit of rollback. |
| **Patch** | An RFC-6902 JSON Patch describing a change to one file. |
| **Ref** | A cross-reference between entities (e.g., a skill's `animationId`). |

---

## 4. Locked decisions (resolved deliberations)

| Decision | Choice | Why |
|---|---|---|
| Bridge language | **TypeScript**, run via `tsx` in dev | Whole product is *safe structured mutation*; Zod + TS = one source of truth for validation **and** types (`z.infer`). `tsx` removes the dev build step. Official MCP SDK is TS-first. |
| Plugin language | **JavaScript (ES5-safe)** | MV's runtime executes plugins directly; it is not TS-aware. |
| Validation | **Zod**, with `zod-to-json-schema` for MCP tool input schemas | One schema → runtime guard + static type + MCP JSON Schema. Beats hand-written JSON Schema. |
| Transport | **MCP over stdio** first | Matches the intended clients; HTTP is optional later. |
| HTTP (later) | **Fastify**, not Express | Faster, schema-first, better maintained. No reason to start on Express. |
| Patch model | **RFC-6902 JSON Patch** via `fast-json-patch` | Principled apply *and* inverse for rollback. |
| Diff surface | **Semantic** (object/JSON-Patch level), not text | MV minifies JSON to one line; text diffs are useless. |
| Atomic writes | `write-file-atomic` (temp + rename) + backups | No partial files; every write reversible. |
| Tests | **Vitest** + committed fixture project | Fast, TS-native; fixture makes the mutation layer testable from day one. |
| Lint/format | **Biome** (single tool) | One fast binary for lint + format. (ESLint + Prettier acceptable if preferred.) |
| Logging | **pino**, **to stderr only** | stdout is the MCP transport channel (§12). |
| Deferred | Electron, Python sidecar, MZ | Add only when justified. |

---

## 5. RPG Maker MV data model (ground truth)

> **Reference baseline.** Verify every shape against (a) the official RPG Maker MV runtime/library docs and (b) the real fixture project (§5.7). When they disagree with this section, they win.

### 5.1 Project layout (relevant paths)
```
<project>/
  Game.rpgproject          # project marker file
  js/
    plugins.js             # plugin config (NOT pure JSON — see §5.6)
    plugins/*.js           # plugin source files
  data/
    Actors.json  Classes.json  Skills.json  Items.json
    Weapons.json Armors.json   Enemies.json Troops.json
    States.json  Animations.json Tilesets.json
    CommonEvents.json
    System.json
    MapInfos.json
    Map001.json  Map002.json  ...   # Map%03d.json
```

### 5.2 Array & ID conventions (critical)
- Most `data/*.json` database files are **JSON arrays where index 0 is `null`**. Real records start at index 1.
- Each record's `id` field **equals its array index**. These must never drift apart.
- `System.json` is a **single object**, not an array.
- `MapInfos.json` is an array (index 0 `null`); each entry's `id` maps to the `Map%03d.json` file of the same number.
- New entity allocation: append at the end; `newId = array.length` (the slot you're about to fill), then push so the record lands at index `newId`, and set `record.id = newId`. Never reuse a deleted id's slot silently.
- Files are written **minified UTF-8** (no pretty spacing, no trailing newline) to match the MV editor. The bridge edits the *object model* and re-serializes; it does not hand-edit text.

### 5.3 Entity reference schemas

Two are given in full as the pattern to follow. The rest are summarized — **derive their full Zod schemas from the fixture + docs** (§5.7).

**Item** (`data/Items.json[n]`) — full reference:
```ts
// Reference baseline — verify against fixture.
const DamageSchema = z.object({
  type: z.number().int(),        // 0 none,1 HP dmg,2 MP dmg,3 HP rec,4 MP rec,5 HP drain,6 MP drain
  elementId: z.number().int(),
  formula: z.string(),           // JS expression evaluated at runtime — treat as code (§11)
  variance: z.number().int(),
  critical: z.boolean(),
});
const EffectSchema = z.object({
  code: z.number().int(),        // effect opcode (see official docs)
  dataId: z.number().int(),
  value1: z.number(),
  value2: z.number(),
});
const ItemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  iconIndex: z.number().int(),
  description: z.string(),
  itypeId: z.number().int(),     // 1 regular, 2 key item
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
});
```

**Skill** (`data/Skills.json[n]`) — full reference:
```ts
const SkillSchema = ItemSchema.omit({ itypeId: true, consumable: true, price: true }).extend({
  stypeId: z.number().int(),     // skill type id (indexes System.skillTypes)
  mpCost: z.number().int(),
  tpCost: z.number().int(),
  message1: z.string(),
  message2: z.string(),
  requiredWtypeId1: z.number().int(),
  requiredWtypeId2: z.number().int(),
});
```

Remaining entities (summarized — fields to capture):

| Entity | File | Key fields |
|---|---|---|
| Actor | Actors.json | `id,name,nickname,classId,initialLevel,maxLevel,profile,faceName,faceIndex,characterName,characterIndex,battlerName,equips[],traits[],note` |
| Class | Classes.json | `id,name,expParams[4],params[8][maxLvl],learnings[{level,skillId,note}],traits[],note` |
| Weapon | Weapons.json | `id,name,iconIndex,description,wtypeId,price,etypeId(=1),params[8],traits[],note` |
| Armor | Armors.json | `id,name,iconIndex,description,atypeId,etypeId,price,params[8],traits[],note` |
| State | States.json | `id,name,iconIndex,restriction,priority,motion,overlay,removeAtBattleEnd,removeByRestriction,autoRemovalTiming,minTurns,maxTurns,removeByDamage,chanceByDamage,removeByWalking,stepsToRemove,message1..4,traits[],note` |
| Enemy | Enemies.json | `id,name,battlerName,battlerHue,params[8],exp,gold,dropItems[{kind,dataId,denominator}],actions[{conditionType,conditionParam1,conditionParam2,rating,skillId}],traits[],note` |
| Troop | Troops.json | `id,name,members[{enemyId,x,y,hidden}],pages[{conditions,list[cmd],span}]` |
| CommonEvent | CommonEvents.json | `id,name,trigger(0 none,1 autorun,2 parallel),switchId,list[cmd]` |
| System | System.json | object: `gameTitle,versionId,currencyUnit,elements[],skillTypes[],weaponTypes[],armorTypes[],equipTypes[],switches[],variables[],terms{},startMapId,startX,startY,partyMembers[],...` |
| MapInfo | MapInfos.json | `id,name,parentId,order,expanded,scrollX,scrollY` |
| Map | Map%03d.json | `width,height,data[],tilesetId,events[null,{event}...],autoplayBgm,...` |

- `params[8]` is the canonical stat order: `[MHP, MMP, ATK, DEF, MAT, MDF, AGI, LUK]`.
- `traits[]` items are `{code, dataId, value}`; `effects[]` are `{code, dataId, value1, value2}`. The opcode meanings live in the official docs — **do not hardcode an opcode table from memory; reference the docs and validate against the fixture.**
- `System.switches[]` and `System.variables[]` are **1-indexed name arrays** (index 0 is `""`).

### 5.4 Event command model (why event editing is high-risk)
Map events, common events, and troop pages all contain a `list[]` of **event commands**:
```ts
const EventCommandSchema = z.object({
  code: z.number().int(),        // opcode (e.g. 101 show-text setup, 401 text line, 122 control var, 117 call common event)
  indent: z.number().int(),
  parameters: z.array(z.any()),  // positional, opcode-specific — order and arity vary per code
});
```
- A `list` **must terminate** with a `{code:0, indent:<n>, parameters:[]}` command. Omitting it corrupts the event.
- Multi-line constructs span multiple commands (e.g., a `101` setup followed by one `401` per text line; choices `102` + `402`/`403`/`404`).
- Parameters are **positional and untyped** — wrong order/arity produces events that fail at runtime, not at load.

**Consequence:** the bridge does **not** accept arbitrary `list[]` arrays from the AI. `create_common_event_draft` accepts a **constrained, validated command set** (a small builder — show text, control switch/variable, call common event, play SE, transfer player, conditional branch, comment, plus a terminator that the builder appends automatically). Each supported command has its own Zod schema that compiles to the correct positional `parameters`. Unsupported opcodes are rejected. The constrained builder ships in **v4**; free-form/arbitrary opcode authoring is a **v6** feature (advanced event authoring) gated behind explicit per-opcode schema work.

### 5.5 Notes & meta
- Every database entity has a free-form `note: string`.
- MV parses `<key:value>` → `meta[key] = "value"` and `<key>` → `meta[key] = true` (regex roughly `/<([^<>:]+)(:?)([^>]*)>/g`).
- The bridge exposes a `meta` view (parsed) for reads and a safe note-builder for writes. Treat the note as the sanctioned place to attach structured metadata.

### 5.6 `plugins.js` format (not pure JSON)
```js
// Generated by RPG Maker.
// Do not edit this file directly.
var $plugins =
[
{"name":"X","status":true,"description":"...","parameters":{"Key":"Value"}},
...
];
```
- It is a JS file assigning an array to `$plugins`. Parse by extracting the array literal between the first `[` and its matching `]`, `JSON.parse` it, operate on the objects, then re-emit with the exact header + `var $plugins =\n` wrapper.
- **All plugin parameter values are strings** (numbers/bools are stringified). Preserve that on write.

### 5.7 Schema-from-data mandate
Do not hand-transcribe schemas as final. For each entity:
1. Load the fixture project's real records.
2. Draft the Zod schema from §5.3 + official docs.
3. Run `schema.parse()` over **every** fixture record; refine until all pass with no `z.any()` left in the records the tools actually touch.
4. Commit a `schema-conformance` test (§14) that re-runs this on every CI run.

---

## 6. Architecture

### 6.1 Layered modules (dependencies point downward only)
```
┌─────────────────────────────────────────────┐
│ L5  MCP server (stdio)        tools/*.ts      │  ← only this layer knows about MCP
├─────────────────────────────────────────────┤
│ L4  Tool handlers (use cases)                 │  ← orchestrate L1–L3; no I/O of their own
├─────────────────────────────────────────────┤
│ L3  Mutation engine: staging, patch, backup,  │
│     atomic write, journal, rollback           │
├─────────────────────────────────────────────┤
│ L2  Validation: Zod schemas + ref-integrity   │
├─────────────────────────────────────────────┤
│ L1  Project I/O + normalized model + engine   │
│     adapter (MV today, MZ later)              │
└─────────────────────────────────────────────┘
```
- **L1–L3 are engine-agnostic and transport-agnostic.** They have zero `@modelcontextprotocol/sdk` imports and zero `console.log`.
- **L5 is the only layer allowed to touch stdio.** L4 returns plain data + typed errors; L5 serializes them to MCP.
- This separation is what makes the core unit-testable without spinning up an MCP client, and what lets an HTTP adapter (later) reuse L1–L4 unchanged.

### 6.2 The mutation pipeline (central invariant)
Every change follows exactly this path:
```
propose (draft tool)
   → stage (append to changeset, validate single draft)
   → diff (compile changeset to JSON Patches + human summary)
   → apply  [ revalidate whole set → staleness check → backup → atomic write → journal ]
   → (optional) rollback (restore from journal/backup, byte-for-byte)
```
- A draft tool **never** writes to disk. It only stages.
- `apply_patch` is the **only** function in the codebase that writes to `data/` or `js/`.
- Apply is **all-or-nothing**: if any file in the transaction fails validation or write, none are committed and any partial writes are reverted.

### 6.3 Normalized internal model
- On load, parse each `data/*.json` into typed objects; build:
  - an **entity index** by `(type, id)`,
  - a **reference graph** (who points at whom) for §11,
  - a per-file **content hash + mtime** snapshot for staleness detection (§10).
- The model is the single in-memory truth; tools read from it, drafts mutate a *copy* held in staging.

### 6.4 Engine adapter seam (MZ-portability, do not over-build)
Put engine-specific behavior behind one interface so MZ can slot in later **without** a rewrite:
```ts
interface EngineAdapter {
  id: 'mv' | 'mz';
  dataFiles(): string[];
  pluginConfig: { read(projectDir): PluginEntry[]; write(projectDir, entries): WritePlan };
  animationSchema: z.ZodTypeAny;   // MV vs MZ/Effekseer differ
  pluginCommandModel: 'text-357' | 'registered'; // MV text command vs MZ registerPluginCommand
}
```
Implement `MvAdapter` only. Do not implement `MzAdapter` in v1 — just keep the seam clean so it's a later addition, not a refactor.

---

## 7. Tech stack (final, pinned by major)

| Concern | Package | Notes |
|---|---|---|
| Runtime | Node.js **≥ 20 LTS** | ESM (`"type":"module"`). |
| Language | `typescript` ^5, `tsx` ^4 | `tsx` runs TS directly in dev; `tsc --noEmit` for typecheck/CI; `tsc` for the shippable build. |
| MCP | `@modelcontextprotocol/sdk` ^1 | stdio server + in-memory transport for tests. |
| Validation | `zod` ^3, `zod-to-json-schema` ^3 | schema → type + runtime guard + MCP input schema. |
| Patch | `fast-json-patch` ^3 | generate, apply, and **invert** RFC-6902 patches. |
| Atomic write | `write-file-atomic` ^5 | temp + rename. |
| Logging | `pino` ^9 | **stderr only** (§12). |
| CLI | `commander` ^12 | the v1 read CLI and dev utilities. |
| Tests | `vitest` ^2, `@vitest/coverage-v8` | unit + integration + coverage. |
| Property tests | `fast-check` ^3 | round-trip + apply/rollback invariants (§14). |
| Lint/format | `@biomejs/biome` ^1 | single binary; or ESLint+Prettier if preferred. |

No other runtime dependencies without recording the reason in §18.

---

## 8. Repository structure
```
rpgmv-bridge/
  AGENTS.md                 # §17 invariants, verbatim — read every run
  README.md
  package.json
  tsconfig.json
  biome.json
  vitest.config.ts
  src/
    index.ts                # MCP stdio entrypoint (L5)
    cli.ts                  # dev/read CLI (commander)
    engine/
      adapter.ts            # EngineAdapter interface
      mv.ts                 # MvAdapter
    io/
      project.ts            # locate + load + save planning (L1)
      pluginsJs.ts          # parse/serialize js/plugins.js (§5.6)
      paths.ts              # safe path resolution (§17)
    model/
      normalized.ts         # in-memory model + indexes + ref graph
      hash.ts               # content hash + mtime snapshots
    schema/
      entities.ts           # Zod schemas (item, skill, ...) (§5.3)
      commands.ts           # constrained event-command builder schemas (§5.4)
      index.ts
    validate/
      refs.ts               # reference-integrity engine (§11)
      project.ts            # whole-project validation
    mutate/
      staging.ts            # changeset model + persistence (.bridge/staging.json)
      patch.ts              # entity-change → JSON Patch
      backup.ts             # backup dir + journal (.bridge/journal.jsonl)
      apply.ts              # THE ONLY WRITER (§6.2)
      rollback.ts
    tools/                  # L4 handlers, one file per tool (§9)
      *.ts
    errors.ts               # typed error taxonomy (§12)
    log.ts                  # pino → stderr
  test/
    fixtures/
      sample-project/       # tiny valid MV project (§14)
      broken-project/       # seeded with dangling refs for §11 tests
    unit/
    integration/
    helpers/
      withTempProject.ts    # copy fixture → tmp dir, return path (hermetic)
  dist/                     # tsc build output (gitignored)
```
- The bridge writes its own state under `<project>/.bridge/` (staging, backups, journal). This dir is the bridge's; never write bridge state into `data/`.

---

## 9. Tool surface (MCP tools)

Conventions for **every** tool:
- Input is a Zod schema; `zod-to-json-schema` produces the MCP `inputSchema`.
- Output is a declared, validated result object (also a Zod schema).
- Tools are tagged **read** | **propose** | **apply** | **admin**. Only **apply** tools cause disk writes, and only via `mutate/apply.ts`.
- Errors are structured (§12), never thrown as raw strings to the client.

### 9.1 Tools by version (arrival)
- **v1 (read-only):** `get_project_status`, `list_project_data`, `list_entities`, `get_entity`, `list_maps`, `get_map_events`, `search_events`, `search_notes`, `list_plugins`
- **v2:** `validate_project_refs` (read-only audit of the on-disk project)
- **v3:** `create_item_draft`, `create_skill_draft`, `create_entity_draft`, `update_entity_draft`, `list_pending_changes`, `diff_pending_changes`, `discard_pending_changes`, `validate_project_refs{includePending:true}`, `apply_patch`, `rollback_last_patch`, `list_backups`
- **v4:** `create_common_event_draft`, `create_map_event_draft`, `update_map_event_draft`, `set_plugin_param_draft`, `add_plugin_draft`
- **v5:** `inspect_runtime`, `preview_entity` (in-engine; contracts finalized at v5)
- **v6:** HTTP endpoints mirroring the L4 use-cases; advanced (free-form, schema-guarded) event-command tools; all tools run unchanged against an MZ project via the engine adapter

### 9.2 Tool contracts (grouped by behaviour; tag = read | propose | apply | admin)

**Read** (v1)
| Tool | Input | Output | Notes |
|---|---|---|---|
| `get_project_status` | `{}` | `{projectDir, engine, gameTitle, versionId, dirty, pendingChanges, lastTransactionId}` | Health/identity probe. `dirty` = files changed on disk since load. |
| `list_project_data` | `{}` | `{counts per entity type, mapCount, pluginCount}` | High-level summary. |
| `list_entities` | `{type, query?, limit?, offset?}` | `{items:[{id,name,...summary}], total}` | Generic lister for any database type. |
| `get_entity` | `{type, id}` | `{entity, meta}` | Full record + parsed `meta`. |
| `list_maps` | `{}` | `{maps:[{id,name,parentId,order}]}` | From MapInfos. |
| `get_map_events` | `{mapId}` | `{events:[{id,name,x,y,pageCount}]}` | Event summaries, not raw command lists. |
| `search_events` | `{query, scope?}` | `{matches:[{location, snippet}]}` | Searches event text (show-text, comments, script lines) and common events. |
| `search_notes` | `{query}` | `{matches:[{type,id,name,note}]}` | Searches note fields / meta. |
| `list_plugins` | `{}` | `{plugins:[{name,status,params}]}` | From `plugins.js`. |

**Propose** (stage only; return preview + per-draft validation; **no write**)
| Tool | Ver | Input | Output |
|---|---|---|---|
| `create_item_draft` | v3 | `{fields: Partial<Item>}` | `{changeId, preview, validation}` |
| `create_skill_draft` | v3 | `{fields: Partial<Skill>}` | `{changeId, preview, validation}` |
| `create_entity_draft` | v3 | `{type, fields}` | `{changeId, preview, validation}` (generic; covers weapon/armor/state/enemy/etc.) |
| `update_entity_draft` | v3 | `{type, id, patch}` | `{changeId, preview, validation}` |
| `create_common_event_draft` | v4 | `{name, trigger, switchId?, commands:[ConstrainedCommand]}` | `{changeId, preview, validation}` (§5.4 builder) |
| `create_map_event_draft` | v4 | `{mapId, event:{name,x,y,pages:[ConstrainedPage]}}` | `{changeId, preview, validation}` |
| `update_map_event_draft` | v4 | `{mapId, eventId, patch}` | `{changeId, preview, validation}` |
| `set_plugin_param_draft` | v4 | `{pluginName, params:Record<string,string>}` | `{changeId, preview, validation}` |
| `add_plugin_draft` | v4 | `{name, source, status?, params?}` | `{changeId, preview, validation}` |

**Staging / apply / rollback** (v3, except `validate_project_refs` which lands read-only at v2)
| Tool | Input | Output | Tag |
|---|---|---|---|
| `list_pending_changes` | `{}` | `{changes:[{changeId,type,summary}]}` | read |
| `diff_pending_changes` | `{}` | `{patches:[{file, ops:[JsonPatchOp]}], humanSummary, aggregateValidation}` | read |
| `discard_pending_changes` | `{changeIds?}` | `{remaining}` | admin |
| `validate_project_refs` | `{includePending?}` | `{ok, issues:[{severity,location,message,refKind}]}` | read |
| `apply_patch` | `{confirm:true}` | `{transactionId, filesWritten, backupDir}` | **apply** |
| `rollback_last_patch` | `{}` | `{restoredTransactionId, filesRestored}` | **apply** |
| `list_backups` | `{}` | `{transactions:[{id,timestamp,files}]}` | read |

Notes:
- `apply_patch` requires explicit `confirm:true` and refuses if `validate_project_refs({includePending:true})` reports any `error`-severity issue or if the project is `dirty` (§10 staleness).
- `apply_patch` commits the **entire** pending changeset as one transaction (one rollback unit). Naming retained from the research note; semantics defined here.

---

## 10. Safety & mutation model

1. **Single writer.** `mutate/apply.ts` is the only module that writes to `data/`, `js/plugins.js`, or `js/plugins/`. Enforce with a lint rule / code review note.
2. **Path containment.** Resolve every target path and assert it is inside the project root (after `realpath`). Reject symlink escapes, `..` traversal, and absolute paths outside the project. (§17)
3. **Backups before write.** For each file a transaction touches, copy the current bytes to `.bridge/backups/<transactionId>/<relpath>` *before* writing. Record the transaction in `.bridge/journal.jsonl` (append-only) with: id, timestamp, files, per-file pre-hash, and the inverse JSON Patch.
4. **Atomic writes.** Use `write-file-atomic` (temp file + `fsync` + rename) so a crash never leaves a half-written `data/*.json`.
5. **All-or-nothing.** Plan all writes, back them all up, write them all; if any step throws, restore from the just-made backups and report the transaction as failed.
6. **Staleness / conflict detection.** Before apply, re-hash every target file and compare to the snapshot taken at load. If any changed on disk (e.g., the user edited in the RPG Maker editor), **refuse** and tell the client to reload. Never clobber external edits.
7. **ID integrity.** Allocation per §5.2; assert `record.id === arrayIndex` for every touched array post-write.
8. **Rollback.** `rollback_last_patch` applies the stored inverse patches (or restores backup bytes) and verifies the resulting file hashes match the pre-transaction snapshot **exactly**.
9. **Optional git snapshot.** If `<project>` is a git repo, offer (config flag) committing a snapshot before apply as a second safety net. Off by default; never auto-commit without the flag.

---

## 11. Validation & reference-integrity rules

`validate/refs.ts` walks the reference graph and flags issues with severity `error | warn`:

- **Dangling id refs (error):** `skill.animationId`, `item.animationId`, `actor.classId`, `class.learnings[].skillId`, `enemy.actions[].skillId`, `enemy.dropItems[].dataId`, `actor.equips[]` → must point to an existing, non-null record of the right type (or the allowed "none" sentinel, usually `0`).
- **Index-name table refs (error):** `skill.stypeId` → `System.skillTypes`; `weapon.wtypeId` → `System.weaponTypes`; `armor.atypeId` → `System.armorTypes`; `*.etypeId` → `System.equipTypes`; element ids → `System.elements`.
- **Switch/variable refs (error):** `commonEvent.switchId`, control-switch/variable commands, page conditions → within `System.switches`/`System.variables` bounds.
- **Array/id invariants (error):** index 0 is `null`; `id === index`; no duplicate ids; no holes.
- **Damage formula (warn):** `damage.formula` is a runtime JS expression. Do not execute it. Static-check only: balanced parens, only an allowlist of identifiers (`a,b,v,s,r,item,...`) — anything else is a `warn` for human review. Never `eval`.
- **Note/meta (warn):** malformed `<...>` tags that won't parse.
- **Plugin params (warn):** non-string param values (MV expects strings).

`validate_project_refs` runs against the current model and, when `includePending:true`, against the model with the staged changeset applied in-memory. Apply is blocked on any `error`.

---

## 12. Error handling, logging, and the stdout rule

- **stdout is sacred.** In stdio MCP, stdout carries the protocol. Writing anything else to stdout corrupts the stream. Therefore: **all logging goes to stderr** via `pino({}, pino.destination(2))`. No `console.log` anywhere in `src/` (lint-enforced).
- **Typed errors.** `errors.ts` defines a small taxonomy: `ProjectNotFoundError`, `ValidationError` (carries Zod issues), `RefIntegrityError` (carries issue list), `StaleProjectError`, `PathEscapeError`, `ConflictError`, `IoError`. Tool handlers (L4) return/raise these; L5 maps them to MCP errors with a stable `code`, a human `message`, and a machine `details` payload. Never leak stack traces or raw strings to the client.
- **No silent fallbacks.** If a referenced entity/file/path can't be found, fail with a typed error naming what was missing. Do not substitute a different entity or guess.

---

## 13. MV runtime plugin (v5, bounded)

A small JS plugin (`js/plugins/BridgeInspector.js`) added only when in-engine features are needed:
- **Read-only runtime inspection:** expose current map id, party, switches/variables snapshot for debugging.
- **A narrow, allowlisted plugin-command set** for previewing content (e.g., "spawn preview of item X"). No arbitrary execution.
- **Boundary:** the plugin and the bridge communicate only over a documented, minimal channel (e.g., a local file drop or a localhost port the user opts into); the plugin never receives free-form code from the AI. Keep MV-runtime logic out of the core; the core stays file-only.

This is **v5**; it is not required for v1–v4 and never grants free-form execution.

---

## 14. Testing methodology (the priority)

The bridge's entire reason to exist is *not corrupting projects*. Tests are a first-class deliverable, not an afterthought. **No tool is "done" without its tests (per-tool DoD below).**

### 14.1 Principles
- **Hermetic.** Tests never touch the committed fixtures in place. `test/helpers/withTempProject.ts` copies a fixture into an OS temp dir per test and returns the path; all mutation tests run there. The committed fixture is read-only ground truth.
- **Deterministic & offline.** No network, no clocks-dependent assertions (inject a clock for timestamps), no test ordering dependencies.
- **AAA.** Arrange–Act–Assert, one behavior per test, descriptive names (`apply_patch refuses when project is dirty`).
- **Fast core, thin edges.** Heavy coverage on L1–L3 (pure-ish logic); lighter end-to-end coverage at L5.

### 14.2 Fixtures
- `test/fixtures/sample-project/`: a **tiny but valid** MV project — a handful of items/skills/weapons/armors/states/enemies, one or two actors+classes, one common event, 1–2 maps, a real `System.json`, and a `plugins.js` with one plugin. Small enough to read, complete enough to exercise every entity type and ref kind.
- `test/fixtures/broken-project/`: same shape, deliberately seeded with: a dangling `animationId`, a `skillId` pointing past the array, a duplicate id, a malformed note tag, and a non-string plugin param — one seed per §11 rule.

### 14.3 Test layers (the pyramid)
1. **Unit (most tests):** schema parsing/refinement; id allocation; note/meta parse + build; `plugins.js` parse/serialize; JSON Patch generate/apply/invert; path containment; staleness hashing.
2. **Schema-conformance (§5.7):** every record in `sample-project` parses against its Zod schema with no residual `z.any()` in tool-touched fields. This is the canary that keeps schemas honest.
3. **Round-trip / idempotence:** `load → serialize-unchanged → compare` is **semantically identical** to the original for every file (and byte-identical where MV's formatting is deterministic). Guards the parser/serializer against silent corruption of files merely touched.
4. **Reference-integrity:** `validate_project_refs` finds **exactly** the seeded issues in `broken-project` (no misses) and **zero** issues in `sample-project` (no false positives). Assert on the specific issue list, not just the count.
5. **Mutation safety (the crown jewels):**
   - **apply → rollback restores byte-for-byte.** Hash every `data/` file before, apply a changeset, roll back, re-hash; assert equality.
   - **Staleness refusal.** After load, mutate a target file on disk; assert `apply_patch` throws `StaleProjectError` and writes nothing.
   - **All-or-nothing.** Inject a write failure on the 2nd of 3 files; assert the first file is reverted and the transaction reports failure.
   - **Backups + journal.** Assert a backup exists for every touched file and the journal entry contains a valid inverse patch.
6. **Property-based (`fast-check`):**
   - For random valid entities: `serialize(parse(x)) deep-equals x`.
   - For random staged changesets: `apply` then `rollback` returns the project to its initial hash set, for any ordering.
7. **MCP contract tests (L5):** drive the server through the SDK's **in-memory transport** (no subprocess). For each tool: valid input → declared output shape; invalid input → structured `ValidationError`, **no** disk write. Assert no bytes are written by any **read**/**propose** tool.
8. **Smoke test (documented, manual-or-CI):** a scripted end-to-end run against a copy of the fixture: status → draft item → diff → apply → status(dirty=false) → rollback → status. Document the exact commands in `README.md`.

### 14.4 Coverage & CI gates
- `npm run check` runs, in order: `biome ci` (lint+format) → `tsc --noEmit` (typecheck) → `vitest run --coverage`.
- **Coverage thresholds (hard fail):** ≥ **90%** lines/branches on `src/mutate/**`, `src/validate/**`, `src/io/**`, `src/schema/**`; ≥ 75% overall. Set in `vitest.config.ts`.
- A pre-commit hook runs `biome` + `tsc --noEmit` + changed-file tests. CI runs the full `check` on every push.
- CI fails on any `console.log` in `src/` (lint rule) — protects the stdout channel.

### 14.5 Per-tool Definition of Done
A tool is done only when it has: (a) Zod input **and** output schemas; (b) unit tests for its handler logic; (c) ≥ 1 integration test against `sample-project`; (d) ≥ 1 failure-mode test (invalid input and, for apply tools, a refusal path); (e) for apply tools, an apply→rollback test.

---

## 15. Per-version build & Definition of Done

The same ladder as §2, in engineering terms: what to build and the gate that must be green before the next version begins. Every version also inherits the **per-tool DoD (§14.5)** for the tools it adds and must keep `npm run check` (§14.4) green. The MCP stdio server is introduced in v1 (read-only) and simply gains the new tools each subsequent version — it is not a separate milestone.

### v1 — Read & Summarize *(includes the one-time scaffold)*
- **Build:** repo scaffold per §8 (`package.json` ESM, strict `tsconfig`, `biome.json`, `vitest.config.ts`, CI script, `AGENTS.md` from §17); commit the `sample-project` + `broken-project` fixtures and the `withTempProject` helper; `io/project.ts`, `model/normalized.ts`, `engine/adapter.ts` + `engine/mv.ts`, the `commander` CLI; all v1 read tools; a minimal MCP stdio server exposing the read tools.
- **Tests:** schema-conformance (§14.3 #2) and round-trip/idempotence (#3) green; MCP contract tests (#7) for the read tools; assert read tools write nothing.
- **Ship gate:** `npm run check` green; every read tool correct on `sample-project`; coverage gate met for `io/**`, `model/**`, `schema/**`.

### v2 — Audit & Validate
- **Build:** finalize `schema/entities.ts` (no stray `z.any()` in tool-touched fields); `validate/refs.ts` + `validate/project.ts`; `validate_project_refs` (on-disk audit).
- **Tests:** reference-integrity (§14.3 #4) — exact seeded-issue detection on `broken-project`, zero false positives on `sample-project`, asserted per-issue.
- **Ship gate:** above green; coverage gate met for `validate/**`, `schema/**`.

### v3 — Safe Database Mutation *(first writes)*
- **Build:** `mutate/*` (staging + persistence, `patch.ts`, `backup.ts` + journal, `apply.ts` as the single writer, `rollback.ts`); all v3 propose tools; `diff_pending_changes`, `validate_project_refs{includePending}`, `apply_patch`, `rollback_last_patch`, `list/discard_pending_changes`, `list_backups`; optional git-snapshot flag (§10.9).
- **Tests:** mutation-safety crown jewels (§14.3 #5) and property-based (#6) — apply→rollback byte-identical, staleness refused, all-or-nothing proven, backups+journal verified.
- **Ship gate:** above green; coverage ≥ 90% on `mutate/**`, `validate/**`; the §1 headline success criterion demonstrable end-to-end.

### v4 — Events, Maps & Plugins
- **Build:** `schema/commands.ts` constrained builder (§5.4); `create_common_event_draft`; map-event read→write (`create_map_event_draft`, `update_map_event_draft`); plugin writes (`set_plugin_param_draft`, `add_plugin_draft`) via the §5.6 parser/serializer.
- **Tests:** golden-file tests proving the builder emits correct positional `parameters` (incl. the auto-appended `code:0` terminator); `plugins.js` parse→serialize round-trip; map-event apply→rollback clean; the constrained set rejects unsupported opcodes.
- **Ship gate:** above green; no code path accepts a raw `list[]`.

### v5 — In-Engine Integration
- **Build:** `js/plugins/BridgeInspector.js` (§13); the bridge↔plugin channel; `inspect_runtime`, `preview_entity`.
- **Tests:** plugin loads in a real MV project; inspection returns correct runtime state on a known save; the channel rejects any non-allowlisted/free-form input.
- **Ship gate:** above green; the plugin grants zero free-form execution.

### v6 — Full Surface (MVP / full functionality)
Each sub-feature is independently gated; ship them in any order.
- **HTTP (Fastify):** adapter reuses L1–L4 unchanged; contract tests mirror the MCP contract tests against the HTTP surface.
- **MZ adapter:** implement `MzAdapter`; the **entire** v1–v4 test suite passes against an MZ fixture with no changes to L4 tool logic.
- **Advanced event authoring:** per-opcode schemas; each opcode ships with its own validation + golden test before it is allowed.
- **Electron:** packaging smoke test; the core still runs headless.
- **Ship gate (MVP):** v1–v5 gates remain green **and** every shipped v6 sub-feature has its own gate green.

---

## 16. Coding conventions
- TypeScript `strict: true`; no `any` in exported signatures (`unknown` + narrowing instead).
- ESM imports with explicit `.js` specifiers (Node ESM requirement when running compiled output).
- Pure functions in L1–L3 where feasible; inject `fs`, clock, and logger so they're mockable.
- Errors via the §12 taxonomy; never throw bare strings.
- Every exported function has a one-line JSDoc stating its contract and failure modes.
- Keep files small and single-purpose (the §8 layout is the unit of organization).

---

## 17. Agent operating rules — copy verbatim into `AGENTS.md`
```
HARD INVARIANTS (do not violate):
1. Only src/mutate/apply.ts writes to the project's data/ or js/. No other file performs writes.
2. No tool writes to disk without: passing whole-changeset validation, a clean staleness check,
   a backup of every touched file, and an atomic temp+rename write. Apply is all-or-nothing.
3. Resolve every path and assert it is inside the project root (post-realpath). Reject .. and symlink escapes.
4. Never write to stdout. All logs go to stderr. No console.log in src/.
5. Treat data shapes as reference baselines; the official docs and the fixture project are ground truth.
   If they disagree with the spec, fix the schema, not the data.
6. Never execute or eval a damage formula, note value, or any project string.
7. Do not author raw event-command arrays. Use the constrained command builder only.
8. If a referenced id/file/path is missing, fail with a typed error. Never substitute or guess.
9. Build in version order. A tool is not done until it has the tests required by §14.5.
10. When genuinely unsure, stop and ask — do not invent behavior or game content.
```

---

## 18. Open questions / decisions log
Record here as you build (and surface blockers rather than guessing). Each tag shows the version by which the question must be resolved.
- **Common-event builder allowlist (by v4):** lock the exact supported command set (§5.4) before writing `schema/commands.ts`; propose it and confirm first.
- **Map-event writes (by v4):** confirmed in scope at v4 (read-only at v1–v3). Confirm whether *creating* new events, *editing* existing ones, or both are needed for the first v4 cut.
- **`apply_patch` granularity (resolved):** whole-changeset-as-one-transaction. Revisit only if per-entity apply is requested.
- **Git snapshot (by v3):** off by default; decide whether to default-on when a git repo is detected.
- **MZ deltas (by v6):** engine seam only until then; revisit field/format differences (Animations/Effekseer, plugin-command model) when MZ is scheduled.
- **HTTP auth (by v6):** if the HTTP surface ever binds beyond localhost, decide the auth model before exposing any write endpoint.
- Add any new runtime dependency here with a one-line justification (§7).

---

## 19. Appendix

### 19.1 Example flow (what the AI client does)
```
get_project_status                      → {dirty:false, pendingChanges:0}
create_item_draft {name:"Hi-Potion", itypeId:1, ...}
                                        → {changeId:"c1", preview:{id:34,...}, validation:{ok:true}}
create_skill_draft {name:"Firaga", stypeId:1, mpCost:24, damage:{type:1,elementId:2,formula:"a.mat*4 - b.mdf*2",...}}
                                        → {changeId:"c2", validation:{ok:true, warnings:["formula uses only allowed identifiers"]}}
diff_pending_changes                    → {patches:[{file:"data/Items.json",ops:[{op:"add",path:"/34",value:{...}}]}, ...], humanSummary:"+1 item, +1 skill"}
validate_project_refs {includePending:true} → {ok:true, issues:[]}
apply_patch {confirm:true}              → {transactionId:"t-2026...", filesWritten:["data/Items.json","data/Skills.json"], backupDir:".bridge/backups/t-2026..."}
# user dislikes it
rollback_last_patch                     → {restoredTransactionId:"t-2026...", filesRestored:2}
```

### 19.2 Example JSON Patch (semantic diff unit)
```json
{ "file": "data/Items.json",
  "ops": [ { "op": "add", "path": "/34", "value": { "id": 34, "name": "Hi-Potion", "itypeId": 1, "...": "..." } } ],
  "inverse": [ { "op": "remove", "path": "/34" } ] }
```

### 19.3 `withTempProject` helper (test ergonomics)
```ts
// copies a fixture into a fresh temp dir; returns its path; auto-cleans after the test
export async function withTempProject(
  fixture: 'sample-project' | 'broken-project',
  fn: (projectDir: string) => Promise<void>,
): Promise<void> { /* mkdtemp → cp -r fixture → fn → rm -rf */ }
```

---
*End of spec v0.1. Update the §18 log and bump the version as decisions land.*
