import { describe, expect, it } from 'vitest';
import { parsePleasantonTranscriptText } from './transcript';

describe('Pleasanton transcript parser', () => {
	it('reads cumulative GPAs and sums completed credits', () => {
		const result = parsePleasantonTranscriptText('Pleasanton Unified Official Transcript Cred Cmp: 30.00 Cred Cmp: 25.00 GPA Summary Overall GPA 3.80 Overall Weighted 4.20');
		expect(result).toMatchObject({ unweighted: 3.8, weighted: 4.2, credits: 55 });
	});

	it('rejects unsupported districts', () => {
		expect(() => parsePleasantonTranscriptText('Other District Overall GPA 4.0')).toThrow(/Pleasanton/);
	});
});
