import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node ./scripts/scope-styles.mjs <input.css> <output.css>");
  process.exit(1);
}

const inputCss = await readFile(inputPath, "utf8");

const { css } = await postcss([
  prefixSelector({
    prefix: ".xkova-theme",
    transform(prefix, selector, prefixedSelector) {
      if (selector === ":root" || selector === ":host") {
        return prefix;
      }

      if (selector.startsWith(".xkova-theme")) {
        return selector;
      }

      if (selector === "from" || selector === "to" || /^\d+%$/.test(selector)) {
        return selector;
      }

      return prefixedSelector;
    },
  }),
]).process(inputCss, {
  from: inputPath,
  to: outputPath,
});

const dedupedCss = css.replaceAll(".xkova-theme,.xkova-theme{", ".xkova-theme{");
await writeFile(outputPath, dedupedCss, "utf8");
