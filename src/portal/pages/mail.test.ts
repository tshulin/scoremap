import { describe, expect, it } from 'vitest';
import { ModuleUnavailableError, SessionExpiredError } from '../errors';
import { CookieJar, type PortalResponse } from '../http';
import type { PortalSession } from '../login';
import { downloadMailAttachment, fetchMail } from './mail';

const session = (): PortalSession => ({ domain: 'ca-test-psv.edupoint.com', jar: new CookieJar() });

interface FakeResponseInit {
	status?: number;
	headers?: Record<string, string>;
	body?: string;
	bytes?: Uint8Array;
}

const fakeResponse = ({
	status = 200,
	headers = {},
	body = '',
	bytes
}: FakeResponseInit): PortalResponse => {
	const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
		text: async () => body,
		arrayBuffer: async () => (bytes ?? new TextEncoder().encode(body)).buffer as ArrayBuffer
	};
};

// A fetch stub that pops responses in order and records every requested URL.
function fakeFetch(responses: PortalResponse[]) {
	const urls: string[] = [];
	const fetchImpl = async (url: string): Promise<PortalResponse> => {
		urls.push(url);
		const next = responses.shift();
		if (!next) throw new Error(`unexpected request to ${url}`);
		return next;
	};
	return { fetchImpl, urls };
}

const gridPage = (rows: unknown[]): string =>
	`<html><body><script>var ctrl = {"columns":[],"dataSource":${JSON.stringify(rows)}};</script></body></html>`;

const FULL_ROW = {
	SMMessageGU: 'MSG-GU-1',
	Subject: 'Action Needed: DECA&#47;ROP Survey',
	From: '<a href="mailto:traaker@pleasantonusd.net">Raaker, Tami</a>',
	Role: 'Teacher',
	SendDateTime: '5/13/2025 10:12 AM',
	Content:
		'<p>Hi all,</p><p>Please complete the <a href="https://forms.example.com/survey">survey</a> by <b>Friday</b>.</p>' +
		'<p><a href="javascript:void(0)">portal-only link</a></p>',
	Attachments: [
		{ SmAttachmentGU: 'ATT-1', AttachmentName: 'Flyer.pdf' },
		{ SmAttachmentGU: 'ATT-2' }
	]
};

