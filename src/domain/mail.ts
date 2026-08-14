import { z } from 'zod';
import { IsoDateString } from './common';

export const MailLinkSchema = z.object({
	label: z.string().min(1),
	url: z.string().min(1)
});

export const MailAttachmentSchema = z.object({
	token: z.string().min(1),
	name: z.string().min(1)
});

export const MailSenderSchema = z.object({
	name: z.string().min(1),
	role: z.string().optional(),
	email: z.string().optional()
});

// `body` remains the plain-text fallback used by demo data and older snapshots.
// Real messages may also carry the portal's original rich HTML; the reader must
// sanitize it before rendering.
export const MailMessageSchema = z.object({
	id: z.string().min(1),
	subject: z.string().min(1),
	sender: MailSenderSchema,
	date: IsoDateString,
	body: z.array(z.string()),
	bodyHtml: z.string().default(''),
	links: z.array(MailLinkSchema),
	attachments: z.array(MailAttachmentSchema),
	// The portal's message list carries no body - only the per-message call does.
	// This keeps "not fetched yet" distinguishable from "genuinely empty", so the
	// reader knows to load it and the list knows whether it can show a preview.
	bodyLoaded: z.boolean().default(true),
	// Known from the list before any body is fetched, so the list can flag
	// attachments it cannot yet count.
	hasAttachments: z.boolean().default(false),
	// Needed verbatim when re-requesting the message from the portal.
	isSystemMessage: z.boolean().default(false)
});

export const MailboxSchema = z.object({
	messages: z.array(MailMessageSchema),
	// Rows the parser could not read. Surfaced rather than hidden: a short message list
	// could silently hide an "action needed" notice from the school.
	unreadableMessages: z.number().int().min(0).default(0)
});

export type MailLink = z.infer<typeof MailLinkSchema>;
export type MailAttachment = z.infer<typeof MailAttachmentSchema>;
export type MailSender = z.infer<typeof MailSenderSchema>;
export type MailMessage = z.infer<typeof MailMessageSchema>;
export type Mailbox = z.infer<typeof MailboxSchema>;
