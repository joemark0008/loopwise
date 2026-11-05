/**
 * @maplibre/geojson-vt 6.3.0 ships declarations that import its `../src/*.ts` sources, which `skipLibCheck` does not
 * cover, so they fail under `strict`. maplibre-gl only imports `GeoJSONVTOptions` from it, and the app never imports
 * the package itself; tsconfig `paths` points the package here. Remove once a fixed release is out.
 */
export type GeoJSONVTOptions = Record<string, unknown>;
