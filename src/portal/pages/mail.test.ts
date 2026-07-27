import { describe, expect, it } from 'vitest';
import { ModuleUnavailableError, ParseError, SessionExpiredError } from '../errors';
import { CookieJar, type PortalResponse } from '../http';
import type { PortalSession } from '../login';
import { downloadMailAttachment, fetchMail, fetchMailMessage } from './mail';

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

interface Call {
	url: string;
	body?: string;
}

function fakeFetch(responses: PortalResponse[]) {
	const calls: Call[] = [];
	const fetchImpl = async (url: string, init: RequestInit): Promise<PortalResponse> => {
		calls.push({ url, body: typeof init.body === 'string' ? init.body : undefined });
		const next = responses.shift();
		if (!next) throw new Error(`unexpected request to ${url}`);
		return next;
	};
	return { fetchImpl, calls };
}

// The service answers with JSON hidden inside an HTML document.
const wrap = (payload: unknown): string =>
	`<!DOCTYPE html><html><head><title></title></head><body><div id="json-result" style="display:none;">${JSON.stringify(payload)}</div></body></html>`;

const listOf = (rows: unknown[]) => wrap({ Result: { data: rows, totalCount: rows.length } });

const LIST_ROW = {
	messageId: 'C0FFEE00-0000-0000-0000-000000000001',
	messagePersonId: 'FACE0000-0000-0000-0000-000000000002',
	subject: 'Action Needed: DECA&#47;ROP Survey',
	from: {
		contactDetails1: 'Raaker, Tami',
		contactDetails2: 'Staff',
		emails: ['traaker@pleasantonusd.net']
	},
	sendDateTime: '2025-05-13T17:12:04Z',
	hasAttachments: true,
	isSystemMessage: false
};

const FULL_MESSAGE = {
	...LIST_ROW,
	messageText:
		'<p><strong>Hi all,</strong></p><p>Please complete the <a href="https://forms.example.com/survey">survey</a> by Friday.</p>' +
		'<p><a href="javascript:void(0)">portal-only link</a></p>',
	attachments: [
		{ attachmentId: 'ATT-1', name: 'Flyer.pdf', attachmentType: 0 },
		{ attachmentId: 'ATT-2', name: '', attachmentType: 0 }
	]
};

