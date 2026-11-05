import { parse } from 'libpg-query';

/** The views Wise may read (section 5 of migration 0001_rls_and_triggers); keep in step with it. */
export const ANALYTICS_VIEWS = [
	'patients',
	'encounters',
	'vitals',
	'diagnoses',
	'allergies',
	'prescriptions',
	'prescription_items',
	'orders',
	'results',
	'invoices',
	'invoice_lines',
] as const;

/** Plain functions: aggregates, windows, maths, text, dates. Nothing that reads settings, files, catalogs or sleeps. */
const FUNCTIONS = new Set([
	// aggregates
	'count',
	'sum',
	'avg',
	'min',
	'max',
	'stddev',
	'stddev_samp',
	'stddev_pop',
	'variance',
	'var_samp',
	'var_pop',
	'percentile_cont',
	'percentile_disc',
	'mode',
	'string_agg',
	'array_agg',
	'bool_and',
	'bool_or',
	'every',
	'corr',
	// windows
	'row_number',
	'rank',
	'dense_rank',
	'ntile',
	'lag',
	'lead',
	'first_value',
	'last_value',
	'nth_value',
	'cume_dist',
	'percent_rank',
	// maths
	'round',
	'floor',
	'ceil',
	'ceiling',
	'abs',
	'trunc',
	'sign',
	'power',
	'sqrt',
	'exp',
	'ln',
	'log',
	'mod',
	'div',
	'width_bucket',
	'greatest',
	'least',
	// text
	'lower',
	'upper',
	'initcap',
	'trim',
	'btrim',
	'ltrim',
	'rtrim',
	'length',
	'char_length',
	'substring',
	'substr',
	'left',
	'right',
	'position',
	'strpos',
	'replace',
	'concat',
	'concat_ws',
	'split_part',
	'lpad',
	'rpad',
	'starts_with',
	'to_char',
	'to_number',
	// dates
	'date_trunc',
	'date_part',
	'extract',
	'age',
	'now',
	'make_date',
	'make_interval',
	'justify_interval',
	'date_bin',
	'to_date',
	'to_timestamp',
	'timezone',
	'generate_series',
	'isfinite',
	// arrays
	'array_length',
	'cardinality',
	'unnest',
	// analytics schema
	'icd10_chapter',
]);

/** Casts to plain types only: a cast to regclass / regproc would read the catalogs. */
const TYPES = new Set([
	'int',
	'int2',
	'int4',
	'int8',
	'integer',
	'smallint',
	'bigint',
	'numeric',
	'decimal',
	'float4',
	'float8',
	'real',
	'double precision',
	'text',
	'varchar',
	'bpchar',
	'char',
	'date',
	'timestamp',
	'timestamptz',
	'interval',
	'bool',
	'boolean',
	'time',
]);

const SYSTEM_COLUMNS = new Set(['ctid', 'xmin', 'xmax', 'cmin', 'cmax', 'tableoid']);
const DATE_VALUE_FUNCTIONS = new Set([
	'SVFOP_CURRENT_DATE',
	'SVFOP_CURRENT_TIMESTAMP',
	'SVFOP_CURRENT_TIMESTAMP_N',
	'SVFOP_LOCALTIMESTAMP',
	'SVFOP_LOCALTIMESTAMP_N',
]);

export class SqlRejected extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SqlRejected';
	}
}

/**
 * Checks Wise's SQL with the real Postgres parser before it runs: one SELECT over the analytics views, plain
 * functions and casts only. The database enforces the same (role, views, read-only), so this is the first of two
 * locks; its job is to fail early with a message the model can act on. Returns the SQL without trailing `;`.
 */
export async function validateAnalyticsSql(sql: string, opts: { allowParams?: boolean } = {}): Promise<string> {
	const text = sql.trim().replace(/;+\s*$/, '');
	if (!text) {
		throw new SqlRejected('The query is empty.');
	}
	let tree: { stmts?: { stmt: Record<string, unknown> }[] };
	try {
		tree = (await parse(text)) as unknown as typeof tree;
	} catch (error) {
		throw new SqlRejected(`The query does not parse: ${(error as Error).message}`);
	}
	const statements = tree.stmts ?? [];
	if (statements.length !== 1) {
		throw new SqlRejected('Send exactly one SELECT statement.');
	}
	const [kind] = Object.keys(statements[0].stmt);
	if (kind !== 'SelectStmt') {
		throw new SqlRejected(`Only SELECT is allowed (got ${kind.replace(/Stmt$/, '').toUpperCase()}).`);
	}
	const ctes = new Set<string>();
	collectCtes(statements[0].stmt, ctes);
	walk(statements[0].stmt, ctes, opts);
	return text;
}

