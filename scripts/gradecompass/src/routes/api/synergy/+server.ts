/**
 * Server-side proxy between the browser and a Synergy (StudentVUE) web portal.
 *
 * Edupoint deprecated the old stateless mobile SOAP API (it now returns error
 * D5518-00 for every request). The modern web portal API is session-cookie based
 * and cannot be called with credentials cross-origin from the browser, so this
 * endpoint performs the login server-side, fetches the requested data, and returns
 * it in the *legacy* SOAP-enveloped XML shape the client already parses.
 *
 * Credentials are passed through per request and never persisted (only a derived
 * cookie jar is cached in memory briefly; see session.ts).
 */

import { Operation, wrapEnvelope } from '$lib/synergy';
import * as client from '$lib/server/synergy/client';
import { SynergyDataError } from '$lib/server/synergy/client';
import { SynergyAuthError } from '$lib/server/synergy/login';
import { getSession, invalidateSession } from '$lib/server/synergy/session';
import { json, type RequestHandler } from '@sveltejs/kit';

export const prerender = false;

interface ProxyRequest {
	domain: string;
	userID: string;
	password: string;
	methodName: string;
	params?: Record<string, unknown>;
}

const escapeAttr = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/** Mirror the old API's error channel: an RT_ERROR inside a normal 200 envelope. */
const errorEnvelope = (message: string): string =>
	wrapEnvelope(`<RT_ERROR ERROR_MESSAGE="${escapeAttr(message)}" />`, Operation.Request);

const xml = (body: string, status = 200): Response =>
	new Response(body, {
		status,
		headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' }
	});

export const POST: RequestHandler = async ({ request }) => {
	let payload: ProxyRequest;
	try {
		payload = await request.json();
	} catch {
		return json({ message: 'Invalid request body' }, { status: 400 });
	}

	const { domain, userID, password, methodName, params = {} } = payload;
	if (!domain || !userID || !password || !methodName) {
		return json({ message: 'Missing domain, credentials, or methodName' }, { status: 400 });
	}

	const credentials = { domain, username: userID, password };

	try {
		const session = await getSession(credentials);

		let inner: string;
		switch (methodName) {
			case 'StudentInfo':
				inner = await client.studentInfo(session);
				break;
			case 'Gradebook':
				inner = await client.gradebook(session, params.ReportPeriod as number | undefined);
				break;
			case 'Attendance':
				inner = await client.attendance(session);
				break;
			case 'GetStudentDocumentInitialData':
				inner = await client.documents(session);
				break;
			case 'GetReportCardDocumentData':
				inner = await client.reportCard(session, String(params.DocumentGU ?? ''));
				break;
			case 'SynergyMailGetData':
				inner = await client.mailData(session);
				break;
			case 'SynergyMailGetAttachment':
				inner = await client.attachment(session, String(params.SmAttachmentGU ?? ''));
				break;
			default:
				return xml(errorEnvelope(`Unsupported method: ${methodName}`));
		}

		return xml(wrapEnvelope(inner, Operation.Request));
	} catch (error) {
		if (error instanceof SynergyAuthError) {
			return xml(errorEnvelope(error.message));
		}
		if (error instanceof SynergyDataError) {
			// Session may have expired mid-flight; drop it so the next call re-logs in.
			invalidateSession(credentials);
			return xml(errorEnvelope(error.message));
		}
		console.error('Synergy proxy error:', error);
		invalidateSession(credentials);
		return xml(
			errorEnvelope('Could not reach StudentVUE. Please try again in a moment.')
		);
	}
};
