import { sanitizeConditionalFormats } from '@loopwise/shared/conditional-formatting';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { ToolCallWrapper } from './tool-call-wrapper';
import { TableFormatEditDialog } from './display-table-edit-dialog';
import styles from './display-chart-table.module.css';
import type { ColumnConditionalFormats } from '@loopwise/shared/conditional-formatting';
import type { displayChart } from '@loopwise/shared/tools';
import type { UIMessage, UIToolPart } from '@loopwise/api/agent/types/chat';
import { DataTableCard } from '@/components/data-table-card';
import { Button } from '@/components/ui/button';
import { useAgentMessagesGetter, useOptionalAgentContext } from '@/contexts/agent.provider';
import { useSourceQuery } from '@/hooks/use-source-query';
import { chartsApi } from '@/lib/charts-api';

const EMPTY_COLUMNS: string[] = [];
const EMPTY_ROWS: Record<string, unknown>[] = [];

interface DisplayChartTableProps {
	config?: displayChart.TableInput;
	outputError?: string;
	toolCallId: string;
}

export function DisplayChartTable({ config, outputError, toolCallId }: DisplayChartTableProps) {
	const agent = useOptionalAgentContext();
	const getMessages = useAgentMessagesGetter();
	const queryClient = useQueryClient();
	const [isEditOpen, setIsEditOpen] = useState(false);

	const isEditable = Boolean(agent && !agent.isReadonly && !agent.isRunning);
	const isPersistingRef = useRef(false);
	const { sourceData, isLoadingRows } = useSourceQuery(config?.query_id);

	const { mutateAsync: updateChart, isPending: isUpdatingChart } = useMutation(
		chartsApi.chart.updateConfig.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries({ queryKey: [['chat', 'get']] }),
		}),
	);

	const columns = sourceData?.columns ?? EMPTY_COLUMNS;
	const rows = (sourceData?.data as Record<string, unknown>[] | undefined) ?? EMPTY_ROWS;
	const conditionalFormats = useMemo(
		() => sanitizeConditionalFormats(config?.conditional_formats) ?? {},
		[config?.conditional_formats],
	);

	const headerActions = useMemo(
		() =>
			isEditable ? (
				<>
					<Button
						variant='ghost-muted'
						size='icon-xs'
						className={styles.headerActionsButton}
						onClick={() => setIsEditOpen(true)}
						title='Edit formatting'
					>
						<Pencil className={styles.headerActionsFilePlus} />
					</Button>
				</>
			) : null,
		[isEditable],
	);

	const persistFormats = async (nextFormats: ColumnConditionalFormats) => {
		if (!config || isPersistingRef.current) {
			return;
		}
		isPersistingRef.current = true;
		const previousMessages = getMessages();
		const nextConfig: displayChart.TableInput = { ...config, conditional_formats: nextFormats };
		agent?.setMessages(applyTableConfigToMessages(previousMessages, toolCallId, nextConfig));
		try {
			await updateChart({ toolCallId, config: nextConfig });
		} catch (err) {
			agent?.setMessages(previousMessages);
			throw err;
		} finally {
			isPersistingRef.current = false;
		}
	};

	if (outputError) {
		return (
			<ToolCallWrapper defaultExpanded title='Could not display the table'>
				<div className={styles.displayChartTableDiv}>{outputError}</div>
			</ToolCallWrapper>
		);
	}

	if (!config || isLoadingRows) {
		return <div className={styles.displayChartTableDiv2}>Loading table...</div>;
	}

	if (!sourceData?.data || sourceData.data.length === 0) {
		return (
			<div className={styles.displayChartTableDiv2}>Could not display the table because the data is missing.</div>
		);
	}

	return (
		<div className={styles.displayChartTableDiv3}>
			<DataTableCard
				data={rows}
				columns={columns}
				title={config.title}
				conditionalFormats={conditionalFormats}
				headerActions={headerActions}
				className={styles.displayChartTableDataTableCard}
			/>

			{isEditable && (
				<TableFormatEditDialog
					open={isEditOpen}
					onOpenChange={setIsEditOpen}
					columns={columns}
					data={rows}
					formats={conditionalFormats}
					onSave={persistFormats}
					isSaving={isUpdatingChart}
					description='Apply conditional formatting to columns. Changes are saved to the chat.'
				/>
			)}
		</div>
	);
}

function applyTableConfigToMessages(
	messages: UIMessage[],
	toolCallId: string,
	config: displayChart.TableInput,
): UIMessage[] {
	return messages.map((message) => {
		let changed = false;
		const parts = message.parts.map((part) => {
			if (part.type !== 'tool-display_chart') {
				return part;
			}
			const toolPart = part as UIToolPart<'display_chart'>;
			if (toolPart.toolCallId !== toolCallId) {
				return part;
			}
			changed = true;
			return { ...toolPart, input: config } as typeof part;
		});
		return changed ? { ...message, parts } : message;
	});
}
