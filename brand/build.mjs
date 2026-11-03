import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// @resvg/resvg-js is a dependency of apps/api (chart images).
const require = createRequire(join(HERE, '..', 'apps', 'api', 'package.json'));
const { Resvg } = require('@resvg/resvg-js');

const OUT = process.argv[2];
const WORDMARK_PATH = JSON.parse(readFileSync(join(HERE, 'wordmark.json'), 'utf8')).d;

const color = {
	blue: '#1F5FAE',
	blueMid: '#3B7BD0',
	blueLight: '#6FA8F0',
	coral: '#E8735A',
	ink: '#13233A',
	paper: '#F4F7FB',
};

/*
 * The mark: a ring that stops short of closing, and a coral dot that closes it. The dot is the patient
 * reaching care, the loop Loopwise exists to close. Ring centre (24, 24), radius 17, gap centred at -45°.
 */
const ring = (p) => `
	<path d="M40.87 21.93A17 17 0 1 1 26.07 7.13" fill="none" stroke="${p.ring}" stroke-width="7" stroke-linecap="round"/>
	<circle cx="36.02" cy="11.98" r="4.5" fill="${p.dot}"/>`;

const palettes = {
	// The UI ring is the mid blue, readable on white and on the ink sidebar alike.
	color: { ring: color.blueMid, dot: color.coral },
	deep: { ring: color.blue, dot: color.coral },
	white: { ring: '#FFFFFF', dot: color.coral },
	mono: { ring: '#5F6B7A', dot: '#9AA5B4' },
	outline: { ring: '#FFFFFF', dot: '#FFFFFF' },
};

