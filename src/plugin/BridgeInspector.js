//=============================================================================
// BridgeInspector.js
// RPG Maker MV Plugin for Content Bridge Integration
// Version: 1.0.0
//=============================================================================

/*:
 * @plugindesc Enables read-only runtime inspection and content preview for the RPG Maker MV Content Bridge.
 * @author HeroLink Bridge
 *
 * @param Channel Directory
 * @desc Directory for bridge communication files (relative to project root).
 * @default .bridge
 *
 * @param Poll Interval
 * @desc How often to check for commands (in frames, 60 = 1 second).
 * @default 60
 * @type number
 *
 * @help
 * ============================================================================
 * Bridge Inspector Plugin
 * ============================================================================
 *
 * This plugin enables the RPG Maker MV Content Bridge to inspect runtime state
 * and preview content in a running game. It provides READ-ONLY access to game
 * state and a narrow set of allowlisted preview commands.
 *
 * IMPORTANT: This plugin does NOT allow arbitrary code execution. All commands
 * are validated against an allowlist before execution.
 *
 * ============================================================================
 * Communication Channel
 * ============================================================================
 *
 * The plugin communicates with the bridge via JSON files in the channel directory:
 *
 * - runtime-state.json: Current game state (written by plugin, read by bridge)
 * - commands.json: Commands from bridge (written by bridge, read by plugin)
 * - responses.json: Command responses (written by plugin, read by bridge)
 *
 * ============================================================================
 * Plugin Commands
 * ============================================================================
 *
 * BridgeInspector INSPECT
 *   Writes current runtime state to runtime-state.json
 *
 * BridgeInspector PREVIEW_ITEM <itemId>
 *   Shows a preview notification for the specified item
 *
 * BridgeInspector PREVIEW_SKILL <skillId>
 *   Shows a preview notification for the specified skill
 *
 * BridgeInspector CLEAR_PREVIEW
 *   Clears any active preview
 *
 * ============================================================================
 * Security Model
 * ============================================================================
 *
 * - All plugin commands are validated against an allowlist
 * - No arbitrary code execution or eval() is used
 * - Runtime state is read-only (no mutations allowed)
 * - File I/O is limited to the channel directory
 *
 */

