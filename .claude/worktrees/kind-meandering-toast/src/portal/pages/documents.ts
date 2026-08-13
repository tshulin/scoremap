import { DocumentMetaSchema, type DocumentContent, type DocumentMeta } from '../../domain/index';
import {
	assertNotBounced,
	findDataSourceWithKeys,
	stripTags,
	toIsoDate
} from '../../extract/index';
import { ModuleUnavailableError } from '../errors';
import { fetchFollowRaw, type FetchFollowOptions } from '../http';
import type { PortalSession } from '../login';
import { asString, getPage, portalUrl, validate } from './shared';

const PAGE = 'PXP2_Documents.aspx?AGU=0';
const DOWNLOAD_PAGE = 'PXP_ShowDocument.aspx?AGU=&docToken=';

const docTokenOf = (titleHtml: string): string => /docToken=([^"&\\]+)/.exec(titleHtml)?.[1] ?? '';

export async function fetchDocuments(
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<DocumentMeta[]> {
	const page = await getPage(session, PAGE, options);
	assertNotBounced(page, 'Documents');

	const rows = findDataSourceWithKeys(page.body, ['DocumentUploadDate', 'DocumentTitle']);
	return rows.map((row, index) => {
		const titleHtml = asString(row['DocumentTitle']);
		return validate(
			DocumentMetaSchema,
			{
				docToken: docTokenOf(titleHtml),
				title: stripTags(titleHtml),
				category: asString(row['DocumentCategory']),
				uploadDate: toIsoDate(asString(row['DocumentUploadDate']))
			},
			`document row ${index + 1}`
		);
	});
}

export function fileNameFrom(disposition: string | null, fallback = 'document.pdf'): string {
	if (!disposition) return fallback;
	const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition)?.[1];
	if (encoded) {
		try {
			return decodeURIComponent(encoded.trim().replace(/^"|"$/g, '')) || fallback;
		} catch {
			// Try the plain filename form below.
		}
	}
	return /filename="?([^";]+)"?/i.exec(disposition)?.[1]?.trim() || fallback;
}

export async function downloadDocument(
	session: PortalSession,
	docToken: string,
	options: FetchFollowOptions = {}
): Promise<DocumentContent> {
	const { response } = await fetchFollowRaw(
		portalUrl(session, `${DOWNLOAD_PAGE}${encodeURIComponent(docToken)}`),
		{ method: 'GET' },
		session.jar,
		options
	);

	const contentType = response.headers.get('content-type') ?? '';
	if (!response.ok || contentType.includes('text/html')) {
		throw new ModuleUnavailableError(
			'The portal could not download this document. Its link may have expired.'
		);
	}

	return {
		bytes: new Uint8Array(await response.arrayBuffer()),
		mimeType: contentType.split(';')[0]?.trim() || 'application/pdf',
		fileName: fileNameFrom(response.headers.get('content-disposition'))
	};
}
