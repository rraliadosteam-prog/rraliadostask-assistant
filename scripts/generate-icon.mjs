// Generates the application icon so the repository stays text-only and a fresh
// clone can build without a binary asset in git.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SIZE = 64;
const BACKGROUND = [251, 248, 243, 255];
const MARK = [173, 27, 103, 255];

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

const rows = [];
for (let y = 0; y < SIZE; y += 1) {
	const row = Buffer.alloc(SIZE * 4 + 1);
	row[0] = 0;
	for (let x = 0; x < SIZE; x += 1) {
		const inside = x >= 8 && x < 56 && y >= 8 && y < 56;
		const color = inside ? MARK : BACKGROUND;
		row.set(color, 1 + x * 4);
	}
	rows.push(row);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 6; // colour type: RGBA
header[10] = 0;
header[11] = 0;
header[12] = 0;

const png = Buffer.concat([
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	chunk("IHDR", header),
	chunk("IDAT", deflateSync(Buffer.concat(rows))),
	chunk("IEND", Buffer.alloc(0)),
]);

const target = join(process.cwd(), "src-tauri", "icons", "icon.png");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, png);
console.log(`icon written: ${target} (${png.length} bytes)`);
