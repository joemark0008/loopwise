/**
 * Saved query tools: a named, parameterized SQL query on the project's warehouse that the agent calls as a tool.
 * Parameters appear in the SQL template as `{{ name }}` and are sent to the warehouse as bind values (`$1`, `$2`…),
 * never pasted into the SQL text.
 */

export const QUERY_TOOL_PARAMETER_TYPES = ['string', 'number', 'integer', 'boolean', 'date'] as const;

export type QueryToolParameterType = (typeof QUERY_TOOL_PARAMETER_TYPES)[number];

export type QueryToolParameterValue = string | number | boolean | null;

export interface QueryToolParameter {
	name: string;
	type: QueryToolParameterType;
	description?: string | null;
	required: boolean;
	/** Used when the caller leaves an optional parameter out. */
	default?: QueryToolParameterValue;
}

/** Agent tool names of saved query tools: `qt_<name>`. */
export const QUERY_TOOL_NAME_PREFIX = 'qt_';

/** Saved tool and parameter names: snake_case, starting with a letter. */
export const QUERY_TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
export const QUERY_TOOL_NAME_MIN_LENGTH = 3;
/** Leaves room for the `qt_` prefix within the 64 characters providers accept for tool names. */
export const QUERY_TOOL_NAME_MAX_LENGTH = 48;
export const QUERY_TOOL_PARAMETER_NAME_MAX_LENGTH = 48;
export const QUERY_TOOL_DESCRIPTION_MAX_LENGTH = 2000;
export const QUERY_TOOL_SQL_MAX_LENGTH = 50_000;
export const QUERY_TOOL_MAX_PARAMETERS = 20;

const PLACEHOLDER_REGEX = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/y;

export function toQueryToolAgentName(name: string): string {
	return `${QUERY_TOOL_NAME_PREFIX}${name}`;
}

export function isQueryToolAgentName(toolName: string): boolean {
	return toolName.startsWith(QUERY_TOOL_NAME_PREFIX) && toolName.length > QUERY_TOOL_NAME_PREFIX.length;
}

export class QueryToolTemplateError extends Error {
	override name = 'QueryToolTemplateError';
}

export interface CompiledQueryToolSql {
	/** The SQL with `$1…$n` in place of the placeholders. */
	sql: string;
	/** Parameter name of each `$n`, in order (`$1` is `order[0]`). */
	order: string[];
}

/** Placeholder names in order of first use, ignoring string literals, quoted identifiers and comments. */
export function extractQueryToolPlaceholders(template: string): string[] {
	const names: string[] = [];
	scanTemplate(template, (name) => {
		if (!names.includes(name)) {
			names.push(name);
		}
		return '';
	});
	return names;
}

/**
 * Replaces each `{{ name }}` with its positional parameter. Every placeholder must be declared and every declared
 * parameter used, so a tool can't silently ignore an argument.
 */
export function compileQueryToolSql(template: string, parameters: readonly QueryToolParameter[]): CompiledQueryToolSql {
	const declared = new Set(parameters.map((parameter) => parameter.name));
	const order: string[] = [];
	const sql = scanTemplate(template, (name) => {
		if (!declared.has(name)) {
			throw new QueryToolTemplateError(`The SQL uses {{ ${name} }}, which is not a declared parameter.`);
		}
		let index = order.indexOf(name);
		if (index === -1) {
			order.push(name);
			index = order.length - 1;
		}
		return `$${index + 1}`;
	});
	const unused = parameters.filter((parameter) => !order.includes(parameter.name));
	if (unused.length > 0) {
		throw new QueryToolTemplateError(
			`Declared parameters not used in the SQL: ${unused.map((parameter) => parameter.name).join(', ')}.`,
		);
	}
	return { sql, order };
}

/** Checks one argument against its parameter's type; `undefined`/`null` falls back to the default. */
export function coerceQueryToolValue(parameter: QueryToolParameter, value: unknown): QueryToolParameterValue {
	if (value === undefined || value === null || value === '') {
		const fallback = parameter.default ?? null;
		if (fallback === null && parameter.required) {
			throw new QueryToolTemplateError(`Parameter "${parameter.name}" is required.`);
		}
		return fallback === null ? null : coerceQueryToolValue({ ...parameter, default: null }, fallback);
	}
	switch (parameter.type) {
		case 'string':
			if (typeof value !== 'string') {
				throw invalidValue(parameter, 'a string');
			}
			return value;
		case 'number': {
			const number = typeof value === 'string' ? Number(value) : value;
			if (typeof number !== 'number' || !Number.isFinite(number)) {
				throw invalidValue(parameter, 'a number');
			}
			return number;
		}
		case 'integer': {
			const number = typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
			if (typeof number !== 'number' || !Number.isSafeInteger(number)) {
				throw invalidValue(parameter, 'an integer');
			}
			return number;
		}
		case 'boolean':
			if (typeof value === 'boolean') {
				return value;
			}
			if (value === 'true' || value === 'false') {
				return value === 'true';
			}
			throw invalidValue(parameter, 'true or false');
		case 'date':
			if (typeof value !== 'string' || !isIsoDate(value)) {
				throw invalidValue(parameter, 'a date as YYYY-MM-DD');
			}
			return value;
	}
}

