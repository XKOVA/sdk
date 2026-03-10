import test from "node:test";
import assert from "node:assert/strict";

test("@xkova/sdk-react-ui entrypoints import successfully", async () => {
  const index = await import("../dist/index.js");
  const utils = await import("../dist/utils.js");

  assert.equal(typeof index, "object");
  assert.equal(typeof utils, "object");

  assert.ok("Toaster" in index);
  assert.equal(typeof utils.cn, "function");
});
