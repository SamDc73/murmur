// ESLint — only what Biome can't do. Biome is the main linter: formatting,
// JSX and React correctness, rules of hooks, exhaustive deps, import cycles,
// a11y, unused code. This adds the react-best-practices checks a syntax
// linter can't see: React's own compiler-based rules (renders stay pure, refs
// aren't read while rendering, no setState inside effects, no components made
// during render…) and the "you might not need an effect" patterns (derived
// state, chained updates, effects that belong in an event handler).

import reactHooks from "eslint-plugin-react-hooks"
import effects from "eslint-plugin-react-you-might-not-need-an-effect"

export default [
	{
		ignores: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "app/android/**"],
	},
	{
		files: ["app/**/*.{js,jsx}"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		plugins: {
			"react-hooks": reactHooks,
			"react-you-might-not-need-an-effect": effects,
		},
		rules: {
			...reactHooks.configs["recommended-latest"].rules,
			// Biome's useHookAtTopLevel and useExhaustiveDependencies own these two.
			"react-hooks/rules-of-hooks": "off",
			"react-hooks/exhaustive-deps": "off",
			...effects.configs.strict.rules,
		},
	},
]
