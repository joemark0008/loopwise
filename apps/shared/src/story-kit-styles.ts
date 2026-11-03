import {
	STORY_FRAME_CONTAINER,
	STORY_PRINT_CANVAS_ATTRIBUTE,
	STORY_PRINT_SLIDES_ATTRIBUTE,
	STORY_SLIDE_SIZE,
} from './story-app';
import { storyBrandStyles } from './story-theme-brand-styles';

/** Loaded by the frame document before the story's own CSS, so `app.css` overrides it and hand-rolled */
export const KIT_STYLES = `
.quarry-block{--background:var(--card);display:flex;flex-direction:column;gap:12px;min-width:0;padding:16px 20px;background:var(--card);color:var(--card-foreground);border:var(--story-block-border-width) solid var(--border);border-radius:var(--story-block-radius)}
.quarry-block .quarry-block{padding:0;background:transparent;border:0;border-radius:0}
.quarry-block__header{display:flex;align-items:flex-start;gap:8px}
.quarry-block__heading{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.quarry-block__actions{display:flex;align-items:center;gap:2px;flex-shrink:0}
.quarry-block__action{position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;width:22px;height:22px;padding:0;color:var(--muted-foreground);background:transparent;border:0;border-radius:999px;cursor:pointer}
.quarry-block__action[data-tooltip]:hover::after,.quarry-block__action[data-tooltip]:focus-visible::after{content:attr(data-tooltip);position:absolute;top:calc(100% + 6px);right:0;z-index:20;width:max-content;max-width:240px;padding:6px 10px;font-family:var(--font-sans);font-size:12px;font-weight:400;line-height:1.4;text-align:left;white-space:normal;color:var(--foreground);background:var(--background);border:1px solid color-mix(in srgb, var(--border) 50%, transparent);border-radius:var(--radius-sm);box-shadow:0 20px 25px -5px rgb(0 0 0 / .1),0 8px 10px -6px rgb(0 0 0 / .1);pointer-events:none}
.quarry-block__action svg{width:13px;height:13px}
.quarry-block__action[aria-pressed=true]{background:color-mix(in srgb, var(--muted-foreground) 14%, transparent);color:var(--foreground)}
.quarry-block__action:hover{background:color-mix(in srgb, var(--muted-foreground) 14%, transparent);color:var(--foreground)}
.quarry-sql{margin:0;max-height:320px;overflow:auto;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;white-space:pre;color:var(--foreground);background:color-mix(in srgb, var(--muted) 50%, transparent);border:1px solid var(--border);border-radius:var(--radius-sm)}
.quarry-sql__keyword{color:var(--story-accent-text,var(--primary));font-weight:600}
.quarry-sql__string{color:var(--chart-2)}
.quarry-sql__number{color:var(--chart-3)}
.quarry-sql__comment{color:var(--muted-foreground);font-style:italic}
.quarry-block__title{margin:0;font-family:var(--font-heading);font-size:14px;font-weight:600;line-height:1.3;color:var(--foreground)}
.quarry-block__description{margin:0;font-size:12px;line-height:1.4;color:var(--muted-foreground)}
.quarry-block__body{min-width:0;flex:1}
.quarry-block__state{display:flex;align-items:center;justify-content:center;min-height:96px;padding:12px;font-size:12px;color:var(--muted-foreground);text-align:center}
.quarry-block__state--error{color:#b91c1c}
.quarry-block__state button{margin-left:8px;padding:2px 8px;font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:var(--radius-sm);cursor:pointer}
.quarry-skeleton{width:100%;height:100%;min-height:96px;border-radius:var(--radius-sm);background:linear-gradient(90deg,var(--muted) 25%,var(--card) 50%,var(--muted) 75%);background-size:200% 100%;animation:quarry-shimmer 1.4s ease-in-out infinite}
@keyframes quarry-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.quarry-narrative--loading{color:transparent;border-radius:var(--radius-sm);-webkit-box-decoration-break:clone;box-decoration-break:clone;background:linear-gradient(90deg,var(--muted) 25%,var(--card) 50%,var(--muted) 75%);background-size:200% 100%;animation:quarry-shimmer 1.4s ease-in-out infinite}

.quarry-block{break-inside:avoid}

.quarry-slides{display:flex;flex-direction:column;gap:12px;height:100vh;padding:16px;box-sizing:border-box;background:var(--story-stage)}
.quarry-slides__top{display:flex;align-items:flex-start;gap:16px}
.quarry-slides__brand{display:flex;align-items:center;flex:none;min-height:28px}
.quarry-slides__brand .quarry-brand-header__logo{height:24px;max-width:180px}
.quarry-slides__header{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.quarry-slides__eyebrow,.quarry-slide__eyebrow{font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--story-accent-text,var(--primary))}
.quarry-slides__title{margin:0;font-family:var(--font-heading);font-size:clamp(28px,4vw,48px);line-height:1.05;letter-spacing:-.04em;color:var(--foreground)}
.quarry-slides__toolbar{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-left:auto;flex-shrink:0}
.quarry-slides__pager{display:flex;align-items:center;gap:2px}
.quarry-slides__counter{padding:0 6px;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted-foreground)}
.quarry-slides__control{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;color:var(--muted-foreground);background:transparent;border:0;border-radius:999px;cursor:pointer}
.quarry-slides__control svg{width:16px;height:16px}
.quarry-slides__control:hover:not(:disabled){color:var(--foreground);background:color-mix(in srgb, var(--muted-foreground) 14%, transparent)}
.quarry-slides__control:disabled{opacity:.35;cursor:default}
.quarry-slides__stage{display:flex;flex:1;align-items:center;justify-content:center;min-height:0}
.quarry-slides__viewport{position:relative;flex:none;overflow:hidden;border:1px solid var(--border);box-sizing:content-box}
.quarry-slide{container:${STORY_FRAME_CONTAINER} / size;position:relative;display:flex;flex-direction:column;gap:24px;width:${STORY_SLIDE_SIZE.width}px;height:${STORY_SLIDE_SIZE.height}px;padding:48px 56px;overflow:hidden;box-sizing:border-box;color:var(--foreground);background:radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 10%, transparent), transparent 40%),color-mix(in srgb, var(--background) 94%, var(--foreground) 3%)}
.quarry-slides__viewport>.quarry-slide{transform:scale(var(--quarry-slide-scale));transform-origin:top left;will-change:transform}
.quarry-slide__heading{display:flex;flex-direction:column;gap:8px;flex:none}
html:has(.quarry-slides) .quarry-brand-header{display:none}
.quarry-slide__title{margin:0;max-width:980px;font-family:var(--font-heading);font-size:52px;line-height:1;letter-spacing:-.04em;color:var(--foreground)}
.quarry-slide .quarry-block{min-height:0;max-height:100%}
.quarry-slide .quarry-block__body{display:flex;flex-direction:column;min-height:0}
.quarry-slide .quarry-chart{flex:0 1 auto;min-height:0}
.quarry-slides--fullscreen{position:fixed;inset:0;z-index:50;gap:0;padding:0;background:transparent}
.quarry-slides--fullscreen::backdrop{background:transparent}
html:has(.quarry-slides--fullscreen) body{background:transparent}
.quarry-slides--fullscreen .quarry-slides__header,.quarry-slides--fullscreen .quarry-slides__brand{display:none}
.quarry-slides--fullscreen .quarry-slides__viewport{border:0}
.quarry-slides--fullscreen .quarry-slides__toolbar{position:absolute;top:0;right:0;z-index:1;padding:20px 24px;transition:opacity .25s ease}
.quarry-slides--fullscreen[data-idle]{cursor:none}
.quarry-slides--fullscreen[data-idle] .quarry-slides__toolbar:not(:hover):not(:focus-within){opacity:0;pointer-events:none}
.quarry-slides--fullscreen .quarry-slides__pager,.quarry-slides--fullscreen .quarry-slides__control{background:var(--story-stage);border:1px solid var(--border);border-radius:999px}
.quarry-slides--fullscreen .quarry-slides__toolbar>.quarry-slides__control:hover:not(:disabled){background:color-mix(in srgb, var(--muted-foreground) 14%, var(--story-stage));color:var(--foreground)}
.quarry-slides--fullscreen .quarry-slides__pager .quarry-slides__control{background:transparent;border:0}
.quarry-slides--fullscreen .quarry-slides__pager .quarry-slides__control:hover:not(:disabled){background:color-mix(in srgb, var(--muted-foreground) 14%, transparent)}
.quarry-canvas{display:flex;align-items:flex-start;justify-content:center;height:100vh;overflow:hidden;box-sizing:border-box}
.quarry-canvas__viewport{position:relative;flex:none;overflow:hidden;box-sizing:content-box}
.quarry-canvas__surface{container:${STORY_FRAME_CONTAINER} / size;position:relative;overflow:hidden;box-sizing:border-box;background:var(--background);transform:scale(var(--quarry-canvas-scale));transform-origin:top left}
.quarry-canvas--print{display:block;height:auto;overflow:visible}
.quarry-canvas--print .quarry-canvas__surface{transform:none;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html[${STORY_PRINT_CANVAS_ATTRIBUTE}] #root{display:none}
.quarry-slides--print{display:block;height:auto;padding:0;background:none}
.quarry-slides--print .quarry-slide{break-after:page;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.quarry-slides--print .quarry-slide:last-child{break-after:auto}
html[${STORY_PRINT_SLIDES_ATTRIBUTE}] #root{display:none}

.quarry-kpi-card{min-width:160px}
.quarry-kpi-card__value{font-family:var(--font-heading);font-size:calc(var(--story-body-size) * 2);font-weight:500;line-height:1.1;letter-spacing:var(--story-heading-tracking);font-variant-numeric:tabular-nums;color:var(--foreground)}
.quarry-kpi-card__comparison{display:flex;align-items:center;gap:6px;margin-top:6px;white-space:nowrap;font-size:14px;color:var(--muted-foreground)}
.quarry-kpi-card__comparison svg{flex:none}
.quarry-kpi-card__comparison--up{color:#16a34a}
.quarry-kpi-card__comparison--down{color:#dc2626}
.quarry-kpi-card__comparison-value{font-weight:500;font-variant-numeric:tabular-nums}

.quarry-chart{position:relative;width:100%;font-size:12px}
.quarry-chart .recharts-cartesian-axis-tick text{fill:var(--muted-foreground)}
.quarry-chart .recharts-cartesian-grid line{stroke:var(--chart-grid, var(--border))}
.quarry-chart .recharts-rectangle.recharts-tooltip-cursor{fill:var(--muted);opacity:.5}
.quarry-chart .recharts-curve.recharts-tooltip-cursor{stroke:var(--border)}
.quarry-chart .recharts-dot[stroke='#fff']{stroke:transparent}
.quarry-chart .recharts-surface,.quarry-chart .recharts-layer{outline:none}
.quarry-chart-tooltip,.recharts-default-tooltip{display:grid;min-width:8rem;align-items:start;gap:6px;padding:6px 10px!important;font-size:12px;background:var(--background)!important;color:var(--foreground);border:1px solid color-mix(in srgb, var(--border) 50%, transparent)!important;border-radius:var(--radius-sm);box-shadow:0 20px 25px -5px rgb(0 0 0 / .1),0 8px 10px -6px rgb(0 0 0 / .1)}
.recharts-default-tooltip .recharts-tooltip-label{margin:0!important;font-weight:500;color:var(--foreground)}
.recharts-default-tooltip .recharts-tooltip-label:empty{display:none}
.recharts-default-tooltip .recharts-tooltip-item-list{display:grid;gap:6px}
.recharts-default-tooltip .recharts-tooltip-item{display:flex!important;align-items:center;gap:8px;padding:0!important;line-height:1}
.recharts-default-tooltip .recharts-tooltip-item::before{content:'';flex:none;width:10px;height:10px;border-radius:2px;background:currentColor}
/* Recharts falls back to black when a series has no colour (e.g. scatter axes): no swatch then. */
.recharts-default-tooltip .recharts-tooltip-item[style*='rgb(0, 0, 0)']::before{display:none}
.recharts-default-tooltip .recharts-tooltip-item-name{color:var(--muted-foreground)}
.recharts-default-tooltip .recharts-tooltip-item-separator{display:none}
.recharts-default-tooltip .recharts-tooltip-item-value{margin-left:auto;font-family:ui-monospace,monospace;font-weight:500;font-variant-numeric:tabular-nums;color:var(--foreground)}
.recharts-default-tooltip .recharts-tooltip-item-unit{color:var(--foreground)}
.quarry-chart-tooltip__label{font-weight:500}
.quarry-chart-tooltip__items{display:grid;gap:6px}
.quarry-chart-tooltip__item{display:flex;width:100%;flex-wrap:wrap;align-items:center;gap:8px}
.quarry-chart-tooltip__indicator{flex:none;border-radius:2px;background:var(--color-bg);border-color:var(--color-border)}
.quarry-chart-tooltip__indicator--dot{width:10px;height:10px}
.quarry-chart-tooltip__indicator--line{width:4px;align-self:stretch}
.quarry-chart-tooltip__indicator--dashed{width:0;align-self:stretch;background:transparent;border:1.5px dashed var(--color-border)}
.quarry-chart-tooltip__row{display:flex;flex:1;align-items:center;justify-content:space-between;gap:8px;line-height:1}
.quarry-chart-tooltip__name{color:var(--muted-foreground)}
.quarry-chart-tooltip__value{font-family:ui-monospace,monospace;font-weight:500;font-variant-numeric:tabular-nums;color:var(--foreground)}
.quarry-chart-tooltip__total{display:flex;width:100%;align-items:center;gap:8px;margin-top:2px;padding-top:6px;border-top:1px solid color-mix(in srgb, var(--border) 50%, transparent)}
.quarry-chart-tooltip__total .quarry-chart-tooltip__name{font-weight:500}
.quarry-chart-legend{display:flex;flex-wrap:wrap;width:100%;align-items:center;justify-content:center;gap:6px 16px;padding-top:12px}
.quarry-chart-legend__item{display:flex;flex:none;align-items:center;gap:6px;white-space:nowrap;color:var(--muted-foreground);user-select:none}
.quarry-chart-legend__item--clickable{cursor:pointer}
.quarry-chart-legend__item--clickable:hover{color:var(--foreground)}
.quarry-chart-legend__item--hidden{opacity:.4}
.quarry-chart-legend__swatch{width:8px;height:8px;flex:none;border-radius:2px}

.quarry-map{position:relative;width:100%;height:360px;overflow:hidden;isolation:isolate;border-radius:var(--radius-sm);background:var(--muted)}
.quarry-map .leaflet-container{width:100%;height:100%;font-family:var(--font-sans);font-size:12px;background:var(--muted)}
.quarry-map .leaflet-control-zoom a{color:var(--foreground);background:var(--card);border-color:var(--border)}
.quarry-map .leaflet-control-zoom a:hover{color:var(--foreground);background:var(--accent)}
.quarry-map .leaflet-bar{border:1px solid var(--border);box-shadow:0 4px 12px rgb(0 0 0 / .08)}
.quarry-map .leaflet-control-attribution{font-size:10px;color:var(--muted-foreground);background:color-mix(in srgb, var(--background) 80%, transparent)}
.quarry-map .leaflet-control-attribution a{color:inherit}
.quarry-map .leaflet-popup-content-wrapper,.quarry-map .leaflet-popup-tip{color:var(--popover-foreground);background:var(--popover);box-shadow:0 20px 25px -5px rgb(0 0 0 / .1),0 8px 10px -6px rgb(0 0 0 / .1)}
.quarry-map .leaflet-popup-content-wrapper{border:1px solid color-mix(in srgb, var(--border) 50%, transparent);border-radius:var(--radius-sm)}
.quarry-map .leaflet-popup-content{margin:8px 12px;font-size:12px;line-height:1.5}
.quarry-map .leaflet-tooltip{padding:6px 10px;font-size:12px;color:var(--foreground);background:var(--background);border:1px solid color-mix(in srgb, var(--border) 50%, transparent);border-radius:var(--radius-sm);box-shadow:0 8px 10px -6px rgb(0 0 0 / .1)}
.quarry-map .leaflet-tooltip-top::before{border-top-color:var(--background)}
.quarry-map .leaflet-tooltip-bottom::before{border-bottom-color:var(--background)}
.quarry-map .leaflet-tooltip-left::before{border-left-color:var(--background)}
.quarry-map .leaflet-tooltip-right::before{border-right-color:var(--background)}
.quarry-map__tooltip{display:grid;gap:2px;line-height:1.4}
.quarry-map__tooltip strong{font-weight:500}

.quarry-table-wrap{display:flex;flex-direction:column;gap:8px;min-width:0}
.quarry-table{min-width:0}
.quarry-table-display{display:flex;flex-direction:column;min-height:0}
.quarry-table-display__scroll{min-height:0;max-height:var(--quarry-table-max-height, none);overflow:auto;background:var(--story-table-bg, var(--background));border-top:1px solid var(--border)}
.quarry-table-display table{width:100%;min-width:max-content;border-collapse:collapse;font-size:12px}
.quarry-table-display thead{position:sticky;top:0;z-index:10;background:var(--story-table-header-bg, var(--panel));border-bottom:var(--story-table-border-width, 1px) solid var(--story-table-border, var(--border))}
.quarry-table-display th{padding:8px 12px;text-align:left;font-weight:500;white-space:nowrap;color:var(--story-table-header-fg, var(--foreground));box-shadow:inset -1px 0 0 0 var(--border)}
.quarry-table-display th:last-child,.quarry-table-display td:last-child{box-shadow:none}
.quarry-table-display th button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:0;font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.quarry-table-display th.quarry-table-display__numeric span:first-child{margin-left:auto}
.quarry-table-display td{padding:4px 12px;vertical-align:top;font-family:ui-monospace,monospace;font-size:11px;line-height:20px;white-space:nowrap;color:var(--story-body-color, var(--foreground));box-shadow:inset -1px 0 0 0 var(--border)}
.quarry-table-display tbody tr{background:var(--story-table-bg, var(--background));border-bottom:1px solid color-mix(in srgb, var(--story-table-border, var(--border)) 50%, transparent)}
.quarry-table-display tbody tr:last-child{border-bottom:0}
.quarry-table-display tbody tr:hover{background:color-mix(in srgb, var(--accent) 30%, var(--story-table-bg, var(--background)))}
.quarry-table-display__numeric{text-align:right;font-variant-numeric:tabular-nums}
th.quarry-table-display__index,td.quarry-table-display__index{width:16px;text-align:center;background:var(--story-table-header-bg, var(--panel))}
td.quarry-table-display__index span{padding:0 4px;font-weight:500;color:var(--foreground)}
.quarry-table-display__null{font-style:italic;color:color-mix(in srgb, var(--muted-foreground) 60%, transparent)}
.quarry-table-display__sort{display:inline-flex;flex:none;flex-direction:column}
.quarry-table-display__sort svg{width:12px;height:12px;margin:-2px 0;color:color-mix(in srgb, var(--muted-foreground) 50%, transparent)}
.quarry-table-display__sort svg.quarry-table-display__sort--active{color:var(--foreground)}
.quarry-table-display__empty{padding:24px 12px;text-align:center;font-size:14px;color:var(--muted-foreground)}
.quarry-table-display__row-count{display:flex;padding:8px 16px;font-size:12px;color:var(--muted-foreground);border-top:1px solid var(--border)}
.quarry-table__footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 16px;font-size:12px;color:var(--muted-foreground);border-top:1px solid var(--border)}
.quarry-table__pager{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.quarry-table__page-size{display:flex;align-items:center;gap:6px}
.quarry-table__page-size select{height:24px;font:inherit;font-size:12px;color:inherit;background:transparent;border:0;border-radius:var(--radius-sm);padding:0 4px;cursor:pointer}
.quarry-table__page-size select:hover{color:var(--foreground)}
.quarry-table__pager-buttons{display:flex;align-items:center;gap:2px}
.quarry-table__pager-buttons button{display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;color:inherit;background:transparent;border:0;border-radius:999px;cursor:pointer}
.quarry-table__pager-buttons button svg{width:14px;height:14px}
.quarry-table__pager-buttons button:hover:not(:disabled){background:color-mix(in srgb, var(--muted-foreground) 12%, transparent)}
.quarry-table__pager-buttons button:disabled{opacity:.35;cursor:default}
.quarry-table__toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}
.quarry-table__actions{display:flex;align-items:center;gap:2px}
.quarry-table__actions button{display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;color:var(--muted-foreground);background:transparent;border:0;border-radius:999px;cursor:pointer}
.quarry-table__actions button svg{width:13px;height:13px}
.quarry-table__actions button:hover{background:color-mix(in srgb, var(--muted-foreground) 14%, transparent);color:var(--foreground)}
.quarry-table__export{position:relative}
.quarry-table__export-menu{position:absolute;top:calc(100% + 4px);right:0;z-index:20;display:flex;flex-direction:column;min-width:140px;padding:4px;background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 8px 24px rgb(0 0 0 / .12)}
.quarry-table__export-menu button{width:100%;padding:6px 8px;font:inherit;font-size:12px;text-align:left;color:inherit;background:transparent;border:0;border-radius:var(--radius-sm);cursor:pointer}
.quarry-table__export-menu button:hover{background:var(--accent)}
.quarry-table__overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:24px;background:rgb(0 0 0 / .45)}
.quarry-table__overlay-card{display:flex;flex-direction:column;gap:8px;width:100%;max-width:min(95vw,72rem);max-height:90vh;padding:16px;background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:0 20px 50px rgb(0 0 0 / .25)}
.quarry-table__overlay-card .quarry-table{--quarry-table-max-height:calc(90vh - 120px)}
.quarry-table__overlay-close{display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;color:var(--muted-foreground);background:transparent;border:0;border-radius:999px;cursor:pointer}
.quarry-table__overlay-close:hover{background:color-mix(in srgb, var(--muted-foreground) 14%, transparent);color:var(--foreground)}
.quarry-table__overlay-close svg{width:14px;height:14px}
${storyBrandStyles()}
`;
