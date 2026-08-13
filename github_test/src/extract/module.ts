import { ModuleUnavailableError } from '../portal/errors';
import type { PageResult } from '../portal/http';

export function assertNotBounced(
	page: Pick<PageResult, 'redirected' | 'finalUrl'>,
	moduleName: string
): void {
	if (page.redirected) {
		throw new ModuleUnavailableError(
			`${moduleName} is unavailable. The portal redirected to ${new URL(page.finalUrl).pathname}.`
		);
	}
}
