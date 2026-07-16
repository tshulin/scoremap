import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		// These scripts predate the TypeScript backend and are kept as reference tools.
		ignores: ['node_modules/', 'gradecompass/', 'legacy/', 'lib/', 'captures/', '*.mjs']
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	prettier,
	{
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [{ group: ['bun:*'], message: 'Backend targets Node — no Bun APIs.' }]
				}
			],
			'no-restricted-globals': [
				'error',
				{ name: 'Bun', message: 'Backend targets Node — no Bun APIs.' }
			]
		}
	}
);
