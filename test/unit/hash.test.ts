import { describe, it, expect } from "vitest";
import { hashContent, hashFile, snapshotFile, snapshotFiles, checkStaleness } from "../../src/model/hash.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("hash", () => {
  it("hashContent produces consistent hashes", () => {
    const h1 = hashContent("test");
    const h2 = hashContent("test");
    expect(h1).toBe(h2);
  });

  it("hashContent produces different hashes for different content", () => {
    const h1 = hashContent("test1");
    const h2 = hashContent("test2");
    expect(h1).not.toBe(h2);
  });

  it("hashFile hashes file contents", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-hash-test-"));
    const filePath = join(tempDir, "test.txt");
    writeFileSync(filePath, "hello");
    const hash = hashFile(filePath);
    expect(hash).toBe(hashContent("hello"));
  });

  it("hashFile throws on missing file", () => {
    expect(() => hashFile("/nonexistent/file.txt")).toThrow();
  });

  it("snapshotFile captures hash and mtime", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-hash-test-"));
    const filePath = join(tempDir, "test.txt");
    writeFileSync(filePath, "hello");
    const snapshot = snapshotFile(filePath);
    expect(snapshot.hash).toBe(hashContent("hello"));
    expect(snapshot.mtime).toBeGreaterThan(0);
  });

  it("snapshotFile throws on missing file", () => {
    expect(() => snapshotFile("/nonexistent/file.txt")).toThrow();
  });

  it("snapshotFiles captures multiple files", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-hash-test-"));
    const file1 = join(tempDir, "test1.txt");
    const file2 = join(tempDir, "test2.txt");
    writeFileSync(file1, "hello");
    writeFileSync(file2, "world");
    const snapshots = snapshotFiles([file1, file2]);
    expect(snapshots.size).toBe(2);
    expect(snapshots.get(file1)?.hash).toBe(hashContent("hello"));
    expect(snapshots.get(file2)?.hash).toBe(hashContent("world"));
  });

  it("checkStaleness detects changed files", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-hash-test-"));
    const filePath = join(tempDir, "test.txt");
    writeFileSync(filePath, "hello");
    const snapshot = snapshotFile(filePath);
    const snapshots = new Map([[filePath, snapshot]]);

    expect(checkStaleness(snapshots)).toHaveLength(0);

    writeFileSync(filePath, "changed");
    const changed = checkStaleness(snapshots);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toBe(filePath);
  });

  it("checkStaleness detects deleted files", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rpgmv-hash-test-"));
    const filePath = join(tempDir, "test.txt");
    writeFileSync(filePath, "hello");
    const snapshot = snapshotFile(filePath);
    const snapshots = new Map([[filePath, snapshot]]);

    const { unlinkSync } = require("node:fs");
    unlinkSync(filePath);
    const changed = checkStaleness(snapshots);
    expect(changed).toHaveLength(1);
  });
});
