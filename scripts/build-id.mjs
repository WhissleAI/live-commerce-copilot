// Stamps this build so an open tab can notice a newer one. A single-page app
// keeps running the code it loaded until someone reloads; without this a
// deploy was invisible to every tab already open, which read as "the button
// does nothing" to whoever was looking at it.
import { mkdirSync, writeFileSync } from "node:fs";
const id = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/buildId.ts", `export const BUILD_ID = "${id}";\n`);
mkdirSync("public", { recursive: true });
writeFileSync("public/build.json", JSON.stringify({ id }) + "\n");
console.log(`build id ${id}`);
