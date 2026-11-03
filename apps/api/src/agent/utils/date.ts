/** The date helpers of upstream `utils/date.ts` the system prompt uses (the usage-chart ones move with `usage`). */

export function resolveTimezone(timezone?: string): string {
	if (!timezone) {
		return 'UTC';
	}
	try {
		Intl.DateTimeFormat(undefined, { timeZone: timezone });
		return timezone;
	} catch {
		return 'UTC';
	}
}

export function formatCurrentDate(timezone?: string): string {
	const tz = resolveTimezone(timezone);
	const formatted = new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: tz,
	});
	return tz === 'UTC' ? `${formatted} (UTC)` : `${formatted} (${tz})`;
}
