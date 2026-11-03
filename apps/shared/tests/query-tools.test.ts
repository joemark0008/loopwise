import { describe, expect, it } from 'vitest';

import {
	bindQueryToolValues,
	coerceQueryToolValue,
	compileQueryToolSql,
	extractQueryToolPlaceholders,
	isQueryToolAgentName,
	type QueryToolParameter,
	QueryToolTemplateError,
	toQueryToolAgentName,
	validateQueryToolParameters,
} from '../src/query-tools';

const status: QueryToolParameter = { name: 'status', type: 'string', required: true };
const since: QueryToolParameter = { name: 'since', type: 'date', required: false, default: '2018-01-01' };

describe('compileQueryToolSql', () => {
	it('replaces placeholders with positional parameters, reusing the index of a repeated name', () => {
		const compiled = compileQueryToolSql(
			'SELECT * FROM orders WHERE status = {{ status }} AND order_date >= {{since}} OR status = {{ status }}',
			[status, since],
		);
		expect(compiled).toEqual({
			sql: 'SELECT * FROM orders WHERE status = $1 AND order_date >= $2 OR status = $1',
			order: ['status', 'since'],
		});
	});

	it('leaves placeholders inside strings, quoted identifiers and comments alone', () => {
		const template = [
			'SELECT \'{{ status }}\' AS a, "{{ status }}" AS b, $$ {{ status }} $$ AS c, $x$ {{ status }} $x$ AS d',
			'-- {{ status }}',
			'/* {{ status }} */',
			"FROM orders WHERE status = {{ status }} AND note = 'it''s {{ status }}'",
		].join('\n');
		const compiled = compileQueryToolSql(template, [status]);
		expect(compiled.order).toEqual(['status']);
		expect(compiled.sql.match(/\$1/g)).toHaveLength(1);
		expect(compiled.sql).toContain("'{{ status }}' AS a");
		expect(compiled.sql).toContain("'it''s {{ status }}'");
	});

	it('rejects undeclared placeholders and unused parameters', () => {
		expect(() => compileQueryToolSql('SELECT {{ other }}', [])).toThrow(QueryToolTemplateError);
		expect(() => compileQueryToolSql('SELECT 1', [status])).toThrow(/not used/);
	});

	it('rejects hand-written positional parameters', () => {
		expect(() => compileQueryToolSql('SELECT * FROM t WHERE a = $1', [])).toThrow(/positional/);
		expect(compileQueryToolSql('SELECT a$1 FROM t', []).sql).toBe('SELECT a$1 FROM t');
	});
});

describe('extractQueryToolPlaceholders', () => {
	it('lists names in order of first use', () => {
		expect(extractQueryToolPlaceholders("SELECT {{ b }}, {{a}}, {{ b }}, '{{ c }}'")).toEqual(['b', 'a']);
	});
});

describe('coerceQueryToolValue', () => {
	it('checks types', () => {
		expect(coerceQueryToolValue({ name: 'n', type: 'number', required: true }, '1.5')).toBe(1.5);
		expect(coerceQueryToolValue({ name: 'n', type: 'integer', required: true }, '42')).toBe(42);
		expect(() => coerceQueryToolValue({ name: 'n', type: 'integer', required: true }, 1.5)).toThrow();
		expect(coerceQueryToolValue({ name: 'b', type: 'boolean', required: true }, 'false')).toBe(false);
		expect(() => coerceQueryToolValue({ name: 'd', type: 'date', required: true }, '2018-02-30')).toThrow();
		expect(() => coerceQueryToolValue(status, 3)).toThrow(/string/);
	});

	it('uses defaults for missing optional values and rejects missing required ones', () => {
		expect(coerceQueryToolValue(since, undefined)).toBe('2018-01-01');
		expect(coerceQueryToolValue({ name: 'x', type: 'string', required: false }, undefined)).toBeNull();
		expect(() => coerceQueryToolValue(status, undefined)).toThrow(/required/);
	});

	it('keeps injection attempts as plain values', () => {
		const value = "x'; DROP TABLE orders; --";
		const compiled = compileQueryToolSql('SELECT * FROM orders WHERE status = {{ status }}', [status]);
		expect(bindQueryToolValues(compiled, [status], { status: value })).toEqual([value]);
		expect(compiled.sql).not.toContain('DROP');
	});
});

describe('validateQueryToolParameters', () => {
	it('reports bad names, duplicates and defaults', () => {
		expect(validateQueryToolParameters([status, since])).toEqual([]);
		expect(
			validateQueryToolParameters([
				{ name: 'Bad-Name', type: 'string', required: true },
				status,
				status,
				{ name: 'limit_rows', type: 'integer', required: false, default: 'ten' },
			]),
		).toHaveLength(3);
	});
});

describe('agent tool names', () => {
	it('prefixes saved tool names', () => {
		expect(toQueryToolAgentName('orders_by_status')).toBe('qt_orders_by_status');
		expect(isQueryToolAgentName('qt_orders_by_status')).toBe(true);
		expect(isQueryToolAgentName('execute_sql')).toBe(false);
	});
});
