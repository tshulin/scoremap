/**
 * lib/paths.mjs
 * ---------------------------------------------------------------------------
 * Single task: resolve filesystem locations. The ONLY place in scripts/ that
 * knows where anything lives — no other script computes a path from `../..`.
 *
 * Resolution strategy (to implement):
 *   1. If GRADEMAX_ROOT env var is set, use it.
 *   2. Otherwise walk up from this file until a directory containing
 *      package.json is found.
 * This keeps the scripts working even if the folder is moved or copied.
 */

/** Absolute path to the repo root. */
export function repoRoot() {
	throw new Error('TODO: implement repoRoot() — GRADEMAX_ROOT env var, else walk up to package.json');
}

/** Absolute path to captures/ (raw portal dumps — gitignored, personal data). Creates it if missing. */
export async function capturesDir() {
	throw new Error('TODO: implement capturesDir() — <repoRoot>/captures, mkdir -p');
}
