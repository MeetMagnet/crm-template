const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const databaseUrl = process.env.DATABASE_URL || "file:/data/crm.db";
if (databaseUrl.startsWith("file:")) {
  const dbPath = databaseUrl.slice("file:".length);
  fs.mkdirSync(path.dirname(dbPath) || ".", { recursive: true });
}

const prismaCli = path.join(__dirname, "..", "node_modules", "prisma", "build", "index.js");
run(process.execPath, [prismaCli, "migrate", "deploy"]);
run(process.execPath, [path.join(__dirname, "..", "prisma", "seed.js")]);

const server = spawn(process.execPath, ["server.js"], {
  stdio: "inherit",
  env: process.env,
  cwd: path.join(__dirname, ".."),
});

server.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
