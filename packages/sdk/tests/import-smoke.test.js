import test from "node:test";
import assert from "node:assert/strict";

test("@xkova/sdk root and subpath entrypoints import successfully", async () => {
  const root = await import("../dist/index.js");
  const core = await import("../dist/core.js");
  const react = await import("../dist/react.js");
  const ui = await import("../dist/ui.js");
  const browser = await import("../dist/browser.js");

  assert.equal(typeof root, "object");
  assert.equal(typeof core, "object");
  assert.equal(typeof react, "object");
  assert.equal(typeof ui, "object");
  assert.equal(typeof browser, "object");

  assert.equal(typeof root.generatePKCE, "function");
  assert.equal(typeof react.XKOVAProvider, "function");
  assert.ok("Toaster" in ui);
  assert.equal(typeof browser.createBrowserIeeReceiptProvider, "function");
});
