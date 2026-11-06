import { createFileRoute } from '@tanstack/react-router';
import { ItemDetailPage } from '@/feature/pharmacy/item-detail-page';

export const Route = createFileRoute('/_protected/pharmacy/items/$itemId')({
	component: function ItemRoute() {
		const { itemId } = Route.useParams();
		return <ItemDetailPage key={itemId} itemId={itemId} />;
	},
});
