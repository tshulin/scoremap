import { describe, expect, it } from 'vitest';
import { countDataSources, extractJsonAfter, findDataSourceWithKeys } from './json.js';

describe('extractJsonAfter', () => {
	it('extracts a following array', () => {
		expect(extractJsonAfter('x = [1, 2, 3];', 'x =')).toEqual([1, 2, 3]);
	});

	it('extracts a following object and skips whitespace/prefix to the first brace', () => {
		expect(extractJsonAfter('"dataSource":   {"a": 1}', '"dataSource":')).toEqual({ a: 1 });
	});

	it('counts braces only outside strings', () => {
		expect(extractJsonAfter('v:[{"note": "a ] } bracket"}]', 'v:')).toEqual([
			{ note: 'a ] } bracket' }
		]);
	});

	it('handles escaped quotes and backslashes inside strings', () => {
		expect(extractJsonAfter('v:["a \\" b", "c\\\\"]', 'v:')).toEqual(['a " b', 'c\\']);
	});

	it('reads only the first balanced literal, ignoring trailing content', () => {
		expect(extractJsonAfter('v:[1] , [2]', 'v:')).toEqual([1]);
	});

	it('returns undefined when the needle is absent', () => {
		expect(extractJsonAfter('nothing here', 'v:')).toBeUndefined();
	});

	it('returns undefined when no literal follows the needle', () => {
		expect(extractJsonAfter('v: 42', 'v:')).toBeUndefined();
	});

	it('returns undefined on malformed JSON', () => {
		expect(extractJsonAfter("v:[1, 2,]extra'", 'v:')).toBeUndefined();
	});
});

describe('findDataSourceWithKeys', () => {
	const html =
		'{"dataSource":["Attendance","Documents"]},' +
		'{"dataSource":[{"Value":"1","Text":"All"}]},' +
		'{"dataSource":[{"DocumentUploadDate":"1/2/2026","DocumentTitle":"Report Card","DocumentCategory":"Report Card"}]}';

	it('returns the first grid whose rows carry one of the keys', () => {
		const rows = findDataSourceWithKeys(html, ['DocumentUploadDate', 'DocumentTitle']);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ DocumentTitle: 'Report Card' });
	});

	it('skips string-array and wrong-shaped dataSources', () => {
		const rows = findDataSourceWithKeys(html, ['Value']);
		expect(rows[0]).toMatchObject({ Text: 'All' });
	});

	it('returns [] when no dataSource has a matching key', () => {
		expect(findDataSourceWithKeys(html, ['Nonexistent'])).toEqual([]);
	});

	it('returns [] when there are no dataSources at all', () => {
		expect(findDataSourceWithKeys('<html>empty</html>', ['x'])).toEqual([]);
	});
});

describe('countDataSources', () => {
	it('counts embedded grids', () => {
		expect(countDataSources('a "dataSource": b "dataSource": c')).toBe(2);
		expect(countDataSources('none')).toBe(0);
	});
});
