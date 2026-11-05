import {
	Block,
	Bold,
	Code,
	CodeBlock,
	Italic,
	List,
	ListItem,
	renderToMarkdown,
	Span,
	Title,
} from '../markdown/index.js';
import type { InternalSkill } from './types.js';

export const excelSkill: InternalSkill = {
	name: 'excel-handling',
	description:
		'How to get trustworthy numbers out of an .xlsx workbook: listing its sheets, finding the real header row, merged cells, formulas with no cached value, and totals rows that double count. Load this before working with a spreadsheet.',
	body: ({ canRunSandbox }) =>
		renderToMarkdown(
			<Block>
				<Title level={1}>Working with Excel workbooks</Title>
				<Span>
					A workbook is a zip archive of XML, so its cells never arrive as text. What{' '}
					<Bold>read_attachment</Bold> gives you instead is its outline: every sheet in tab order, which of
					them are hidden, and the used range and row and column counts of each. Start there on every
					workbook. It is one cheap call, and it is the only way to know which sheets exist — never infer
					them, or what they hold, from the file name.
				</Span>
				{canRunSandbox ? (
					<Span>
						Then read the data itself with <Bold>execute_sandboxed_code</Bold>, with the file mounted
						through <Code>storage_files</Code>, which gives you pandas and openpyxl.
					</Span>
				) : (
					<Span>
						Nothing available here can read the cells, so stop at the outline: name the sheet you need and
						ask for the sheet as a CSV, which <Bold>read_attachment</Bold> opens as text. The advice below
						applies to that export as well.
					</Span>
				)}
				<Span>
					All of that is <Code>.xlsx</Code> only. <Code>.xls</Code>, the pre-2007 format, is a different
					format that none of these readers open
					{canRunSandbox && (
						<>
							{' '}
							unless the sandbox installs <Code>xlrd</Code>
						</>
					)}
					: ask for it as <Code>.xlsx</Code> or CSV.
				</Span>

				{canRunSandbox && (
					<>
						<Title level={2}>Look at the grid before you load it</Title>
						<Span>
							The single biggest source of wrong answers from a spreadsheet is loading it as if it were a
							CSV. Print the top-left corner raw first — no header, no type inference — so you can see
							where the table actually starts. Name the sheet explicitly, every time, using a name from
							the outline: <Code>read_excel</Code> takes the first sheet unless told otherwise, and a name
							you guessed will simply fail.
						</Span>
						<CodeBlock>
							{`storage_files: ["/home/uploads/2026-01-31/budget.xlsx"]
packages: ["pandas", "openpyxl"]`}
						</CodeBlock>
						<CodeBlock header='python'>
							{`import pandas as pd

path = "files/uploads/2026-01-31/budget.xlsx"
print(pd.read_excel(path, sheet_name="FY26", header=None, nrows=12).to_string())`}
						</CodeBlock>
						<Span>
							Once you can see it, read the table with the header you decided on: <Code>skiprows</Code> to
							skip a title block, <Code>nrows</Code> to stop before a totals block, <Code>usecols</Code>{' '}
							for a range of columns, and <Code>dtype=str</Code> when you would rather convert everything
							yourself. Two signs the shape is wrong: columns named <Code>Unnamed: 1</Code> mean it found
							no header in that row, and a column that is all <Code>NaN</Code> where the sheet clearly has
							values means you are not reading the range you wanted.
						</Span>
					</>
				)}

				<Title level={2}>What that first look is checking for</Title>
				<List>
					<ListItem>
						<Bold>More sheets than you were told about.</Bold> The first sheet is often a cover page, notes,
						or last year's version, and a hidden sheet is usually the working copy nobody meant to ship. If
						several sheets could answer the question, ask which one rather than picking.
					</ListItem>
					<ListItem>
						<Bold>The header is rarely row 1.</Bold> Titles, logos and blank spacer rows push it down, and a
						report title read as column names turns every real row into data.
						{canRunSandbox && (
							<>
								{' '}
								Pass <Code>skiprows</Code> once you have seen where the table starts.
							</>
						)}
					</ListItem>
					<ListItem>
						<Bold>Merged cells read as empty.</Bold> Only the top-left cell of a merge holds the value, so a
						grouping column that looks filled in Excel arrives mostly empty. Carry it down explicitly
						{canRunSandbox && (
							<>
								{' '}
								with <Code>ffill()</Code>
							</>
						)}
						, and confirm the result against the grid you printed.
					</ListItem>
					<ListItem>
						<Bold>Totals rows sitting inside the data.</Bold> A <Code>Total</Code> or <Code>Subtotal</Code>{' '}
						row is just another row, so summing the column double counts. Exclude them before you aggregate
						— and if your total disagrees with the one in the sheet, say so rather than quietly publishing
						yours.
					</ListItem>
					<ListItem>
						<Bold>Hidden rows, columns and active filters.</Bold> What the user sees is not what the file
						contains. If your row count does not match what they expect, this is usually why.
					</ListItem>
				</List>

				<Title level={2}>Formulas may have no value</Title>
				<Span>
					Cells hold a formula and, separately, the value Excel last cached for it. Readers return the cached
					value, which is what you want — but a workbook written by a script and never opened in Excel has
					nothing cached, so those cells arrive empty. The column is not empty, it is uncomputed: say so, and
					do not treat the gaps as zeros.
					{canRunSandbox && (
						<>
							{' '}
							Reading with <Code>openpyxl</Code> directly gives you formula strings such as{' '}
							<Code>=SUM(B2:B13)</Code> unless you pass <Code>data_only=True</Code>; an <Code>=</Code> in
							your output means you are looking at the formula, not the number.
						</>
					)}
				</Span>

				<Title level={2}>Types are not what they look like</Title>
				<Span>
					Excel stores a date as a serial number and a hand-typed figure as whatever the typist produced, so a
					column is only as clean as the person who filled it. Dates can arrive as integers, numbers as
					strings with thousands separators, currency symbols or a decimal comma, and IDs can lose their
					leading zeros. Read the column as text and convert it yourself when it looks like that
					{canRunSandbox && (
						<>
							{' '}
							— with <Code>pd.to_numeric(errors=&quot;coerce&quot;)</Code> and <Code>pd.to_datetime</Code>{' '}
							—
						</>
					)}{' '}
					then count what failed to convert. A silently dropped value is a dropped row in every total that
					follows.
				</Span>

				<Title level={2}>Keep the workbook out of the conversation</Title>
				<Span>
					A sheet can hold hundreds of thousands of rows. Aggregate where the data is and return only what you
					need — a handful of rows, or the figure you were asked for. Never <Italic>print</Italic> a whole
					sheet to get it into your context: it will be truncated somewhere arbitrary, and you will reason
					over half a table without knowing it.
				</Span>
				<Title level={2}>When the file does not contain what the question needs</Title>
				<Span>
					Once you have seen the columns, check that they can support the definition the user asked for before
					computing anything. A request for a numeric threshold cannot be answered from a sheet that only
					holds a categorical classification, and a request per customer cannot be answered from a sheet
					aggregated per region. When the data falls short, say so first, offer the closest thing the sheet
					can actually compute, and let the user choose. Never substitute your own definition silently and
					present the result as the one they asked for.
				</Span>
				<Title level={2}>Reporting back</Title>
				<Span>
					Name the sheet and the header row you used (&quot;from the <Code>FY26</Code> sheet, taking row 4 as
					the header&quot;). A spreadsheet almost always needed a judgement call to read, and stating yours is
					what lets the user catch it if you chose wrong.
				</Span>

				<Title level={2}>Producing a workbook</Title>
				{canRunSandbox ? (
					<>
						<Span>
							<Bold>write</Bold> saves text only, so it cannot make an <Code>.xlsx</Code>. Build one in
							the sandbox instead: write it into <Code>out/</Code> and name it in <Code>save_files</Code>,
							which keeps it under /home where the user can download it. Give them the path you saved it
							to.
						</Span>
						<CodeBlock>{`save_files: [{ filename: "fy26-summary.xlsx", home_path: "/home/exports/fy26-summary.xlsx" }]`}</CodeBlock>
						<CodeBlock header='python'>
							{`with pd.ExcelWriter("out/fy26-summary.xlsx") as writer:
    summary.to_excel(writer, sheet_name="Summary", index=False)
    detail.to_excel(writer, sheet_name="Detail", index=False)`}
						</CodeBlock>
						<Span>
							A CSV is still the better answer when the user only needs the numbers — say that it is a CSV
							they can open in Excel.
						</Span>
					</>
				) : (
					<Span>
						<Bold>write</Bold> saves text only, and nothing available here can produce a binary{' '}
						<Code>.xlsx</Code>. Save a CSV under <Bold>/home</Bold> instead, tell the user the path and that
						it opens in Excel, and do not promise a workbook you cannot write.
					</Span>
				)}
			</Block>,
		),
};
