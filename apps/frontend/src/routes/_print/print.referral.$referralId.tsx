import { createFileRoute } from '@tanstack/react-router';
import { ReferralLetterPrint } from '@/feature/encounters/print/referral-letter-print';

export const Route = createFileRoute('/_print/print/referral/$referralId')({
	component: RouteComponent,
});

function RouteComponent() {
	const { referralId } = Route.useParams();
	return <ReferralLetterPrint referralId={referralId} />;
}