function collectCtes(node: unknown, ctes: Set<string>): void {
	if (Array.isArray(node)) {
		node.forEach((child) => collectCtes(child, ctes));
	} else if (node && typeof node === 'object') {
		for (const [key, value] of Object.entries(node)) {
			if (key === 'CommonTableExpr') {
				ctes.add(String((value as { ctename: string }).ctename).toLowerCase());
			}
			collectCtes(value, ctes);
		}
	}
}

function walk(node: unknown, ctes: Set<string>, opts: { allowParams?: boolean }): void {
	if (Array.isArray(node)) {
		node.forEach((child) => walk(child, ctes, opts));
		return;
	}
	if (!node || typeof node !== 'object') {
		return;
	}
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		if (key.endsWith('Stmt') && key !== 'SelectStmt') {
			throw new SqlRejected(`Only SELECT is allowed (found ${key.replace(/Stmt$/, '').toUpperCase()}).`);
		}
		switch (key) {
			case 'intoClause':
				throw new SqlRejected('SELECT INTO is not allowed.');
			case 'lockingClause':
				throw new SqlRejected('FOR UPDATE / FOR SHARE is not allowed.');
			case 'RangeTableSample':
				throw new SqlRejected('TABLESAMPLE is not allowed.');
			case 'ParamRef':
				if (!opts.allowParams) {
					throw new SqlRejected('Write values into the query; $n parameters are not supported.');
				}
				break;
			case 'RangeVar':
				checkRelation(value as { schemaname?: string; relname: string }, ctes);
				break;
			case 'FuncCall':
				checkFunction(value as { funcname: { String: { sval: string } }[] });
				break;
			case 'TypeCast':
				checkType((value as { typeName: { names: { String: { sval: string } }[] } }).typeName);
				break;
			case 'ColumnRef':
				checkColumn(value as { fields: { String?: { sval: string } }[] });
				break;
			case 'SQLValueFunction': {
				const op = (value as { op: string }).op;
				if (!DATE_VALUE_FUNCTIONS.has(op)) {
					throw new SqlRejected('Only CURRENT_DATE, CURRENT_TIMESTAMP and LOCALTIMESTAMP are allowed.');
				}
				break;
			}
		}
		walk(value, ctes, opts);
	}
}

function checkRelation(relation: { schemaname?: string; relname: string; catalogname?: string }, ctes: Set<string>) {
	const name = relation.relname.toLowerCase();
	if (relation.catalogname || (relation.schemaname && relation.schemaname.toLowerCase() !== 'analytics')) {
		throw new SqlRejected(
			`Only the analytics views can be read (not ${[relation.schemaname, relation.relname].join('.')}).`,
		);
	}
	if (!relation.schemaname && ctes.has(name)) {
		return;
	}
	if (!(ANALYTICS_VIEWS as readonly string[]).includes(name)) {
		throw new SqlRejected(`Unknown view "${relation.relname}". Views: ${ANALYTICS_VIEWS.join(', ')}.`);
	}
}

function checkFunction(call: { funcname: { String: { sval: string } }[] }) {
	const parts = call.funcname.map((part) => part.String.sval.toLowerCase());
	const name = parts[parts.length - 1];
	const schema = parts.length > 1 ? parts[0] : null;
	const schemaOk = !schema || schema === 'pg_catalog' || (schema === 'analytics' && name === 'icd10_chapter');
	if (!schemaOk || !FUNCTIONS.has(name)) {
		throw new SqlRejected(`Function ${parts.join('.')}() is not allowed.`);
	}
}

function checkType(typeName: { names: { String: { sval: string } }[] }) {
	const parts = typeName.names.map((part) => part.String.sval.toLowerCase());
	const name = parts[parts.length - 1];
	if ((parts.length > 1 && parts[0] !== 'pg_catalog') || !TYPES.has(name)) {
		throw new SqlRejected(`Cast to ${parts.join('.')} is not allowed.`);
	}
}

function checkColumn(ref: { fields: { String?: { sval: string } }[] }) {
	for (const field of ref.fields) {
		if (field.String && SYSTEM_COLUMNS.has(field.String.sval.toLowerCase())) {
			throw new SqlRejected(`System column ${field.String.sval} is not allowed.`);
		}
	}
}
