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

export const pdfSkill: InternalSkill = {
	name: 'pdf-handling',
	description:
		'How to get data out of a PDF, and what to do when the usual read does not work: scanned files with no text layer, tables whose layout is lost, and figures that need reading as an image. Load this before working with a .pdf file.',
	body: ({ canRunSandbox }) =>
		renderToMarkdown(
			<Block>
				<Title level={1}>Working with PDFs</Title>
				<Span>
					Reading a PDF with <Bold>read_attachment</Bold> gives you its text, page by page, prefixed with a{' '}
					<Code>--- Page N ---</Code> marker and a header saying how many pages the file has. Start there. The
					rest of this skill is about the cases where that is not enough.
				</Span>

				<Title level={2}>Trust the page count</Title>
				<Span>
					The header tells you the true number of pages; the body may be cut short because a long read is cut
					into parts. If the last marker you can see is well below the page count, you have not read the whole
					document: read on with the <Code>nextOffset</Code> it returned, or say so rather than answering as
					if you had{canRunSandbox && ', or work through a sandbox'}.
				</Span>

				<Title level={2}>Scanned pages (OCR)</Title>
				<Span>
					A scanned document (a photographed referral, an outside lab result, a signed certificate) has no
					text layer. Its pages are read by OCR, up to the first 20, and marked{' '}
					<Code>--- Page N (OCR) ---</Code>. OCR text can be wrong: letters and digits get confused (0 and O,
					1 and l, 5 and S), decimal points vanish, and handwriting is mostly lost. Quote a doubtful value as
					read and ask the user to confirm it against the paper, above all names, birth dates, doses, units,
					lab values and dates.
				</Span>
				<Span>
					If OCR found nothing or could not run, the read fails saying so. If the user also attached the page
					as an <Bold>image</Bold>, look at the image instead: you see images directly. Otherwise ask for a
					clearer scan or the underlying data.
					{canRunSandbox &&
						' A sandbox can retry OCR as a last resort; warn that OCR on a table is unreliable.'}
				</Span>
				<Span>Never guess at the contents of a scanned PDF from its filename.</Span>

				<Title level={2}>Tables and layout</Title>
				<Span>
					PDF has no concept of a table: what looks like a grid is absolutely-positioned text, and extraction
					flattens it into lines. Numbers may end up separated from their labels, columns may interleave, and
					a figure like <Code>1,234</Code> may arrive split.
				</Span>
				<Span>
					So: read a PDF to <Italic>understand</Italic> a document, quote from it, or find where something is
					stated. Do not treat extracted rows as data to compute with. If a user wants totals, growth, or any
					figure you would have to recompute, either
				</Span>
				<List>
					<ListItem>
						take the numbers the document itself states, and say which page they came from, or
					</ListItem>
					<ListItem>ask for the data behind the report{canRunSandbox ? ',' : '.'}</ListItem>
					{canRunSandbox && <ListItem>or parse it properly in a sandbox (below).</ListItem>}
				</List>
				<Span>
					Never silently transcribe a PDF table into a chart or a SQL insert. A transcription error in a
					financial table is the kind of mistake that destroys trust in every other number you produce.
				</Span>

				{canRunSandbox && (
					<Block>
						<Title level={2}>Parsing properly in a sandbox</Title>
						<Span>
							When <Code>execute_sandboxed_code</Code> is available and the document really has to be
							parsed, mount the file with <Code>storage_files</Code> and use a library built for the job:
						</Span>
						<CodeBlock>
							{`storage_files: ["/home/uploads/2026-01-31/report.pdf"]
packages: ["pdfplumber"]`}
						</CodeBlock>
						<CodeBlock header='python'>
							{`import pdfplumber

with pdfplumber.open("files/uploads/2026-01-31/report.pdf") as pdf:
    page = pdf.pages[3]
    for table in page.extract_tables():
        for row in table:
            print(row)`}
						</CodeBlock>
						<Span>
							<Code>pdfplumber</Code> keeps column structure far better than a plain text extract, which
							is the whole reason to bother with a sandbox. Print what you found and check it looks like a
							table before you use it. For a scanned file you would need OCR instead (
							<Code>pytesseract</Code> plus the <Code>tesseract-ocr</Code> system package), which is slow
							and often wrong on numbers — get the user&apos;s agreement first.
						</Span>
					</Block>
				)}

				<Title level={2}>Reporting back</Title>
				<Span>
					Cite pages when you quote or attribute a figure (&quot;page 4 gives Q3 revenue as €1.2M&quot;). It
					is what makes an answer from a document checkable, and the user has the file open in front of them.
				</Span>
			</Block>,
		),
};