describe('fetchMail', () => {
	it('parses a full message row: entities, mailto sender, time-suffixed date, links, attachments', async () => {
		const { fetchImpl } = fakeFetch([fakeResponse({ body: gridPage([FULL_ROW]) })]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox.unreadableMessages).toBe(0);
		expect(mailbox.messages).toHaveLength(1);
		const m = mailbox.messages[0]!;
		expect(m.id).toBe('MSG-GU-1');
		expect(m.subject).toBe('Action Needed: DECA/ROP Survey');
		expect(m.sender).toEqual({
			name: 'Raaker, Tami',
			role: 'Teacher',
			email: 'traaker@pleasantonusd.net'
		});
		expect(m.date).toBe('2025-05-13');
		expect(m.body).toEqual([
			'Hi all,',
			'Please complete the survey by Friday.',
			'portal-only link'
		]);
		expect(m.links).toEqual([{ label: 'survey', url: 'https://forms.example.com/survey' }]);
		expect(m.attachments).toEqual([
			{ token: 'ATT-1', name: 'Flyer.pdf' },
			{ token: 'ATT-2', name: 'Attachment' }
		]);
	});

	it('reads the alternate key names and falls back to a positional id', async () => {
		const row = {
			MessageSubject: 'Summer Opportunities!',
			FromName: 'Delgado, Anabel',
			MessageDate: '04/28/2025',
			MessageText: 'Hello students<br>Best,<br>A. Delgado'
		};
		const { fetchImpl } = fakeFetch([fakeResponse({ body: gridPage([row]) })]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		const m = mailbox.messages[0]!;
		expect(m.id).toBe('msg-1');
		expect(m.subject).toBe('Summer Opportunities!');
		expect(m.sender).toEqual({ name: 'Delgado, Anabel' });
		expect(m.date).toBe('2025-04-28');
		expect(m.body).toEqual(['Hello students', 'Best,', 'A. Delgado']);
		expect(m.links).toEqual([]);
		expect(m.attachments).toEqual([]);
	});

	it('reads attachments delivered as anchor markup in a grid cell', async () => {
		const row = {
			...FULL_ROW,
			Attachments: undefined,
			MessageAttachments:
				'<a href="PXP_ShowSMAttachment.aspx?AGU=0&amp;SmAttachmentGU=CELL-GU">College List.pdf</a>'
		};
		const { fetchImpl } = fakeFetch([fakeResponse({ body: gridPage([row]) })]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox.messages[0]!.attachments).toEqual([
			{ token: 'CELL-GU', name: 'College List.pdf' }
		]);
	});

	it('drops an unreadable row into the count instead of failing the page', async () => {
		const dateless = { Subject: 'No date on this one', Content: 'x' };
		const { fetchImpl } = fakeFetch([fakeResponse({ body: gridPage([FULL_ROW, dateless]) })]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox.messages).toHaveLength(1);
		expect(mailbox.unreadableMessages).toBe(1);
	});

	it('returns an empty mailbox when the page has no recognizable grid', async () => {
		const { fetchImpl } = fakeFetch([fakeResponse({ body: '<html><body>nothing</body></html>' })]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox).toEqual({ messages: [], unreadableMessages: 0 });
	});

	it('throws ModuleUnavailableError when the portal bounces the module to Home', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ status: 302, headers: { location: '/Home_PXP2.aspx' } }),
			fakeResponse({ body: '<html><body>home</body></html>' })
		]);
		await expect(fetchMail(session(), { fetchImpl })).rejects.toBeInstanceOf(
			ModuleUnavailableError
		);
	});

	it('throws SessionExpiredError when bounced to the login page', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ status: 302, headers: { location: '/PXP2_Login_Student.aspx?regenerateSessionId=True' } }),
			fakeResponse({ body: '<html><body>login</body></html>' })
		]);
		await expect(fetchMail(session(), { fetchImpl })).rejects.toBeInstanceOf(SessionExpiredError);
	});
});

describe('downloadMailAttachment', () => {
	const pdfBytes = new TextEncoder().encode('%PDF-1.4 fake');

	it('downloads by GU through the attachment endpoint', async () => {
		const { fetchImpl, urls } = fakeFetch([
			fakeResponse({
				headers: {
					'content-type': 'application/pdf',
					'content-disposition': 'attachment; filename="Flyer.pdf"'
				},
				bytes: pdfBytes
			})
		]);
		const result = await downloadMailAttachment(session(), 'ATT GU/1', { fetchImpl });

		expect(urls[0]).toBe(
			'https://ca-test-psv.edupoint.com/PXP_ShowSMAttachment.aspx?AGU=0&SmAttachmentGU=ATT%20GU%2F1'
		);
		expect(result.mimeType).toBe('application/pdf');
		expect(result.fileName).toBe('Flyer.pdf');
		expect(new TextDecoder().decode(result.bytes)).toContain('%PDF-');
	});

	it('treats a token that is already a portal href as the download path', async () => {
		const { fetchImpl, urls } = fakeFetch([
			fakeResponse({ headers: { 'content-type': 'application/pdf' }, bytes: pdfBytes })
		]);
		const result = await downloadMailAttachment(
			session(),
			'/PXP_ShowSMAttachment.aspx?AGU=0&SmAttachmentGU=CELL-GU',
			{ fetchImpl }
		);

		expect(urls[0]).toBe(
			'https://ca-test-psv.edupoint.com/PXP_ShowSMAttachment.aspx?AGU=0&SmAttachmentGU=CELL-GU'
		);
		expect(result.fileName).toBe('attachment.pdf');
	});

	it('throws ModuleUnavailableError when the portal answers with HTML', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ headers: { 'content-type': 'text/html' }, body: '<html>expired</html>' })
		]);
		await expect(
			downloadMailAttachment(session(), 'ATT-1', { fetchImpl })
		).rejects.toBeInstanceOf(ModuleUnavailableError);
	});
});
