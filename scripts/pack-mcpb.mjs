// pack-mcpb.mjs — produce poc-mcp.mcpb for one-click install in Claude Desktop.
//
// An .mcpb file is a zip containing manifest.json plus a self-contained server.
// We ship the bundled entry point and the three external dependencies, so the
// user needs nothing but Node.
//
// Run `npm run build` first.

import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const staging = resolve(root, "build/mcpb");
const outfile = resolve(root, "build/poc-mcp.mcpb");

const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));

// The manifest version must track the package version, or Claude Desktop will
// offer a stale update prompt.
if (manifest.version !== pkg.version) {
  throw new Error(
    `manifest.json version (${manifest.version}) != package.json version (${pkg.version}). ` +
      "Bump both together.",
  );
}

const bundled = resolve(root, "dist/index.js");
try {
  await readFile(bundled);
} catch {
  throw new Error("dist/index.js is missing. Run `npm run build` first.");
}

await rm(staging, { recursive: true, force: true });
await mkdir(resolve(staging, "server"), { recursive: true });

await cp(resolve(root, "manifest.json"), resolve(staging, "manifest.json"));
await cp(bundled, resolve(staging, "server/index.js"));
const readme = resolve(root, "README.md");
await cp(readme, resolve(staging, "README.md")).catch(() => {
  // README is optional for packing.
});

// A minimal package.json so `npm install --omit=dev` pulls only the externals
// the bundle actually imports at runtime. The dependency list comes from
// dist/package.publish.json, which the bundler writes — deriving it a second
// time here would let the two drift and silently reinstall bundled packages.
//
// In the public repo (zerohuman-ai/poc-mcp) that file does not exist: the tree
// there IS the published package, so its own package.json already lists exactly
// the runtime externals. Falling back to it keeps one packer for both trees.
let runtimeDeps;
try {
  const publishPkg = JSON.parse(
    await readFile(resolve(root, "dist/package.publish.json"), "utf8"),
  );
  runtimeDeps = publishPkg.dependencies ?? {};
} catch {
  runtimeDeps = pkg.dependencies ?? {};
}
await writeFile(
  resolve(staging, "server/package.json"),
  `${JSON.stringify(
    { name: "phoneoncloud-mcp-server", version: pkg.version, type: "module", private: true, dependencies: runtimeDeps },
    null,
    2,
  )}\n`,
);

console.log("installing runtime dependencies into the bundle…");
await run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--silent"], {
  cwd: resolve(staging, "server"),
});

await rm(outfile, { force: true });
// `zip -r` keeps paths relative to the staging dir, which is what the manifest's
// `server/index.js` entry_point expects.
await run("zip", ["-qr", outfile, "."], { cwd: staging });

const { stdout } = await run("du", ["-h", outfile]);
console.log(`packed → ${outfile.replace(`${root}/`, "")} (${stdout.trim().split(/\s+/)[0]})`);
console.log("Attach this file to a GitHub Release; the web UI links to the latest one.");
