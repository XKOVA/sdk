import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, "..");
const stylesPath = path.join(packageRoot, "styles.css");

test("@xkova/sdk-react-ui publishes compiled styles", () => {
  const css = readFileSync(stylesPath, "utf8");

  assert.match(css, /\.xkova-theme/);
  assert.match(css, /\.xkova-theme \.bg-background/);
  assert.match(css, /\.xkova-theme \.text-card-foreground/);
  assert.match(css, /\.xkova-theme \.h-5/);
  assert.match(css, /\.xkova-theme \.w-5/);
  assert.match(css, /\.xkova-theme \.flex-1/);
  assert.match(css, /\.xkova-theme \.h-\\\[1em\\\]/);
  assert.match(css, /\.xkova-theme \.w-\\\[1em\\\]/);

  // Ensure the package does not emit unscoped global theme/utility selectors.
  assert.doesNotMatch(css, /:root/);
  assert.doesNotMatch(css, /(?:^|})\.h-5\{/);
});
