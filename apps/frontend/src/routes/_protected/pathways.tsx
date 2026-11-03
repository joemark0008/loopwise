import { createFileRoute } from '@tanstack/react-router';
import { PathwaysPage } from '@/feature/pathways/pathways-page';

export const Route = createFileRoute('/_protected/pathways')({ component: PathwaysPage });
