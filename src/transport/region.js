// Which US coast the user is closer to, read from the browser's timezone - no
// network request, no permission prompt, nothing sent anywhere. The IANA zone
// name is checked against the known Mountain-and-westward zones first (immune
// to DST shifting the raw offset); anything unrecognized falls back to the
// UTC offset, split at UTC-6:30 so Mountain and westward routes west, Central
// and eastward routes east. The answer only decides which relay serves which
// lane, so a wrong guess costs a few dozen milliseconds of latency - never
// correctness.

const WEST_ZONES = new Set([
	'America/Los_Angeles',
	'America/Vancouver',
	'America/Tijuana',
	'America/Denver',
	'America/Phoenix',
	'America/Boise',
	'America/Edmonton',
	'America/Whitehorse',
	'America/Dawson',
	'America/Dawson_Creek',
	'America/Fort_Nelson',
	'America/Anchorage',
	'America/Juneau',
	'America/Sitka',
	'America/Metlakatla',
	'America/Nome',
	'America/Yakutat',
	'America/Adak',
	'Pacific/Honolulu'
]);

// Overrides exist for tests; the app calls this bare.
export function userRegion({ timeZone, offsetMinutes } = {}) {
	let zone = timeZone;
	if (zone === undefined) {
		try {
			zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			zone = null;
		}
	}
	if (zone && WEST_ZONES.has(zone)) return 'west';
	// getTimezoneOffset: minutes WEST of UTC (PST 480, MST 420, CST 360, EST 300).
	const mins = offsetMinutes !== undefined ? offsetMinutes : new Date().getTimezoneOffset();
	return mins >= 390 ? 'west' : 'east';
}
