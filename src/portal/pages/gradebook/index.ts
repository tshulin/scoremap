import type { Gradebook } from '../../../domain/index';
import { NoActiveGradingPeriodError, ParseError } from '../../errors';
import type { FetchFollowOptions } from '../../http';
import type { PortalSession } from '../../login';
import { getPage } from '../shared';

export { rawAssignmentToDomain } from './assignment';

// Period selection cannot be implemented until an active gradebook response is available.
const gradebookPath = (_periodIndex?: number): string => 'PXP2_Gradebook.aspx?AGU=0';

export async function fetchGradebook(
	session: PortalSession,
	periodIndex?: number,
	options: FetchFollowOptions = {}
): Promise<Gradebook> {
	const page = await getPage(session, gradebookPath(periodIndex), options);

	if (page.redirected) {
		throw new NoActiveGradingPeriodError('The portal has no active grading period.');
	}

	throw new ParseError('Gradebook parsing is not implemented for this page yet.');
}
