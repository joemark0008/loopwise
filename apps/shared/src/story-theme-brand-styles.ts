import { STORY_TEXT_ROLES, type StoryTextRole } from './story-theme-typography';

export function storyBrandStyles(scope = ''): string {
	return BRAND_RULES.map(([selectors, declarations]) => `${scopeSelectors(selectors, scope)}{${declarations}}`).join(
		'\n',
	);
}

const KPI_TILE = ':is(.quarry-kpi,.story-block:has(.quarry-kpi-card))';
const WASHED_CARD = 'color-mix(in srgb,var(--story-kpi-wash,var(--card)) var(--story-kpi-tint,0%),var(--card))';
const HEADING_SCALE = 'var(--story-heading-scale,1)';
/** The chart hover band (7% of the ink over the block), reused so every hover takes the theme's own tint. */
const INK_VEIL = 'color-mix(in srgb,var(--foreground) 7%,var(--card))';

/** Which elements speak in each text role, with the size the role's multiplier scales; null keeps the element's own. */
const ROLE_TARGETS: Record<StoryTextRole, [string, string | null][]> = {
	wordmark: [['.quarry-brand-header__name', '24px']],
	display: [
		['h1', `calc(1.875rem * ${HEADING_SCALE})`],
		['.quarry-slide__title', '52px'],
		['.quarry-slides__title', null],
	],
	heading: [['h2', `calc(1.5rem * ${HEADING_SCALE})`]],
	subheading: [
		['h3', `calc(1.25rem * ${HEADING_SCALE})`],
		['h4', `calc(1.125rem * ${HEADING_SCALE})`],
		['.quarry-block__title', '14px'],
		['.quarry-chart-title', '14px'],
	],
	body: [
		[':is(p,li)', 'var(--story-body-size,1rem)'],
		['.quarry-table-display td', null],
	],
	label: [
		['.quarry-kpi-card__name', '16px'],
		['.quarry-table-display th', '12px'],
		['.recharts-cartesian-axis-tick text', '12px'],
		[':is(.quarry-label,.quarry-slides__eyebrow,.quarry-slide__eyebrow)', null],
	],
	button: [
		[':is(.quarry-button,.quarry-chip,.quarry-filter__control,.quarry-filter__clear)', '13px'],
		[':is([role=tab],.quarry-story-tab)', null],
	],
	figure: [['.quarry-kpi-card__value', null]],
};

