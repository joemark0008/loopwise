import { createFileRoute } from '@tanstack/react-router';
import { DoctorQueuePage } from '@/feature/scheduling/doctor-queue-page';

export const Route = createFileRoute('/_protected/my-queue')({
	component: DoctorQueuePage,
});
