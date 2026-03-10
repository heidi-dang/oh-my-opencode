import type { LanguagePack } from "../types"

export const typescriptPack: LanguagePack = {
  language: "typescript",
  displayName: "TypeScript",
  rules: [
    "Always check `tsconfig.json` for the module system (ESM vs CJS) before writing imports.",
    "Use the project's existing package manager (bun/pnpm/npm/yarn) — never mix lockfiles.",
    "Prefer strict TypeScript — avoid `any`, `@ts-ignore`, `@ts-expect-error`.",
    "Check if the project uses path aliases (`@/`, `~/`) in tsconfig.json before importing.",
    "Respect the project's barrel exports — import from index.ts, not deep paths, unless the project avoids barrels.",
    "For ESM projects: use `.js` extension in imports even for `.ts` files (TypeScript ESM resolution).",
    "Never use `require()` in ESM projects — use `import` or `await import()`.",
    "Check `package.json` `type` field: `module` = ESM, `commonjs` or absent = CJS.",
    "Run `tsc --noEmit` for type checking — don't rely on IDE alone.",
    "Always match existing code style for semicolons, quotes, and indentation.",
  ],
  repairSteps: {
    "TS2307": [
      "1. Module not found — check if the package is installed: `npm ls <package>`",
      "2. Check tsconfig `paths` and `baseUrl` for path aliases",
      "3. Check if `@types/<package>` is needed: `npm install -D @types/<package>`",
      "4. For local modules: verify the import path and file extension",
    ],
    "TS2345": [
      "1. Type mismatch in argument — read the expected vs actual types",
      "2. Check if a type assertion or generic parameter is needed",
      "3. Check if the function signature changed in a recent update",
    ],
    "TS2322": [
      "1. Type not assignable — compare the source and target types",
      "2. Check for missing optional properties",
      "3. Check for union type narrowing",
    ],
    "ESM-CJS-mismatch": [
      "1. Check package.json `type` field",
      "2. If ESM: use `import/export`, `.js` extensions in imports",
      "3. If CJS: use `require()`/`module.exports`",
      "4. For mixed: check tsconfig `module` and `moduleResolution`",
    ],
    "build-error": [
      "1. Run `tsc --noEmit` to see all errors",
      "2. Fix errors in dependency order (types → interfaces → implementations)",
      "3. Check for circular dependencies using `madge --circular`",
    ],
    "dev-server-crash": [
      "1. Check if the port is in use: `lsof -i :<port>`",
      "2. Check for syntax errors in config files (vite.config.ts, next.config.js)",
      "3. Clear caches: `rm -rf .next node_modules/.cache`",
      "4. Reinstall deps: `rm -rf node_modules && npm install`",
    ],
  },
  commandRecipes: {
    "install-npm": "npm install",
    "install-pnpm": "pnpm install",
    "install-bun": "bun install",
    "dev-npm": "npm run dev",
    "dev-bun": "bun run dev",
    "build": "npm run build",
    "typecheck": "tsc --noEmit",
    "test-jest": "npx jest --passWithNoTests",
    "test-vitest": "npx vitest run",
    "test-bun": "bun test",
    "lint": "npx eslint . --fix",
    "format": "npx prettier --write .",
  },
  failureSignatures: [
    { pattern: "Cannot find module", diagnosis: "Module not installed or wrong import path", fix: ["npm install <module>", "Check tsconfig paths", "Check file extension"] },
    { pattern: "TS2307", diagnosis: "Cannot find module or type declarations", fix: ["Install the package", "Install @types/<package>", "Check tsconfig paths"] },
    { pattern: "TS2345", diagnosis: "Argument of type X is not assignable to parameter of type Y", fix: ["Check function signature", "Add type assertion if safe", "Fix the argument type"] },
    { pattern: "TS2322", diagnosis: "Type X is not assignable to type Y", fix: ["Compare types", "Check for missing properties", "Use type narrowing"] },
    { pattern: "TS2339", diagnosis: "Property does not exist on type", fix: ["Check the type definition", "Use type guard", "Extend the interface"] },
    { pattern: "ERR_MODULE_NOT_FOUND", diagnosis: "ESM module resolution failure", fix: ["Add .js extension to import", "Check package.json exports field", "Check type: module"] },
    { pattern: "SyntaxError: Cannot use import statement outside a module", diagnosis: "ESM/CJS mismatch", fix: ["Add type: module to package.json", "Or use require() instead", "Check tsconfig module setting"] },
    { pattern: "ERR_REQUIRE_ESM", diagnosis: "Trying to require() an ESM-only package", fix: ["Use dynamic import: await import()", "Or find a CJS alternative"] },
    { pattern: "EADDRINUSE", diagnosis: "Port already in use", fix: ["Kill the process: lsof -i :<port>", "Use a different port", "Wait for the previous process to exit"] },
    { pattern: "Module build failed", diagnosis: "Bundler error (webpack/vite/esbuild)", fix: ["Check the error details", "Verify loader config", "Check for unsupported syntax"] },
    { pattern: "ENOENT", diagnosis: "File or directory not found", fix: ["Check the path", "Verify CWD", "Check if build step is needed first"] },
    { pattern: "Cannot read properties of undefined", diagnosis: "Runtime null/undefined access", fix: ["Add null checks", "Check data flow", "Verify API response shape"] },
  ],
  importPatterns: `TypeScript import conventions:
- Use the project's path aliases if defined in tsconfig.json
- Group: external packages → internal modules → relative imports
- For ESM: include .js extension even for .ts source files
- Prefer named exports over default exports
- Use barrel imports (from index.ts) when the project uses them`,
  buildFlow: `TypeScript build flow:
1. Install deps with the project's package manager (check lockfile)
2. Type check: tsc --noEmit
3. Build: npm/bun/pnpm run build
4. Run: npm/bun/pnpm run dev (development) or npm start (production)`,
  testFlow: `TypeScript test flow:
1. Check test framework: jest (jest.config), vitest (vitest.config), bun:test (bunfig.toml)
2. Run tests: npx jest / npx vitest run / bun test
3. For specific test: npx jest <path> / npx vitest run <path> / bun test <path>
4. Watch mode: npx jest --watch / npx vitest / bun test --watch`,
  lintFlow: `TypeScript lint flow:
1. ESLint: npx eslint . --fix
2. Prettier: npx prettier --write .
3. Biome: npx biome check --apply .
4. TypeScript strict: tsc --noEmit --strict`,
}