const BRAND_RULES: [string[], string][] = [
	[['.recharts-wrapper :is(text,tspan)'], 'font-family:var(--font-sans)'],
	/** The hover band is a veil of the ink, so it takes the block's own tint instead of a fixed grey. */
	[
		['.recharts-wrapper .recharts-rectangle.recharts-tooltip-cursor'],
		'fill:var(--foreground);fill-opacity:.07;opacity:1',
	],
	[['.recharts-wrapper .recharts-curve.recharts-tooltip-cursor'], 'stroke:var(--foreground);stroke-opacity:.25'],
	...STORY_TEXT_ROLES.flatMap((role) =>
		ROLE_TARGETS[role].map(([selector, size]): [string[], string] => [[selector], roleDeclarations(role, size)]),
	),
	[['.quarry-kpi-card'], 'container-type:inline-size'],
	/** Shrinks a long figure to its tile instead of clipping it. */
	[
		['.quarry-kpi-card__value'],
		'color:var(--story-kpi-value,var(--foreground));white-space:nowrap;font-size:min(calc(calc(var(--story-body-size,16px) * 2) * var(--story-type-figure-size,1)),16cqi)',
	],
	[[`${KPI_TILE}:nth-child(4n+1)`], '--story-kpi-wash:var(--chart-1)'],
	[[`${KPI_TILE}:nth-child(4n+2)`], '--story-kpi-wash:var(--chart-2)'],
	[[`${KPI_TILE}:nth-child(4n+3)`], '--story-kpi-wash:var(--chart-3)'],
	[[`${KPI_TILE}:nth-child(4n+4)`], '--story-kpi-wash:var(--chart-4)'],
	[[KPI_TILE], `background:${WASHED_CARD}`],
	[
		[`${KPI_TILE}:first-child`],
		[
			`background:color-mix(in srgb,var(--story-kpi-lead-bg,var(--card)) var(--story-kpi-lead-strength,0%),${WASHED_CARD})`,
			'color:var(--story-kpi-lead-fg,var(--foreground))',
			'--foreground:var(--story-kpi-lead-fg)',
			'--card-foreground:var(--story-kpi-lead-fg)',
			'--muted-foreground:var(--story-kpi-lead-muted)',
			'--story-kpi-value:var(--story-kpi-lead-value)',
		].join(';'),
	],
	[
		['.quarry-button', '.quarry-chip'],
		'display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:0 14px;line-height:1;white-space:nowrap;border-radius:var(--story-control-radius,8px);cursor:pointer;transition:background-color .15s,border-color .15s,color .15s',
	],
	[['.quarry-button'], 'color:var(--primary-foreground);background:var(--primary);border:1px solid var(--primary)'],
	[
		['.quarry-button--outline', '.quarry-chip'],
		'color:var(--foreground);background:var(--card);border:1px solid var(--border)',
	],
	[['.quarry-chip:hover', '.quarry-button--outline:hover'], `background:${INK_VEIL}`],
	[
		['.quarry-chip[aria-pressed=true]', '.quarry-chip[aria-selected=true]', '.quarry-chip--active'],
		'color:var(--primary-foreground);background:var(--primary);border-color:var(--primary)',
	],
	[['.quarry-chips'], 'display:flex;flex-wrap:wrap;align-items:center;gap:8px'],
	/** The markdown story filter bar: a block-shaped panel whose controls take the brand's button shape. */
	[['.quarry-filter-bar'], 'background:var(--card);border-color:var(--border);border-radius:var(--radius)'],
	[
		['.quarry-filter__control', '.quarry-filter__clear'],
		'border-radius:var(--story-control-radius,8px);transition:border-color .15s,background-color .15s',
	],
	[['.quarry-filter__control'], 'background:var(--card);border-color:var(--border)'],
	[
		['.quarry-filter__control:hover', '.quarry-filter__clear:hover'],
		`background:${INK_VEIL};color:var(--foreground)`,
	],
	[['.quarry-filter[data-active=true] .quarry-filter__control'], 'border-color:var(--primary)'],
	/** Pickers mount inside the themed surface, so their menus speak the story's type and lines too. */
	[
		['[data-slot=select-content]', '[data-slot=dropdown-menu-content]', '[data-slot=popover-content]'],
		'font-family:var(--font-sans);border-color:var(--border)',
	],
	/** The same folder tabs markdown stories draw: the active one opens onto the page. */
	[
		['[role=tablist]'],
		'display:flex;align-items:flex-end;gap:4px;padding-top:4px;overflow-x:auto;background:color-mix(in srgb,var(--muted) 30%,transparent);border-bottom:1px solid var(--border)',
	],
	[
		['[role=tab]'],
		'display:inline-flex;align-items:center;height:36px;margin-bottom:-1px;padding:0 12px;white-space:nowrap;color:var(--muted-foreground);background:transparent;border:1px solid transparent;border-bottom:0;border-radius:var(--radius-md,6px) var(--radius-md,6px) 0 0;cursor:pointer;transition:background-color .15s,color .15s',
	],
	[['[role=tab]:hover'], 'color:var(--foreground);background:color-mix(in srgb,var(--background) 50%,transparent)'],
	[
		['[role=tab][aria-selected=true]'],
		'color:var(--foreground);background:var(--background);border-color:var(--border)',
	],
	[
		['.quarry-brand-header'],
		'padding:var(--story-header-padding,4px 0 20px);color:var(--story-header-fg,var(--foreground));background:var(--story-header-bg,transparent);border-bottom:var(--story-header-rule,0);border-radius:var(--story-header-radius,0)',
	],
	[
		['.quarry-brand-header__bar'],
		'display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:32px',
	],
	[['.quarry-brand-header__mark'], 'display:flex;align-items:center;gap:12px;min-width:0'],
	[
		['.quarry-brand-header__logo'],
		'display:block;height:32px;max-width:220px;object-fit:contain;object-position:left center',
	],
	[['.quarry-brand-header__name'], 'line-height:1'],
	[['.quarry-brand-header__meta'], 'display:flex;flex-wrap:wrap;align-items:center;gap:8px'],
];

function roleDeclarations(role: StoryTextRole, size: string | null): string {
	const declarations = [
		`font-family:var(--story-type-${role}-font)`,
		`font-weight:var(--story-type-${role}-weight)`,
		`font-style:var(--story-type-${role}-style)`,
		`text-transform:var(--story-type-${role}-case)`,
		`letter-spacing:var(--story-type-${role}-tracking)`,
	];
	if (size) {
		declarations.push(`font-size:calc(${size} * var(--story-type-${role}-size,1))`);
	}
	return declarations.join(';');
}

function scopeSelectors(selectors: string[], scope: string): string {
	return selectors.map((selector) => `${scope}${selector}`).join(',');
}