/** The bind values of a compiled template, in `$n` order. */
export function bindQueryToolValues(
	compiled: CompiledQueryToolSql,
	parameters: readonly QueryToolParameter[],
	args: Record<string, unknown>,
): QueryToolParameterValue[] {
	return compiled.order.map((name) => {
		const parameter = parameters.find((candidate) => candidate.name === name);
		if (!parameter) {
			throw new QueryToolTemplateError(`Unknown parameter "${name}".`);
		}
		return coerceQueryToolValue(parameter, args[name]);
	});
}

/** Problems with a parameter list, empty when it is valid. */
export function validateQueryToolParameters(parameters: readonly QueryToolParameter[]): string[] {
	const problems: string[] = [];
	if (parameters.length > QUERY_TOOL_MAX_PARAMETERS) {
		problems.push(`A tool takes at most ${QUERY_TOOL_MAX_PARAMETERS} parameters.`);
	}
	const seen = new Set<string>();
	for (const parameter of parameters) {
		if (
			!QUERY_TOOL_NAME_PATTERN.test(parameter.name) ||
			parameter.name.length > QUERY_TOOL_PARAMETER_NAME_MAX_LENGTH
		) {
			problems.push(`Parameter "${parameter.name}" must be snake_case, starting with a letter.`);
		}
		if (seen.has(parameter.name)) {
			problems.push(`Parameter "${parameter.name}" is declared twice.`);
		}
		seen.add(parameter.name);
		if (!QUERY_TOOL_PARAMETER_TYPES.includes(parameter.type)) {
			problems.push(`Parameter "${parameter.name}" has an unknown type.`);
			continue;
		}
		if (parameter.default !== undefined && parameter.default !== null) {
			try {
				coerceQueryToolValue({ ...parameter, default: null, required: true }, parameter.default);
			} catch (error) {
				problems.push(`Default of "${parameter.name}": ${(error as Error).message}`);
			}
		}
	}
	return problems;
}

function invalidValue(parameter: QueryToolParameter, expected: string): QueryToolTemplateError {
	return new QueryToolTemplateError(`Parameter "${parameter.name}" must be ${expected}.`);
}

function isIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Walks the template like Postgres' lexer would for the parts that matter here: `'…'` strings (with `''`),
 * `E'…'` escapes, `"…"` identifiers, `$tag$…$tag$` strings, `--` and `/* … *\/` comments. Placeholders inside them
 * are left alone; the others go through `replace`. Hand-written `$1` parameters are rejected: they would clash
 * with the generated ones.
 */
function scanTemplate(template: string, replace: (name: string) => string): string {
	let out = '';
	let i = 0;
	while (i < template.length) {
		const char = template[i];
		const next = template[i + 1];
		if (char === '-' && next === '-') {
			const end = template.indexOf('\n', i);
			const stop = end === -1 ? template.length : end;
			out += template.slice(i, stop);
			i = stop;
			continue;
		}
		if (char === '/' && next === '*') {
			const end = template.indexOf('*/', i + 2);
			const stop = end === -1 ? template.length : end + 2;
			out += template.slice(i, stop);
			i = stop;
			continue;
		}
		if (char === "'" || char === '"') {
			const escapes = char === "'" && /[eE]/.test(template[i - 1] ?? '');
			let j = i + 1;
			while (j < template.length) {
				if (escapes && template[j] === '\\') {
					j += 2;
					continue;
				}
				if (template[j] === char) {
					if (template[j + 1] === char) {
						j += 2;
						continue;
					}
					break;
				}
				j += 1;
			}
			const stop = Math.min(j + 1, template.length);
			out += template.slice(i, stop);
			i = stop;
			continue;
		}
		if (char === '$' && /\d/.test(next ?? '') && !/[A-Za-z0-9_]/.test(template[i - 1] ?? '')) {
			throw new QueryToolTemplateError('Use {{ name }} placeholders instead of positional parameters like $1.');
		}
		if (char === '$') {
			const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(template.slice(i));
			if (tag) {
				const end = template.indexOf(tag[0], i + tag[0].length);
				const stop = end === -1 ? template.length : end + tag[0].length;
				out += template.slice(i, stop);
				i = stop;
				continue;
			}
		}
		if (char === '{' && next === '{') {
			PLACEHOLDER_REGEX.lastIndex = i;
			const match = PLACEHOLDER_REGEX.exec(template);
			if (match) {
				out += replace(match[1]);
				i += match[0].length;
				continue;
			}
		}
		out += char;
		i += 1;
	}
	return out;
}
