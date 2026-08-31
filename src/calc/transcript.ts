export interface TranscriptGpa {
	district: 'Pleasanton Unified School District';
	unweighted: number;
	weighted: number;
	credits: number;
}

const readNumber = (text: string, pattern: RegExp, label: string) => {
	const match = text.match(pattern);
	if (!match) throw new Error(`Could not find ${label} in this transcript.`);
	const value = Number(match[1]);
	if (!Number.isFinite(value)) throw new Error(`Could not read ${label} in this transcript.`);
	return value;
};

export function parsePleasantonTranscriptText(text: string): TranscriptGpa {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!/Pleasanton Unified/i.test(normalized)) {
		throw new Error('Automatic transcript reading currently supports Pleasanton Unified transcripts only.');
	}
	const unweighted = readNumber(normalized, /Overall GPA\s*([0-5](?:\.\d+)?)/i, 'overall GPA');
	const weighted = readNumber(normalized, /Overall Weighted\s*([0-5](?:\.\d+)?)/i, 'overall weighted GPA');
	const creditMatches = [...normalized.matchAll(/Cred\s*Cmp\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi)];
	const credits = creditMatches.reduce((sum, match) => sum + Number(match[1]), 0);
	if (credits <= 0) throw new Error('Could not determine completed credits from this transcript.');
	return { district: 'Pleasanton Unified School District', unweighted, weighted, credits };
}
