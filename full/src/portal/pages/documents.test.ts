import { describe, expect, it } from 'vitest';
import { portalFixture } from '../../../test/helpers/fixtures.js';
import { htmlPage, redirectTo, scriptedFetch, testSession } from '../../../test/helpers/portal.js';
import { ModuleUnavailableError } from '../errors.js';
import { downloadDocument, fetchDocuments } from './documents.js';

const DOCUMENTS_HTML = portalFixture('documents.html');

const TOKEN = 'QU9EcWg4UVJSOTVYRTR3+ZE4wQjQ0/RXcwTFcrWGVvSWhZbA==';

const binary = (headers: Record<string, string>) =>
	new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { status: 200, headers });

describe('fetchDocuments', () => {
	it('parses document rows out of the right dataSource', async () => {
		const { impl, calls } = scriptedFetch([() => htmlPage(DOCUMENTS_HTML)]);

		const docs = await fetchDocuments(testSession(), { fetchImpl: impl });

		expect(calls[0]?.url).toBe('https://district-psv.edupoint.com/PXP2_Documents.aspx?AGU=0');
		expect(docs).toEqual([
			{
				docToken: TOKEN,
				title: '2025-2026 S2 Transcript dtd 6-12-2026',
				category: 'Transcript',
				uploadDate: '2026-06-12'
			},
			{
				docToken: 'Ymx1ZWJlcnJ5cGFuY2FrZXM9',
				title: '25-26 S2 Report Card & Notes',
				category: 'Report Card',
				uploadDate: '2026-05-18'
			}
		]);
	});

	it('returns [] when the account has no documents', async () => {
		const { impl } = scriptedFetch([
			() => htmlPage('<script>var g = { "dataSource":[] };</script>')
		]);

		await expect(fetchDocuments(testSession(), { fetchImpl: impl })).resolves.toEqual([]);
	});

	it('throws ModuleUnavailableError when the module bounces away', async () => {
		const { impl } = scriptedFetch([
			() => redirectTo('/Home_PXP2.aspx'),
			() => htmlPage('<html>home</html>')
		]);

		await expect(fetchDocuments(testSession(), { fetchImpl: impl })).rejects.toThrow(
			ModuleUnavailableError
		);
	});
});

describe('downloadDocument', () => {
	it('URL-encodes the token and returns the bytes with portal-supplied metadata', async () => {
		const { impl, calls } = scriptedFetch([
			() =>
				binary({
					'content-type': 'application/pdf',
					'content-disposition': 'attachment; filename="Report Card.pdf"'
				})
		]);

		const doc = await downloadDocument(testSession(), TOKEN, { fetchImpl: impl });

		expect(calls[0]?.url).toBe(
			`https://district-psv.edupoint.com/PXP_ShowDocument.aspx?AGU=&docToken=${encodeURIComponent(TOKEN)}`
		);
		expect(calls[0]?.url).toContain('%2B');
		expect(calls[0]?.url).toContain('%2F');
		expect(doc.bytes).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
		expect(doc.mimeType).toBe('application/pdf');
		expect(doc.fileName).toBe('Report Card.pdf');
	});

	it('strips charset from the content type and falls back to a default file name', async () => {
		const { impl } = scriptedFetch([() => binary({ 'content-type': 'image/png; charset=binary' })]);

		const doc = await downloadDocument(testSession(), 'tok', { fetchImpl: impl });

		expect(doc.mimeType).toBe('image/png');
		expect(doc.fileName).toBe('document.pdf');
	});

	it('reads RFC 5987 encoded file names', async () => {
		const { impl } = scriptedFetch([
			() =>
				binary({
					'content-type': 'application/pdf',
					'content-disposition': "attachment; filename*=UTF-8''Report%20Card%202026.pdf"
				})
		]);

		const doc = await downloadDocument(testSession(), 'tok', { fetchImpl: impl });

		expect(doc.fileName).toBe('Report Card 2026.pdf');
	});

	it('treats an HTML response as an expired/invalid token, not a document', async () => {
		const { impl } = scriptedFetch([() => htmlPage('<html>Session expired</html>')]);

		await expect(downloadDocument(testSession(), 'tok', { fetchImpl: impl })).rejects.toThrow(
			ModuleUnavailableError
		);
	});

	it('throws when the portal returns an error status', async () => {
		const { impl } = scriptedFetch([() => new Response('', { status: 500 })]);

		await expect(downloadDocument(testSession(), 'tok', { fetchImpl: impl })).rejects.toThrow(
			ModuleUnavailableError
		);
	});
});
