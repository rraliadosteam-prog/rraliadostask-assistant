// Copies the canonical RR Aliados logo into the native icon path.
// The source asset is versioned locally so a fresh clone builds without
// depending on the dashboard repository or a network URL.
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const source = join(process.cwd(), "public", "brand", "rr-logo-fucsia-on-negro.png");
const target = join(process.cwd(), "src-tauri", "icons", "icon.png");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`icon copied: ${target} (${statSync(target).size} bytes)`);
