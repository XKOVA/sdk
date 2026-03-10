import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ORDER = [
  "@xkova/sdk-agent",
  "@xkova/sdk-core",
  "@xkova/sdk-browser",
  "@xkova/sdk-react",
  "@xkova/sdk-react-ui",
  "@xkova/sdk",
];

const manifestByName = new Map();
for (const dir of ["sdk", "sdk-core", "sdk-react", "sdk-react-ui", "sdk-browser", "sdk-agent"]) {
  const manifest = JSON.parse(readFileSync(new URL(`../packages/${dir}/package.json`, import.meta.url), "utf8"));
  manifestByName.set(manifest.name, manifest);
}

const validateOrder = () => {
  const indexByName = new Map(ORDER.map((name, idx) => [name, idx]));
  for (const name of ORDER) {
    const manifest = manifestByName.get(name);
    if (!manifest) {
      throw new Error(`Publish order references unknown package: ${name}`);
    }

    const internalDeps = Object.keys(manifest.dependencies ?? {}).filter((dep) => indexByName.has(dep));
    for (const dep of internalDeps) {
      if (indexByName.get(dep) > indexByName.get(name)) {
        throw new Error(
          `Publish order invalid: ${name} depends on ${dep}, but ${dep} appears later in ORDER.`,
        );
      }
    }
  }
};

const isPublished = (name, version) => {
  const check = spawnSync("npm", ["view", `${name}@${version}`, "version", "--json"], {
    encoding: "utf8",
  });
  if (check.status === 0) return true;
  const output = `${check.stdout ?? ""}\n${check.stderr ?? ""}`;
  if (output.includes("E404") || output.includes("404")) return false;
  throw new Error(`Failed to query npm for ${name}@${version}:\n${output}`);
};

const runPublish = (name) => {
  const result = spawnSync(
    "pnpm",
    ["--filter", name, "publish", "--access", "public", "--no-git-checks"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const main = () => {
  const dryRun = process.argv.includes("--dry-run");
  validateOrder();

  console.log("Sequential publish order:");
  for (const name of ORDER) console.log(`- ${name}`);

  for (const name of ORDER) {
    const manifest = manifestByName.get(name);
    const version = manifest.version;
    if (dryRun) {
      console.log(`[dry-run] would publish ${name}@${version}`);
      continue;
    }

    if (isPublished(name, version)) {
      console.log(`Skipping ${name}@${version}; already published.`);
      continue;
    }

    console.log(`Publishing ${name}@${version}...`);
    runPublish(name);
  }
};

main();
