// Builds the harness with a stub obsidian module and screenshots the card view for the README.
import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright");

const out = "tools/shots/build";
await esbuild.build({
	entryPoints: ["tools/shots/harness.ts"],
	bundle: true,
	outfile: `${out}/harness.js`,
	alias: { obsidian: "./tools/shots/obsidian-stub.ts" },
	format: "iife",
	logLevel: "warning",
});
const css = readFileSync("styles.css", "utf8");
const theme = readFileSync("tools/shots/theme.css", "utf8");
writeFileSync(`${out}/index.html`, `<!doctype html><meta charset="utf-8"><style>${theme}\n${css}</style><body><div id="root"></div><script src="harness.js"></script>`);

const browser = await chromium.launch();
for (const [name, hash] of [["card-view", ""], ["lighter-week", "#quiet"]]) {
	const page = await browser.newPage({ viewport: { width: 820, height: 900 }, deviceScaleFactor: 2 });
	await page.goto(`file://${process.cwd()}/${out}/index.html${hash}`);
	await page.waitForSelector("body[data-ready]");
	await page.locator(".ww-page").screenshot({ path: `images/${name}.png` });
	await page.close();
}
await browser.close();
