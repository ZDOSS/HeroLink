import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/e2e",
  workers: 1,
  timeout: 90000,
  reporter: "list",
  use: { screenshot: "only-on-failure", trace: "retain-on-failure" },
});
