/**
 * Get the relative path from the project directory to a file.
 * Normalizes backslashes to forward slashes and removes leading slashes.
 */
export function getRelPath(filePath: string, projectDir: string): string {
  return filePath
    .replace(projectDir, "")
    .replace(/^[\\/]/, "")
    .replace(/\\/g, "/");
}