const MARK_BOX = '0 0 48 48';
const svg = (viewBox, body, size = '') =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${size} fill="none">${body}\n</svg>\n`;

const mark = (palette) => svg(MARK_BOX, ring(palette));
const wordmark = (ink) => svg('0 -82 460 112', `\n\t<path d="${WORDMARK_PATH}" fill="${ink}"/>`);

// Poppins cap height sits at 0.57 × 70 ≈ 40, centred on the mark.
const fullLogo = (ink, palette) =>
	svg(
		'0 0 342 80',
		`
	<svg x="0" y="4" width="72" height="72" viewBox="${MARK_BOX}">${ring(palette)}</svg>
	<path transform="translate(80 60) scale(0.57)" d="${WORDMARK_PATH}" fill="${ink}"/>`,
	);

const hero = (fill, stroke) =>
	svg(
		'0 0 737 401',
		`
	<g opacity="0.5" transform="translate(208.5 40.5) scale(6.67)">
		<path d="M40.87 21.93A17 17 0 1 1 26.07 7.13" fill="none" stroke="${stroke}" stroke-width="7.3" stroke-linecap="round"/>
		<path d="M40.87 21.93A17 17 0 1 1 26.07 7.13" fill="none" stroke="${fill}" stroke-width="7" stroke-linecap="round"/>
		<circle cx="36.02" cy="11.98" r="4.65" fill="${stroke}"/>
		<circle cx="36.02" cy="11.98" r="4.5" fill="${fill}"/>
	</g>`,
		' width="737" height="401"',
	);

const square = (size, bg, palette, pad, radius) => {
	const inner = size - pad * 2;
	return svg(
		`0 0 ${size} ${size}`,
		`
	<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
	<svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="${MARK_BOX}">${ring(palette)}</svg>`,
	);
};

const appIcon = square(512, '#FFFFFF', palettes.deep, 88, 112);
const appIconDark = square(512, color.ink, palettes.white, 88, 112);

const files = {
	'svg/loopwise-mark.svg': mark(palettes.deep),
	'svg/loopwise-mark-white.svg': mark(palettes.white),
	'svg/loopwise-mark-greyscale.svg': mark(palettes.mono),
	'svg/loopwise-wordmark.svg': wordmark(color.ink),
	'svg/loopwise-wordmark-white.svg': wordmark(color.paper),
	'svg/loopwise-logo-light.svg': fullLogo(color.ink, palettes.deep),
	'svg/loopwise-logo-dark.svg': fullLogo(color.paper, palettes.color),
	'svg/loopwise-app-icon.svg': appIcon,
	'svg/loopwise-app-icon-dark.svg': appIconDark,
	'frontend/public/favicon.svg': mark(palettes.deep),
	'frontend/public/lightLogo.svg': hero('#F8F8F8', '#D8D8D8'),
	'frontend/public/darkLogo.svg': hero('#1A2433', '#2A3648'),
	'frontend/public/light-card-logo.svg': hero('#E8F0FA', '#B9D0EE'),
	'frontend/public/dark-card-logo.svg': hero('#16294A', '#2B4A7A'),
	'frontend/src/components/icons/loopwise-logo.svg': mark(palettes.color),
	// The wordmark follows `color`, so the sidebar (ink) and the sign-in page (either theme) both read.
	'frontend/src/components/icons/loopwise-full-logo.svg': fullLogo('currentColor', palettes.color),
	'frontend/src/components/icons/loopwise-logo-greyscale.svg': mark(palettes.mono),
};

const pngs = {
	'png/loopwise-logo-light-1200.png': [files['svg/loopwise-logo-light.svg'], 1200],
	'png/loopwise-logo-dark-1200.png': [files['svg/loopwise-logo-dark.svg'], 1200],
	'png/loopwise-app-icon-1024.png': [appIcon, 1024],
	'png/loopwise-app-icon-dark-1024.png': [appIconDark, 1024],
	'png/loopwise-mark-white-512.png': [files['svg/loopwise-mark-white.svg'], 512],
	'png/loopwise-mark-greyscale-512.png': [files['svg/loopwise-mark-greyscale.svg'], 512],
	'frontend/public/appicon.png': [square(180, '#FFFFFF', palettes.deep, 28, 0), 180],
	'frontend/public/icon-192.png': [appIcon, 192],
	'frontend/public/icon-512.png': [appIcon, 512],
	'frontend/public/color.png': [square(192, color.blue, palettes.white, 32, 0), 192],
	'frontend/public/outline.png': [mark(palettes.outline), 32],
	'frontend/src/components/icons/loopwise-desktop-logo.png': [appIcon, 512],
};
for (const size of [64, 128, 256, 512, 1024]) {
	pngs[`png/loopwise-mark-${size}.png`] = [files['svg/loopwise-mark.svg'], size];
}

const render = (source, width) => new Resvg(source, { fitTo: { mode: 'width', value: width } }).render().asPng();

const write = (relativePath, data) => {
	const path = join(OUT, relativePath);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, data);
};

for (const [path, content] of Object.entries(files)) {
	write(path, content);
}
for (const [path, [source, width]] of Object.entries(pngs)) {
	write(path, render(source, width));
}

const icoSizes = [16, 32, 48];
const icoImages = icoSizes.map((size) => render(mark(palettes.deep), size));
const header = Buffer.alloc(6 + 16 * icoImages.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);
let offset = header.length;
icoImages.forEach((image, index) => {
	const entry = 6 + index * 16;
	header.writeUInt8(icoSizes[index], entry);
	header.writeUInt8(icoSizes[index], entry + 1);
	header.writeUInt16LE(1, entry + 4);
	header.writeUInt16LE(32, entry + 6);
	header.writeUInt32LE(image.length, entry + 8);
	header.writeUInt32LE(offset, entry + 12);
	offset += image.length;
});
write('frontend/public/favicon.ico', Buffer.concat([header, ...icoImages]));

write(
	'frontend/public/site.webmanifest',
	JSON.stringify(
		{
			name: 'Loopwise',
			short_name: 'Loopwise',
			icons: [
				{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
				{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
			],
			theme_color: color.ink,
			background_color: '#FFFFFF',
			display: 'standalone',
		},
		null,
		'\t',
	) + '\n',
);

console.log('written to', OUT);