describe('fetchMail', () => {
	it('reads the message list and prefetches bodies for the visible messages', async () => {
		const { fetchImpl, calls } = fakeFetch([
			fakeResponse({ body: listOf([LIST_ROW]) }),
			fakeResponse({ body: wrap({ Result: FULL_MESSAGE }) })
		]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox.unreadableMessages).toBe(0);
		expect(mailbox.messages).toHaveLength(1);
		const m = mailbox.messages[0]!;
		// The identifier is messagePersonId — what GetMessage is keyed on.
		expect(m.id).toBe('FACE0000-0000-0000-0000-000000000002');
		expect(m.subject).toBe('Action Needed: DECA/ROP Survey');
		expect(m.sender).toEqual({
			name: 'Raaker, Tami',
			role: 'Staff',
			email: 'traaker@pleasantonusd.net'
		});
		expect(m.date).toBe('2025-05-13');
		expect(m.body).toEqual(['Hi all,', 'Please complete the survey by Friday.', 'portal-only link']);
		expect(m.links).toEqual([{ label: 'survey', url: 'https://forms.example.com/survey' }]);
		expect(m.attachments).toEqual([
			{ token: 'ATT-1', name: 'Flyer.pdf' },
			{ token: 'ATT-2', name: 'Attachment' }
		]);
		expect(m.bodyLoaded).toBe(true);

		expect(calls[0]!.url).toBe(
			'https://ca-test-psv.edupoint.com/st_api/ST.Messaging/GetMessages?PORTAL=3'
		);
		expect(calls[0]!.body).toContain('data=');
		expect(decodeURIComponent(calls[0]!.body!)).toContain('"folderType":0');
		// Reading mail must never change the inbox's unread state.
		expect(decodeURIComponent(calls[1]!.body!)).toContain('"markAsRead":false');
	});

	it('prefetches only the top of the list and leaves the rest body-not-loaded', async () => {
		const rows = Array.from({ length: 12 }, (_, i) => ({
			...LIST_ROW,
			messagePersonId: `PERSON-${i}`,
			subject: `Message ${i}`
		}));
		// One list response plus a body for each prefetched message. If the client
		// asked for more bodies than this, fakeFetch throws.
		const responses = [fakeResponse({ body: listOf(rows) })];
		for (let i = 0; i < 8; i++) {
			responses.push(fakeResponse({ body: wrap({ Result: FULL_MESSAGE }) }));
		}
		const { fetchImpl, calls } = fakeFetch(responses);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox.messages).toHaveLength(12);
		expect(calls).toHaveLength(9); // 1 list + 8 bodies, never one per message
		expect(mailbox.messages.filter((m) => m.bodyLoaded)).toHaveLength(8);

		const tail = mailbox.messages[11]!;
		expect(tail.bodyLoaded).toBe(false);
		expect(tail.body).toEqual([]);
		// The count is unknown until the body loads, but their existence is not.
		expect(tail.attachments).toEqual([]);
		expect(tail.hasAttachments).toBe(true);
	});

	it('keeps every message in its listed order while prefetching concurrently', async () => {
		const rows = Array.from({ length: 8 }, (_, i) => ({
			...LIST_ROW,
			messagePersonId: `PERSON-${i}`,
			subject: `Message ${i}`
		}));
		const responses = [fakeResponse({ body: listOf(rows) })];
		for (let i = 0; i < 8; i++) {
			responses.push(
				fakeResponse({
					body: wrap({
						Result: { ...FULL_MESSAGE, messagePersonId: `PERSON-${i}`, subject: `Message ${i}` }
					})
				})
			);
		}
		const { fetchImpl } = fakeFetch(responses);
		const mailbox = await fetchMail(session(), { fetchImpl });

		// Workers pull from a shared cursor, so a slot must still hold its own message.
		expect(mailbox.messages.map((m) => m.id)).toEqual(rows.map((r) => r.messagePersonId));
		expect(mailbox.messages.map((m) => m.subject)).toEqual(rows.map((r) => r.subject));
	});

	it('keeps a message whose body fails to load', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ body: listOf([LIST_ROW]) }),
			fakeResponse({ status: 200, body: '<html>not json</html>' })
		]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox.messages).toHaveLength(1);
		expect(mailbox.messages[0]!.bodyLoaded).toBe(false);
		expect(mailbox.unreadableMessages).toBe(0);
	});

	it('drops an unreadable row into the count instead of failing the mailbox', async () => {
		const dateless = { ...LIST_ROW, messagePersonId: 'BAD', sendDateTime: 'not a date' };
		const { fetchImpl } = fakeFetch([
			fakeResponse({ body: listOf([LIST_ROW, dateless]) }),
			fakeResponse({ body: wrap({ Result: FULL_MESSAGE }) })
		]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox.messages).toHaveLength(1);
		expect(mailbox.unreadableMessages).toBe(1);
	});

	it('returns an empty mailbox for an empty inbox', async () => {
		const { fetchImpl } = fakeFetch([fakeResponse({ body: listOf([]) })]);
		const mailbox = await fetchMail(session(), { fetchImpl });

		expect(mailbox).toEqual({ messages: [], unreadableMessages: 0 });
	});

	it('surfaces a service error as ModuleUnavailableError', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ body: wrap({ Error: 'Messaging is disabled for this account.' }) })
		]);
		await expect(fetchMail(session(), { fetchImpl })).rejects.toBeInstanceOf(
			ModuleUnavailableError
		);
	});

	it('throws ParseError when the response is not the expected envelope', async () => {
		const { fetchImpl } = fakeFetch([fakeResponse({ body: '<html><body>nope</body></html>' })]);
		await expect(fetchMail(session(), { fetchImpl })).rejects.toBeInstanceOf(ParseError);
	});

	it('throws SessionExpiredError when the portal bounces to the login page', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({
				status: 302,
				headers: { location: '/PXP2_Login_Student.aspx?regenerateSessionId=True' }
			}),
			fakeResponse({ body: '<html><body>login</body></html>' })
		]);
		await expect(fetchMail(session(), { fetchImpl })).rejects.toBeInstanceOf(SessionExpiredError);
	});
});

describe('fetchMailMessage', () => {
	it('loads one message body on demand without marking it read', async () => {
		const { fetchImpl, calls } = fakeFetch([fakeResponse({ body: wrap({ Result: FULL_MESSAGE }) })]);
		const message = await fetchMailMessage(session(), 'PERSON-1', false, { fetchImpl });

		expect(message.bodyLoaded).toBe(true);
		expect(message.body[0]).toBe('Hi all,');
		expect(calls[0]!.url).toBe(
			'https://ca-test-psv.edupoint.com/st_api/ST.Messaging/GetMessage?PORTAL=3'
		);
		const sent = decodeURIComponent(calls[0]!.body!);
		expect(sent).toContain('"id":"PERSON-1"');
		expect(sent).toContain('"markAsRead":false');
	});
});

describe('downloadMailAttachment', () => {
	const pdfBytes = new TextEncoder().encode('%PDF-1.4 fake');

	it('downloads through FileDownload.aspx by attachment id', async () => {
		const { fetchImpl, calls } = fakeFetch([
			fakeResponse({
				headers: {
					'content-type': 'application/pdf',
					'content-disposition': 'attachment; filename="Flyer.pdf"'
				},
				bytes: pdfBytes
			})
		]);
		const result = await downloadMailAttachment(session(), 'ATT/1', { fetchImpl });

		expect(calls[0]!.url).toBe(
			'https://ca-test-psv.edupoint.com/FileDownload.aspx?fdID=ATT%2F1&dbID=3'
		);
		expect(result.mimeType).toBe('application/pdf');
		expect(result.fileName).toBe('Flyer.pdf');
		expect(new TextDecoder().decode(result.bytes)).toContain('%PDF-');
	});

	it('throws ModuleUnavailableError when the portal answers with HTML', async () => {
		const { fetchImpl } = fakeFetch([
			fakeResponse({ headers: { 'content-type': 'text/html' }, body: '<html>expired</html>' })
		]);
		await expect(downloadMailAttachment(session(), 'ATT-1', { fetchImpl })).rejects.toBeInstanceOf(
			ModuleUnavailableError
		);
	});
});
