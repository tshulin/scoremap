import {
	MailMessageSchema,
	MailboxSchema,
	type DocumentContent,
	type MailAttachment,
	type MailLink,
	type MailMessage,
	type Mailbox
} from '../../domain/index';
import { decodeEntities, stripTags, toIsoDate } from '../../extract/index';
import { ModuleUnavailableError, ParseError } from '../errors';
import { fetchFollow, fetchFollowRaw, type FetchFollowOptions } from '../http';
import type { PortalSession } from '../login';
import { assertSessionAlive } from '../session';
import { fileNameFrom } from './documents';
import { portalUrl, validate } from './shared';

// Synergy Mail is a knockout app, not a scraped grid: PXP2_Messages.aspx is a
// shell whose bundle calls this JSON service. The Bearer value is the literal
// constant the portal seeds into ST.Authorization — the real credential is the
// session cookie. PORTAL=3 identifies StudentVUE (ST.CurrentWebPortal).
const SERVICE = 'st_api/ST.Messaging';
const PORTAL = 3;
const INBOX_FOLDER_TYPE = 0;
const DOWNLOAD_PAGE = 'FileDownload.aspx';
const ATTACHMENT_DB_ID = 3;

// One list call is cheap; each body is its own request. Bodies for the messages
// visible without scrolling are prefetched so the list can show previews, and
// the rest load when opened (fetchMailMessage). In the browser every request is
// its own TLS connection through the relay, so this is deliberately small and
// rate-limited — raising either number multiplies handshakes per sync.
const BODY_PREFETCH = 8;
const BODY_PREFETCH_CONCURRENCY = 4;
const PAGE_SIZE = 50;

// The service answers with JSON buried in an HTML document.
function unwrapResult(body: string, what: string): Record<string, unknown> {
	const inner = /id="json-result"[^>]*>([\s\S]*?)<\/div>/.exec(body)?.[1] ?? body;
	let parsed: unknown;
	try {
		parsed = JSON.parse(inner);
	} catch {
		throw new ParseError(`The portal returned an unreadable ${what} response.`);
	}
	if (typeof parsed !== 'object' || parsed === null) {
		throw new ParseError(`The portal returned an unexpected ${what} response.`);
	}
	const envelope = parsed as Record<string, unknown>;
	if (typeof envelope['Error'] === 'string' && envelope['Error'] !== '') {
		throw new ModuleUnavailableError(`Messages are unavailable: ${envelope['Error']}`);
	}
	const result = envelope['Result'];
	if (typeof result !== 'object' || result === null) {
		throw new ParseError(`The portal's ${what} response had no result.`);
	}
	return result as Record<string, unknown>;
}

async function callMessaging(
	session: PortalSession,
	method: string,
	data: Record<string, unknown>,
	options: FetchFollowOptions
): Promise<Record<string, unknown>> {
	const page = await fetchFollow(
		portalUrl(session, `${SERVICE}/${method}?PORTAL=${PORTAL}`),
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				Authorization: 'Bearer authorized',
				'X-Requested-With': 'XMLHttpRequest'
			},
			body: new URLSearchParams({ data: JSON.stringify(data) }).toString()
		},
		session.jar,
		options
	);
	assertSessionAlive(page);
	return unwrapResult(page.body, method);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

function anchors(html: string): Array<{ href: string; text: string }> {
	const re = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
	return [...html.matchAll(re)].map((match) => ({
		href: decodeEntities(match[1] ?? match[2] ?? '').trim(),
		text: stripTags(match[3] ?? '')
	}));
}

// Only links that work outside the portal; javascript: and portal-relative hrefs
// are dropped rather than rendered as dead ends.
const contentLinks = (html: string): MailLink[] =>
	anchors(html)
		.filter((a) => /^https?:\/\//i.test(a.href))
		.map((a) => ({ label: a.text || a.href, url: a.href }));

// The portal sends rich HTML; it is reduced to text paragraphs here so the app
// never renders portal markup.
const contentParagraphs = (html: string): string[] =>
	html
		.split(/<\/(?:p|div|li|h[1-6]|tr|table)>|<br\s*\/?>/gi)
		.map((part) => stripTags(part))
		.filter((text) => text !== '');

function toAttachments(value: unknown): MailAttachment[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord).flatMap((entry) => {
		const token = asString(entry['attachmentId']);
		if (!token) return [];
		return [{ token, name: stripTags(asString(entry['name'])) || 'Attachment' }];
	});
}

