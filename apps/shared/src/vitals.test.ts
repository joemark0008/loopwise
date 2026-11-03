import { describe, expect, it } from 'vitest';

import { vitalFlag } from './vitals';

describe('vitalFlag', () => {
	it('flags blood pressure from stage 1 hypertension up, and a hypertensive crisis as critical', () => {
		expect(vitalFlag('systolicMmHg', 128)).toBe('normal');
		expect(vitalFlag('systolicMmHg', 140)).toBe('high');
		expect(vitalFlag('diastolicMmHg', 90)).toBe('high');
		expect(vitalFlag('systolicMmHg', 180)).toBe('critical_high');
		expect(vitalFlag('diastolicMmHg', 120)).toBe('critical_high');
		expect(vitalFlag('systolicMmHg', 85)).toBe('low');
		expect(vitalFlag('systolicMmHg', 80)).toBe('critical_low');
	});

	it('flags low oxygen and glucose, and fever', () => {
		expect(vitalFlag('spo2Pct', 98)).toBe('normal');
		expect(vitalFlag('spo2Pct', 92)).toBe('low');
		expect(vitalFlag('spo2Pct', 88)).toBe('critical_low');
		expect(vitalFlag('bloodGlucoseMgDl', 142)).toBe('normal');
		expect(vitalFlag('bloodGlucoseMgDl', 50)).toBe('critical_low');
		expect(vitalFlag('temperatureC', 38.2)).toBe('high');
		expect(vitalFlag('temperatureC', 40.1)).toBe('critical_high');
	});

	it('has nothing to say about a field without a range, or no value', () => {
		expect(vitalFlag('weightKg', 72)).toBeNull();
		expect(vitalFlag('heartRateBpm', null)).toBeNull();
	});
});
