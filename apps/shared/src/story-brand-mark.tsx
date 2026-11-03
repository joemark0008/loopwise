import type { StoryTheme } from './story-theme';

export function StoryBrandMark({ brand }: { brand: StoryTheme['brand'] }) {
	const logo = brand.header === 'name' ? null : brand.logo;
	const showName = (brand.header === 'name' || brand.showName) && Boolean(brand.name);
	return (
		<span className='quarry-brand-header__mark'>
			{logo && (
				<img className='quarry-brand-header__logo' src={logo} alt={showName ? '' : brand.name || 'Logo'} />
			)}
			{showName && <span className='quarry-brand-header__name'>{brand.name}</span>}
		</span>
	);
}
