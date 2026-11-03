import { Block, Bold, Code, List, ListItem, renderToMarkdown, Span, Title } from '../markdown/index.js';
import type { InternalSkill } from './types.js';

export const skillCreatorSkill: InternalSkill = {
	name: 'skill-creator',
	description:
		'How to draft a new project skill. Load it when the user asks to create, save or turn something into a skill.',
	body: () =>
		renderToMarkdown(
			<Block>
				<Title level={1}>Drafting a project skill</Title>
				<Span>
					A skill is a Markdown playbook the agent loads when a question matches its description. Draft from
					what actually worked in this conversation, then call <Bold>propose_skill</Bold>. The user reads the
					draft and decides whether to save it; you cannot save it yourself.
				</Span>

				<Title level={2}>Name</Title>
				<Span>
					Short kebab-case words for the job, like <Code>churn-analysis</Code>.
				</Span>

				<Title level={2}>Description</Title>
				<Span>
					This decides whether the skill ever gets loaded. Say when to use it and name the questions it
					covers: "Use when the user asks about churn, retention or lost customers." Do not describe how it
					works.
				</Span>

				<Title level={2}>Instructions</Title>
				<List>
					<ListItem>Write short numbered steps the agent can follow.</ListItem>
					<ListItem>
						Write down the definitions and exclusions the user gave you: those are why the skill exists.
					</ListItem>
					<ListItem>
						If a saved query tool does the job, name it (<Code>qt_monthly_churn</Code>) instead of pasting
						its SQL. Otherwise include the SQL that worked.
					</ListItem>
					<ListItem>
						Say what the answer should show, such as a chart, a breakdown or a stated definition.
					</ListItem>
					<ListItem>
						Leave out anything specific to this one conversation, like today's date or one customer.
					</ListItem>
				</List>

				<Title level={2}>When the draft is shown</Title>
				<Span>
					Stop after <Bold>propose_skill</Bold>. Only say the skill is saved once the user tells you it is.
				</Span>
			</Block>,
		),
};
