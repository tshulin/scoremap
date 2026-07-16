import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const ROOT_MARKERS = ['package.json', '.git', 'env.example'];

export function repoRoot() {
	if (process.env.GRADEMAX_ROOT) return path.resolve(process.env.GRADEMAX_ROOT);
	for (let dir = here; ; ) {
		if (ROOT_MARKERS.some((m) => existsSync(path.join(dir, m)))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return path.join(here, '..', '..');
}

export async function capturesDir() {
	const dir = path.join(repoRoot(), 'captures');
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, '.gitignore'), '*\n!.gitignore\n', { flag: 'wx' }).catch(() => {});
	return dir;
}
