// Fails on the rules that are easy to break unnoticed (docs/frontend-design.md §8):
// sizes in rem, colours from tokens, and CSS Module classes that exist.
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../src');
/** Generated or token files, plus stylesheets that style third-party markup at its own scale. */
const EXEMPT = /theme\/(tokens|palette|streamdown|reset|global|animations)\.css$/;
/** px stays for hairlines, shadows, outlines, transforms and media queries. */
const PX_ALLOWED_PROP =
	/^(border|box-shadow|outline|transform|translate|text-decoration|stroke-width|filter|backdrop-filter|--fx-|--popover-)/;

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, out);
		} else {
			out.push(full);
		}
	}
	return out;
}

const problems = [];
const files = walk(SRC);
for (const file of files.filter((f) => f.endsWith('.css') && !EXEMPT.test(f))) {
	fs.readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, index) => {
			const where = `${path.relative(SRC, file)}:${index + 1}`;
			const declaration = line.match(/^\s*([-\w]+)\s*:\s*(.+)$/);
			if (!declaration) {
				return;
			}
			const [, prop, value] = declaration;
			if (!PX_ALLOWED_PROP.test(prop) && /(?<![\w.])(?!0px|1px|0\.5px)\d*\.?\d+px\b/.test(value)) {
				problems.push(`${where} use rem, not px: ${line.trim()}`);
			}
			if (!prop.startsWith('--') && /#[0-9a-fA-F]{3,8}\b/.test(value)) {
				problems.push(`${where} use a token, not hex: ${line.trim()}`);
			}
		});
}
for (const file of files.filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))) {
	const text = fs.readFileSync(file, 'utf8');
	for (const [, name, specifier] of text.matchAll(/import (\w+) from '(\.[^']+\.module\.css)'/g)) {
		const cssPath = path.resolve(path.dirname(file), specifier);
		if (!fs.existsSync(cssPath)) {
			problems.push(`${path.relative(SRC, file)} imports a missing stylesheet: ${specifier}`);
			continue;
		}
		const css = fs.readFileSync(cssPath, 'utf8');
		for (const [, key] of text.matchAll(new RegExp(`\\b${name}\\.(\\w+)`, 'g'))) {
			if (!new RegExp(`\\.${key}(?![\\w-])`).test(css)) {
				problems.push(`${path.relative(SRC, file)} uses a class its stylesheet lacks: ${name}.${key}`);
			}
		}
	}
}

if (problems.length) {
	console.error([...new Set(problems)].join('\n'));
	console.error(`\n${new Set(problems).size} style problems`);
	process.exit(1);
}
