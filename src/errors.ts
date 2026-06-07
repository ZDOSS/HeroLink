import type { ZodIssue } from "zod";

export class ProjectNotFoundError extends Error {
  readonly projectDir: string;
  constructor(projectDir: string) {
    super(`Project not found: ${projectDir} (missing Game.rpgproject)`);
    this.name = "ProjectNotFoundError";
    this.projectDir = projectDir;
  }
}

export class ValidationError extends Error {
  readonly issues: ZodIssue[];
  constructor(issues: ZodIssue[]) {
    super(`Validation failed: ${issues.length} issue(s)`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export interface RefIssue {
  severity: "error" | "warn";
  location: string;
  message: string;
  refKind: string;
}

export class RefIntegrityError extends Error {
  readonly issues: RefIssue[];
  constructor(issues: RefIssue[]) {
    super(
      `Reference integrity check failed: ${issues.filter((i) => i.severity === "error").length} error(s)`,
    );
    this.name = "RefIntegrityError";
    this.issues = issues;
  }
}

export class StaleProjectError extends Error {
  readonly changedFiles: string[];
  constructor(changedFiles: string[]) {
    super(`Project files changed on disk: ${changedFiles.join(", ")}`);
    this.name = "StaleProjectError";
    this.changedFiles = changedFiles;
  }
}

export class PathEscapeError extends Error {
  readonly path: string;
  constructor(path: string) {
    super(`Path escapes project root: ${path}`);
    this.name = "PathEscapeError";
    this.path = path;
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class IoError extends Error {
  readonly filePath: string;
  constructor(filePath: string, cause: unknown) {
    super(`I/O error on ${filePath}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "IoError";
    this.filePath = filePath;
  }
}
