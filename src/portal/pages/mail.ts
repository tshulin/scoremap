import {
	MailMessageSchema,
	MailboxSchema,
	type DocumentContent,
	type MailAttachment,
	type MailLink,
	type MailMessage,
	type Mailbox
} from '../../domain/index';
import {
	assertNotBounced,
	decodeEntities,
	findDataSourceWithKeys,
	stripTags,
	toIsoDate
} from '../../extract/index';
import { ModuleUnavailableError, ParseError } from '../errors';
import { fetchFollowRaw, type FetchFollowOptions } from '../http';
import type { PortalSession } from '../login';
import { fileNameFrom } from './documents';
import { asString, getPage, portalUrl, validate } from './shared';

const PAGE = 'PXP2_Messages.aspx?AGU=0';
const ATTACHMENT_PAGE = 'PXP_ShowSMAttachment.aspx?AGU=0&SmAttachmentGU=';

// Every name below is a reconstruction from the SOAP-era SynergyMail shapes — no
// live capture of the PXP2 messages grid exists yet (mail_plan.md, Phase B0). The
// candidate lists are deliberately broad so a real grid still matches; a wrong
// guess costs one row (counted in unreadableMessages), never a silent short list.
const ID_KEYS = ['SMMessageGU', 'MessageGU', 'ID', 'MessageID'];
const SUBJECT_KEYS = ['Subject', 'SubjectNoHTML', 'MessageSubject'];
const SENDER_KEYS = ['From', 'FromName', 'Sender', 'StaffName'];
const ROLE_KEYS = ['Role', 'FromRole', 'StaffType', 'SenderType'];
const EMAIL_KEYS = ['Email', 'FromEmail', 'StaffEmail'];
const DATE_KEYS = ['SendDateTime', 'SendDate', 'MessageDate', 'Date', 'BeginDate'];
const CONTENT_KEYS = ['Content', 'MessageText', 'MessageBody', 'Body', 'Message'];
const ATTACHMENT_LIST_KEYS = ['Attachments', 'AttachmentXMLs', 'MessageAttachments'];
const ATTACHMENT_TOKEN_KEYS = ['SmAttachmentGU', 'AttachmentGU', 'DocumentGU', 'GU'];
const ATTACHMENT_NAME_KEYS = ['AttachmentName', 'DocumentName', 'FileName', 'Name'];
const ROW_KEYS = [...SUBJECT_KEYS, ...DATE_KEYS, ...CONTENT_KEYS];

const firstString = (row: Record<string, unknown>, keys: string[]): string => {
	for (const key of keys) {
		const value = asString(row[key]);
		if (value) return value;
	}
	return '';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

interface Anchor {
	href: string;
	text: string;
}

function anchors(html: string): Anchor[] {
	const out: Anchor[] = [];
	const re = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
	for (const match of html.matchAll(re)) {
		out.push({
			href: decodeEntities(match[1] ?? match[2] ?? '').trim(),
			text: stripTags(match[3] ?? '')
		});
	}
	return out;
}

// Only links that work outside the portal; javascript: and portal-relative hrefs
// are dropped rather than rendered as dead ends.
const contentLinks = (html: string): MailLink[] =>
	anchors(html)
		.filter((a) => /^https?:\/\//i.test(a.href))
		.map((a) => ({ label: a.text || a.href, url: a.href }));

const contentParagraphs = (html: string): string[] =>
	html
		.split(/<\/(?:p|div|li|h[1-6]|tr|table)>|<br\s*\/?>/gi)
		.map((part) => stripTags(part))
		.filter((text) => text !== '');

function toAttachments(row: Record<string, unknown>): MailAttachment[] {
	for (const key of ATTACHMENT_LIST_KEYS) {
		const value = row[key];
		if (Array.isArray(value)) {
			return value.filter(isRecord).flatMap((entry) => {
				const token = firstString(entry, ATTACHMENT_TOKEN_KEYS);
				if (!token) return [];
				return [{ token, name: stripTags(firstString(entry, ATTACHMENT_NAME_KEYS)) || 'Attachment' }];
			});
		}
		if (typeof value === 'string' && value !== '') {
			return anchors(value).flatMap(({ href, text }) => {
				const token = /SmAttachmentGU=([^"&']+)/i.exec(href)?.[1] ?? href;
				if (!token) return [];
				return [{ token, name: text || 'Attachment' }];
			});
		}
	}
	return [];
}

function toMessage(row: Record<string, unknown>, index: number): unknown {
	const contentHtml = firstString(row, CONTENT_KEYS);
	const senderHtml = firstString(row, SENDER_KEYS);
	const email =
		stripTags(firstString(row, EMAIL_KEYS)) ||
		decodeEntities(/mailto:([^"'?>]+)/i.exec(senderHtml)?.[1] ?? '');
	const role = stripTags(firstString(row, ROLE_KEYS));
	return {
		id: firstString(row, ID_KEYS) || `msg-${index + 1}`,
		subject: stripTags(firstString(row, SUBJECT_KEYS)),
		sender: {
			name: stripTags(senderHtml),
			...(role ? { role } : {}),
			...(email ? { email } : {})
		},
		date: toIsoDate(stripTags(firstString(row, DATE_KEYS))),
		body: contentParagraphs(contentHtml),
		links: contentLinks(contentHtml),
		attachments: toAttachments(row)
	};
}

export async function fetchMail(
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<Mailbox> {
	const page = await getPage(session, PAGE, options);
	assertNotBounced(page, 'Messages');

	const rows = findDataSourceWithKeys(page.body, ROW_KEYS);
	const messages: MailMessage[] = [];
	let unreadableMessages = 0;

	// Per row, so one unexpected shape costs that row rather than the whole page. Only a
	// ParseError means "this row is not what we expected"; anything else is our own bug
	// and must still surface.
	for (const [index, row] of rows.entries()) {
		try {
			messages.push(validate(MailMessageSchema, toMessage(row, index), `message row ${index + 1}`));
		} catch (error) {
			if (!(error instanceof ParseError)) throw error;
			unreadableMessages++;
		}
	}

	return validate(MailboxSchema, { messages, unreadableMessages }, 'mail');
}

export async function downloadMailAttachment(
	session: PortalSession,
	token: string,
	options: FetchFollowOptions = {}
): Promise<DocumentContent> {
	// A token may be a bare GU or a full href scraped from the message row.
	const url = /^https?:\/\//i.test(token)
		? token
		: portalUrl(
				session,
				token.includes('.aspx')
					? token.replace(/^\//, '')
					: `${ATTACHMENT_PAGE}${encodeURIComponent(token)}`
			);
	const { response } = await fetchFollowRaw(url, { method: 'GET' }, session.jar, options);

	const contentType = response.headers.get('content-type') ?? '';
	if (!response.ok || contentType.includes('text/html')) {
		throw new ModuleUnavailableError(
			'The portal could not download this attachment. Its link may have expired.'
		);
	}

	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		mimeType: contentType.split(';')[0]?.trim() || 'application/octet-stream',
		fileName: fileNameFrom(response.headers.get('content-disposition'), 'attachment.pdf')
	};
}
