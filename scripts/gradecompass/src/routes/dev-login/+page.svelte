<script lang="ts">
	// TEMPORARY dev-only convenience: preset a fake "logged in" token so the
	// authed pages load straight away against the MSW mock data (no real login).
	// Delete src/routes/dev-login/ before shipping.
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { LocalStorageKey } from '$lib';
	import { loadStudentAccount } from '$lib/account.svelte';

	if (browser) {
		// Start from a clean slate so any stale/broken cached gradebook is discarded
		// and the current mock fixtures are re-fetched.
		localStorage.clear();
		localStorage.setItem(
			LocalStorageKey.token,
			JSON.stringify({ username: 'demo', password: 'demo', domain: 'ca-pleas-psv.edupoint.com' })
		);
		loadStudentAccount();
		void goto('/documents');
	}
</script>

<p style="padding:2rem;font-family:system-ui">Setting up demo session… taking you to Documents.</p>
