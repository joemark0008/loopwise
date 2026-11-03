import { CheckIcon, ChevronRight, CircleIcon, ListFilter } from 'lucide-react';
import { useRef, useState } from 'react';

import styles from './sidebar-chat-filter-menu.module.css';
import type { ChatFilterType, ChatGroupBy } from '@loopwise/shared/types';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ChatFilterMenuProps {
	groupBy: ChatGroupBy;
	filters: ChatFilterType[];
	onGroupByChange: (value: ChatGroupBy) => void;
	onFilterToggle: (filter: ChatFilterType) => void;
}

const GROUP_BY_OPTIONS: { value: ChatGroupBy; label: string }[] = [
	{ value: 'star', label: 'Star' },
	{ value: 'date', label: 'Date' },
	{ value: 'project', label: 'Projects' },
	{ value: 'ownership', label: 'Ownership' },
	{ value: 'sourcePlatform', label: 'Source platform' },
	{ value: 'none', label: 'None' },
];

const FILTER_OPTIONS: { value: ChatFilterType; label: string }[] = [
	{ value: 'all', label: 'All' },
	{ value: 'mine', label: 'Mine' },
	{ value: 'starred', label: 'Starred' },
	{ value: 'shared', label: 'Shared' },
	{ value: 'shared_with_me', label: 'Shared with me' },
];

export function ChatFilterMenu({ groupBy, filters, onGroupByChange, onFilterToggle }: ChatFilterMenuProps) {
	const [open, setOpen] = useState(false);
	const [subOpen, setSubOpen] = useState(false);
	const closeTimeout = useRef<ReturnType<typeof setTimeout>>(null);

	const scheduleClose = () => {
		cancelClose();
		closeTimeout.current = setTimeout(() => setOpen(false), 150);
	};

	const cancelClose = () => {
		if (closeTimeout.current) {
			clearTimeout(closeTimeout.current);
			closeTimeout.current = null;
		}
	};

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			setSubOpen(false);
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger asChild>
				<Button
					variant='ghost'
					size='icon-md'
					aria-label='Open chat filters'
					className={styles.chatFilterMenuButton}
				>
					<ListFilter className={styles.chatFilterMenuListFilter} />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align='end'
				side='top'
				className={styles.chatFilterMenuDropdownMenuContent}
				onMouseEnter={cancelClose}
				onMouseLeave={scheduleClose}
			>
				<DropdownMenuLabel className={styles.chatFilterMenuDropdownMenuLabel}>Group by</DropdownMenuLabel>

				{GROUP_BY_OPTIONS.map((opt) => (
					<DropdownMenuItem
						key={opt.value}
						onSelect={(e) => {
							e.preventDefault();
							onGroupByChange(opt.value);
						}}
					>
						{opt.label}
						{groupBy === opt.value && (
							<span className={styles.chatFilterMenuSpan}>
								<CircleIcon className={styles.chatFilterMenuCircleIcon} />
							</span>
						)}
					</DropdownMenuItem>
				))}

				<DropdownMenuSeparator />

				<div
					className={styles.chatFilterMenuDiv}
					onMouseEnter={() => setSubOpen(true)}
					onMouseLeave={() => setSubOpen(false)}
				>
					<div
						className={cn(
							styles.chatFilterMenuDiv2,
							subOpen ? styles.chatFilterMenuDiv3 : styles.chatFilterMenuDiv4,
						)}
					>
						Filter
						<ChevronRight className={styles.chatFilterMenuChevronRight} />
					</div>

					{subOpen && (
						<div className={styles.chatFilterMenuDiv5}>
							<div className={styles.chatFilterMenuDiv6}>
								{FILTER_OPTIONS.map((opt) => (
									<DropdownMenuItem
										key={opt.value}
										onSelect={(e) => {
											e.preventDefault();
											onFilterToggle(opt.value);
										}}
									>
										{opt.label}
										{filters.includes(opt.value) && (
											<span className={styles.chatFilterMenuSpan}>
												<CheckIcon className={styles.chatFilterMenuListFilter} />
											</span>
										)}
									</DropdownMenuItem>
								))}
							</div>
						</div>
					)}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
