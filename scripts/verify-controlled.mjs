import { spawn } from "node:child_process";

// A separate production server never sends requests to the configured real provider.
const port = process.env.VERIFY_PORT || "3228";
const baseURL = `http://127.0.0.1:${port}`;
try {
  await fetch(`${baseURL}/api/health`);
  throw new Error(`Port ${port} is occupied. Choose a free VERIFY_PORT.`);
} catch (error) {
  if (error.message.includes("occupied")) throw error;
}
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", port, "--hostname", "127.0.0.1"], {
  stdio: "ignore",
  env: { ...process.env, CODEX_API_KEY: "test-dummy-not-a-secret", CODEX_API_URL: "http://127.0.0.1:1/v1", CODEX_MODEL: "controlled-failure" },
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Controlled server exited before readiness");
    try { ready = (await fetch(`${baseURL}/api/health`)).ok; } catch { /* Wait for startup. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Controlled server did not become ready");
  const runner = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--workers=4", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL, CONTROLLED_PROVIDER_FAILURE: "1" },
  });
  process.exitCode = await new Promise((resolve, reject) => { runner.on("error", reject); runner.on("exit", code => resolve(code ?? 1)); });
} finally {
  server.kill();
}
