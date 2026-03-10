/**
 * Test-only ESM resolver:
 * allow extensionless relative imports in built dist modules.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.endsWith(".js") &&
      !specifier.endsWith(".json") &&
      !specifier.endsWith(".node")
    ) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}
