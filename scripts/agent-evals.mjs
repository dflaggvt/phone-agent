import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(root, "evals", "agent-behavior.json");
const sourcePath = resolve(root, "src", "application", "retell", "retellWebhookService.ts");

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const source = await readFile(sourcePath, "utf8");

const results = fixture.checks.map((check) => ({
  id: check.id,
  description: check.description,
  pass: source.includes(check.requiredText)
}));

const failed = results.filter((result) => !result.pass);
for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id} - ${result.description}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} agent behavior eval(s) failed.`);
  process.exit(1);
}

console.log(`\n${results.length} agent behavior eval(s) passed.`);
