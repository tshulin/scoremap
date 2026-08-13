import { z } from 'zod';
import { IsoDateString } from './common.js';

export const DocumentMetaSchema = z.object({
	docToken: z.string(),
	title: z.string(),
	category: z.string(),
	uploadDate: IsoDateString
});

export type DocumentMeta = z.infer<typeof DocumentMetaSchema>;

export interface DocumentContent {
	bytes: Uint8Array;
	mimeType: string;
	fileName: string;
}