function toMessage(row: Record<string, unknown>): unknown {
	const from = isRecord(row['from']) ? row['from'] : {};
	const emails = from['emails'];
	const email = Array.isArray(emails) ? asString(emails[0]) : asString(emails);
	const role = stripTags(asString(from['contactDetails2']));
	const messageText = asString(row['messageText']);
	// The list call carries no body; only GetMessage does. bodyLoaded keeps
	// "not fetched yet" distinguishable from "genuinely empty".
	const bodyLoaded = 'messageText' in row;

	return {
		// messagePersonId, not messageId: it is what GetMessage and the read
		// state are keyed on, and it is unique per recipient.
		id: asString(row['messagePersonId']) || asString(row['messageId']),
		subject: stripTags(asString(row['subject'])) || '(no subject)',
		sender: {
			name: stripTags(asString(from['contactDetails1'])) || 'Unknown sender',
			...(role ? { role } : {}),
			...(email ? { email } : {})
		},
		date: toIsoDate(asString(row['sendDateTime'])),
		body: contentParagraphs(messageText),
		links: contentLinks(messageText),
		attachments: toAttachments(row['attachments']),
		bodyLoaded,
		hasAttachments: row['hasAttachments'] === true,
		isSystemMessage: row['isSystemMessage'] === true
	};
}

export async function fetchMailMessage(
	session: PortalSession,
	id: string,
	isSystemMessage = false,
	options: FetchFollowOptions = {}
): Promise<MailMessage> {
	// markAsRead stays false: reading mail in Grademax must not silently change
	// the unread state of the student's real inbox.
	const result = await callMessaging(
		session,
		'GetMessage',
		{ id, languageCode: '', markAsRead: false, isSystemMessage },
		options
	);
	return validate(MailMessageSchema, toMessage(result), 'message');
}

export async function fetchMail(
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<Mailbox> {
	const result = await callMessaging(
		session,
		'GetMessages',
		{
			folderType: INBOX_FOLDER_TYPE,
			folderId: null,
			languageCode: '',
			showDeleted: false,
			skip: 0,
			take: PAGE_SIZE,
			requireTotalCount: true
		},
		options
	);

	const rows = Array.isArray(result['data']) ? result['data'].filter(isRecord) : [];
	const messages: MailMessage[] = [];
	let unreadableMessages = 0;

	// Per row, so one unexpected shape costs that row rather than the whole
	// mailbox. Only a ParseError means "this row is not what we expected";
	// anything else is our own bug and must still surface.
	for (const [index, row] of rows.entries()) {
		try {
			messages.push(validate(MailMessageSchema, toMessage(row), `message row ${index + 1}`));
		} catch (error) {
			if (!(error instanceof ParseError)) throw error;
			unreadableMessages++;
		}
	}

	// Bodies for the top of the list, so previews are real. A body that fails to
	// load leaves its message listed and openable rather than sinking the sync.
	const targets = messages.slice(0, BODY_PREFETCH);
	let next = 0;
	const worker = async (): Promise<void> => {
		for (let index = next++; index < targets.length; index = next++) {
			const message = targets[index]!;
			try {
				messages[index] = await fetchMailMessage(
					session,
					message.id,
					message.isSystemMessage,
					options
				);
			} catch {
				// Keep the listed message; its body loads when opened.
			}
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(BODY_PREFETCH_CONCURRENCY, targets.length) }, worker)
	);

	return validate(MailboxSchema, { messages, unreadableMessages }, 'mail');
}

export async function downloadMailAttachment(
	session: PortalSession,
	token: string,
	options: FetchFollowOptions = {}
): Promise<DocumentContent> {
	const { response } = await fetchFollowRaw(
		portalUrl(
			session,
			`${DOWNLOAD_PAGE}?fdID=${encodeURIComponent(token)}&dbID=${ATTACHMENT_DB_ID}`
		),
		{ method: 'GET' },
		session.jar,
		options
	);

	const contentType = response.headers.get('content-type') ?? '';
	if (!response.ok || contentType.includes('text/html')) {
		throw new ModuleUnavailableError(
			'The portal could not download this attachment. Its link may have expired.'
		);
	}

	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		mimeType: contentType.split(';')[0]?.trim() || 'application/octet-stream',
		fileName: fileNameFrom(response.headers.get('content-disposition'), 'attachment')
	};
}