(function() {
  // ==========================================================================
  // Configuration
  // ==========================================================================

  var parameters = PluginManager.parameters("BridgeInspector");
  var channelDir = String(parameters["Channel Directory"] || ".bridge");
  var pollInterval = Number(parameters["Poll Interval"] || 60);

  // ==========================================================================
  // Allowlisted Commands
  // ==========================================================================

  var ALLOWED_COMMANDS = {
    INSPECT: true,
    PREVIEW_ITEM: true,
    PREVIEW_SKILL: true,
    CLEAR_PREVIEW: true,
  };

  // ==========================================================================
  // File I/O Helpers (Node.js fs module via nw.js)
  // ==========================================================================

  var fs = null;
  var path = null;

  try {
    // nw.js environment (RPG Maker MV)
    fs = require("fs");
    path = require("path");
  } catch (e) {
    console.error("BridgeInspector: Cannot access file system. Plugin disabled.");
  }

  function getChannelPath(filename) {
    if (!path || !fs) return null;
    var mainModule = process.mainModule || require.main;
    if (!mainModule || !mainModule.filename) return null;
    try {
      var projectRoot = fs.realpathSync(path.dirname(mainModule.filename));
      if (!/^\.bridge(?:\/[A-Za-z0-9_-]+)*$/.test(channelDir)) return null;
      if (channelDir.replace(/\\/g, "/").split("/").indexOf("..") >= 0 || path.isAbsolute(channelDir)) return null;
      var target = path.resolve(projectRoot, channelDir, filename);
      var relative = path.relative(projectRoot, target);
      if (relative === ".." || relative.indexOf(".." + path.sep) === 0 || path.isAbsolute(relative)) return null;
      var ancestor = target;
      while (!fs.existsSync(ancestor)) {
        try { if (fs.lstatSync(ancestor).isSymbolicLink()) return null; } catch (e) { if (e.code !== "ENOENT") return null; }
        ancestor = path.dirname(ancestor);
      }
      var canonicalAncestor = fs.realpathSync(ancestor);
      if (path.relative(canonicalAncestor, ancestor) !== "") return null;
      relative = path.relative(projectRoot, canonicalAncestor);
      if (relative === ".." || relative.indexOf(".." + path.sep) === 0 || path.isAbsolute(relative)) return null;
      return target;
    } catch (e) { return null; }
  }

  function acquireResponseLock() {
    var lockPath = getChannelPath("responses.lock");
    if (!lockPath) return false;
    try {
      // Atomic directory creation as cross-process lock
      fs.mkdirSync(lockPath);
      return true;
    } catch (e) {
      return false;
    }
  }

  function releaseResponseLock() {
    var lockPath = getChannelPath("responses.lock");
    if (!lockPath) return;
    try {
      fs.rmdirSync(lockPath);
    } catch (e) {
      // Best effort
    }
  }

  function acquireCommandLock() {
    var lockPath = getChannelPath("commands.lock");
    if (!lockPath) return false;
    try {
      fs.mkdirSync(lockPath);
      return true;
    } catch (e) {
      return false;
    }
  }

  function releaseCommandLock() {
    var lockPath = getChannelPath("commands.lock");
    if (!lockPath) return;
    try {
      fs.rmdirSync(lockPath);
    } catch (e) {
      // Best effort
    }
  }

  function writeJson(filename, data) {
    if (!fs || !path) return false;
    var temporary = null;
    var descriptor = null;
    try {
      var filepath = getChannelPath(filename);
      if (!filepath) return false;
      var dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      temporary = getChannelPath(filename + "." + process.pid + "." + Date.now() + "." + Math.random().toString(16).slice(2) + ".tmp");
      if (!temporary) return false;
      descriptor = fs.openSync(temporary, "wx");
      fs.writeFileSync(descriptor, JSON.stringify(data, null, 2), "utf8");
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = null;
      filepath = getChannelPath(filename);
      if (!filepath) return false;
      fs.renameSync(temporary, filepath);
      temporary = null;
      return true;
    } catch (e) {
      console.error("BridgeInspector: Failed to write " + filename, e);
      return false;
    } finally {
      if (descriptor !== null) fs.closeSync(descriptor);
      if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  function readJson(filename) {
    if (!fs || !path) return null;
    try {
      var filepath = getChannelPath(filename);
      if (!filepath) return null;
      if (!fs.existsSync(filepath)) return null;
      var content = fs.readFileSync(filepath, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      throw new Error("BridgeInspector: Invalid channel file " + filename + ": " + e.message);
    }
  }

  // ==========================================================================
  // Runtime State Collection (Read-Only)
  // ==========================================================================

  function collectRuntimeState() {
    var state = {
      timestamp: Date.now(),
      game: null,
      party: null,
      map: null,
      switches: null,
      variables: null,
    };

    // Game info
    if ($dataSystem) {
      state.game = {
        title: $dataSystem.gameTitle,
        versionId: $dataSystem.versionId,
      };
    }

    // Party info
    if ($gameParty && $gameParty.members()) {
      state.party = {
        members: $gameParty.members().map(function(actor) {
          return {
            id: actor.actorId(),
            name: actor.name(),
            level: actor.level,
            hp: actor.hp,
            mp: actor.mp,
            tp: actor.tp,
          };
        }),
        gold: $gameParty.gold(),
      };
    }

    // Map info
    if ($gameMap) {
      state.map = {
        mapId: $gameMap.mapId(),
        displayName: $gameMap.displayName(),
        playerX: $gamePlayer ? $gamePlayer.x : null,
        playerY: $gamePlayer ? $gamePlayer.y : null,
        playerDirection: $gamePlayer ? $gamePlayer.direction() : null,
      };
    }

    // Switches and variables (use public API instead of private _data)
    if ($gameSwitches && $gameVariables && $dataSystem) {
      var switchCount = $dataSystem.switches.length;
      var variableCount = $dataSystem.variables.length;

      state.switches = [];
      for (var i = 1; i < switchCount; i++) {
        state.switches.push($gameSwitches.value(i));
      }

      state.variables = [];
      for (var j = 1; j < variableCount; j++) {
        state.variables.push($gameVariables.value(j));
      }
    }

    return state;
  }

  // ==========================================================================
  // Command Processing (Allowlisted Only)
  // ==========================================================================

  function processCommands() {
    var haveCmdLock = acquireCommandLock();
    if (!haveCmdLock) return;
    try {
      var haveResponseLock = acquireResponseLock();
      if (!haveResponseLock) return;
      try {
        var commands = readJson("commands.json");
        if (!Array.isArray(commands)) return;
        var responses = readJson("responses.json");
        if (responses === null) responses = [];
        if (!Array.isArray(responses)) return;
        var receipts = readJson("executed.json");
        if (receipts === null) receipts = {};
        if (typeof receipts !== "object" || Array.isArray(receipts)) return;
        for (var oldId in receipts) if (Object.prototype.hasOwnProperty.call(receipts, oldId) && receipts[oldId].expiresAt < Date.now()) delete receipts[oldId];
        for (var i = 0; i < commands.length; i++) {
          var cmd = commands[i];
          if (!cmd || typeof cmd.id !== "string" || !/^[a-f0-9-]{36}$/.test(cmd.id) || typeof cmd.command !== "string") continue;
          var cancellation = getChannelPath(cmd.id + ".cancelled");
          if (!cancellation) return;
          if (typeof cmd.expiresAt !== "number" || cmd.expiresAt <= Date.now() || fs.existsSync(cancellation)) continue;
          if (!Object.prototype.hasOwnProperty.call(receipts, cmd.id)) {
            // Persist the claim BEFORE previewing. After a crash an uncertain
            // execution is reported as such; it is never replayed automatically.
            receipts[cmd.id] = { expiresAt: cmd.expiresAt, response: { id: cmd.id, command: cmd.command, success: false, result: null, error: "Execution interrupted; preview may already have been shown" } };
            var claimed = writeJson("executed.json", receipts);
            if (!claimed) return;
            var result = executeCommand(cmd);
            receipts[cmd.id].response = { id: cmd.id, command: cmd.command, success: result.success, result: result.result, error: result.error };
            var recorded = writeJson("executed.json", receipts);
            if (!recorded) return;
          }
          if (!responses.some(function(r) { return r.id === cmd.id; })) responses.push(receipts[cmd.id].response);
        }
        var wroteResponses = writeJson("responses.json", responses);
        if (!wroteResponses) return;
        var cleared = writeJson("commands.json", []);
        if (!cleared) return;
        // Tombstones are unique per command and no longer needed after removal.
        for (var j = 0; j < commands.length; j++) {
          if (!commands[j] || !/^[a-f0-9-]{36}$/.test(commands[j].id)) continue;
          var tombstone = getChannelPath(commands[j].id + ".cancelled");
          if (!tombstone) return;
          if (fs.existsSync(tombstone)) fs.unlinkSync(tombstone);
        }
      } finally { releaseResponseLock(); }
    } catch (e) { console.error("BridgeInspector: Channel processing failed", e); }
    finally { releaseCommandLock(); }
  }

  function executeCommand(cmd) {
    var commandName = cmd.command.toUpperCase();

    // Validate against allowlist
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_COMMANDS, commandName)) {
      return {
        success: false,
        result: null,
        error: "Command not allowlisted: " + cmd.command,
      };
    }

    try {
      switch (commandName) {
        case "INSPECT":
          return handleInspect();
        case "PREVIEW_ITEM":
          return handlePreviewItem(cmd.args);
        case "PREVIEW_SKILL":
          return handlePreviewSkill(cmd.args);
        case "CLEAR_PREVIEW":
          return handleClearPreview();
        default:
          return {
            success: false,
            result: null,
            error: "Unknown command: " + commandName,
          };
      }
    } catch (e) {
      return {
        success: false,
        result: null,
        error: "Command execution failed: " + e.message,
      };
    }
  }

  function handleInspect() {
    var state = collectRuntimeState();
    var wrote = writeJson("runtime-state.json", state);
    if (!wrote) {
      return {
        success: false,
        result: null,
        error: "Failed to write runtime-state.json",
      };
    }
    return {
      success: true,
      result: { message: "Runtime state written to runtime-state.json" },
      error: null,
    };
  }

  function handlePreviewItem(args) {
    if (!args || !args.itemId) {
      return {
        success: false,
        result: null,
        error: "PREVIEW_ITEM requires itemId argument",
      };
    }

    var itemId = Number(args.itemId);
    var item = Number.isInteger(itemId) && itemId > 0 && $dataItems ? $dataItems[itemId] : null;

    if (!item) {
      return {
        success: false,
        result: null,
        error: "Item not found: " + itemId,
      };
    }

    // Show a simple message (non-intrusive preview)
    if ($gameMessage) {
      $gameMessage.add("Preview: " + item.name);
      $gameMessage.add(item.description);
    }

    return {
      success: true,
      result: {
        itemId: itemId,
        name: item.name,
        description: item.description,
      },
      error: null,
    };
  }

  function handlePreviewSkill(args) {
    if (!args || !args.skillId) {
      return {
        success: false,
        result: null,
        error: "PREVIEW_SKILL requires skillId argument",
      };
    }

    var skillId = Number(args.skillId);
    var skill = Number.isInteger(skillId) && skillId > 0 && $dataSkills ? $dataSkills[skillId] : null;

    if (!skill) {
      return {
        success: false,
        result: null,
        error: "Skill not found: " + skillId,
      };
    }

    // Show a simple message (non-intrusive preview)
    if ($gameMessage) {
      $gameMessage.add("Preview: " + skill.name);
      $gameMessage.add(skill.description);
    }

    return {
      success: true,
      result: {
        skillId: skillId,
        name: skill.name,
        description: skill.description,
      },
      error: null,
    };
  }

  function handleClearPreview() {
    if ($gameMessage) {
      $gameMessage.clear();
    }
    return {
      success: true,
      result: { message: "Preview cleared" },
      error: null,
    };
  }

  // ==========================================================================
  // Plugin Command Registration
  // ==========================================================================

  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function (command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command === "BridgeInspector") {
      var subCommand = args[0] ? args[0].toUpperCase() : "";

      if (!Object.prototype.hasOwnProperty.call(ALLOWED_COMMANDS, subCommand)) {
        console.warn("BridgeInspector: Command not allowlisted: " + subCommand);
        return;
      }

      switch (subCommand) {
        case "INSPECT":
          handleInspect();
          break;
        case "PREVIEW_ITEM":
          handlePreviewItem({ itemId: args[1] });
          break;
        case "PREVIEW_SKILL":
          handlePreviewSkill({ skillId: args[1] });
          break;
        case "CLEAR_PREVIEW":
          handleClearPreview();
          break;
      }
    }
  };

  // ==========================================================================
  // Update Loop (Poll for Commands)
  // ==========================================================================

  var _Scene_Base_update = Scene_Base.prototype.update;
  Scene_Base.prototype.update = function () {
    _Scene_Base_update.call(this);

    // Poll for commands at specified interval (guard against pollInterval=0)
    if (pollInterval > 0 && Graphics.frameCount % pollInterval === 0) {
      processCommands();
    }
  };

  // ==========================================================================
  // Initialization
  // ==========================================================================

  // Write initial state on scene start
  var _Scene_Map_start = Scene_Map.prototype.start;
  Scene_Map.prototype.start = function () {
    _Scene_Map_start.call(this);

    // Ensure channel directory exists
    if (fs && path) {
      var dirPath = getChannelPath("");
      if (dirPath && !fs.existsSync(dirPath)) {
        try {
          fs.mkdirSync(dirPath, { recursive: true });
        } catch (e) {
          console.error("BridgeInspector: Failed to create channel directory", e);
        }
      }
    }

    // Write initial runtime state
    handleInspect();
  };
})();
