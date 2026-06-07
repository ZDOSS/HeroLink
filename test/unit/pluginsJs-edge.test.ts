import { describe, it, expect } from "vitest";
import { parsePluginsJs } from "../../src/io/pluginsJs.js";

describe("pluginsJs edge cases", () => {
  it("throws on unmatched bracket", () => {
    const content = `var $plugins = [{"name":"test"`;
    expect(() => parsePluginsJs(content)).toThrow("Unmatched bracket");
  });

  it("handles nested brackets in strings", () => {
    const content = `var $plugins = [{"name":"test[0]","status":true,"description":"d","parameters":{}}]`;
    const result = parsePluginsJs(content);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("test[0]");
  });

  it("handles empty parameters", () => {
    const content = `var $plugins = [{"name":"test","status":false,"description":"","parameters":{}}]`;
    const result = parsePluginsJs(content);
    expect(result[0].parameters).toEqual({});
  });
});
