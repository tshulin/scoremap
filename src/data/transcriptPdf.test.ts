import { describe, expect, it } from 'vitest';
import { textContentToText } from './transcriptPdf.js';

describe('PDF transcript text reconstruction', () => {
	it('orders labels and values by their visual position instead of PDF stream order', () => {
		const content = {
			items: [
				{ str: '4.26', transform: [1, 0, 0, 1, 200, 209] },
				{ str: '4.00', transform: [1, 0, 0, 1, 200, 218] },
				{ str: 'Overall Weighted', transform: [1, 0, 0, 1, 132, 209] },
				{ str: 'Overall GPA', transform: [1, 0, 0, 1, 132, 218] },
				{ str: '30.00', transform: [1, 0, 0, 1, 138, 317] },
				{ str: 'Cred Cmp:', transform: [1, 0, 0, 1, 107, 317] },
			],
		};

		expect(textContentToText(content)).toBe(
			'Cred Cmp: 30.00\nOverall GPA 4.00\nOverall Weighted 4.26',
		);
	});
});
