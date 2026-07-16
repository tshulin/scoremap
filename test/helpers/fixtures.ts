import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const portalFixture = (name: string): string =>
	readFileSync(fileURLToPath(new URL(`../fixtures/portal/${name}`, import.meta.url)), 'utf8');
