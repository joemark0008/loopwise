import { createFileRoute } from '@tanstack/react-router';
import { Send } from 'lucide-react';
import { PlannedPage } from '@/feature/planned/planned-page';

export const Route = createFileRoute('/_protected/referrals')({
	component: () => (
		<PlannedPage
			title='Referral inbox'
			subtitle='Referrals sent to you: accept or reject them, then record the visit.'
			icon={Send}
			listTitle='Waiting for a decision'
			columns={['Patient', 'From', 'Reason', 'Urgency', 'Received', 'Status']}
			emptyTitle='No referrals waiting'
			emptyBody='Referrals from other facilities arrive here. A rejected referral goes back to the sender with your reason.'
		/>
	),
});
