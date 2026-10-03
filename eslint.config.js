import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Build output, dependencies, and the generated card module. The generated
    // file is machine-written, so linting it would only report noise.
    ignores: ["dist/", "node_modules/", "coverage/", "src/generated/"],
  },

  js.configs.recommended,

  {
    // Type-aware rules, scoped to TypeScript sources so that plain JS config
    // files are not required to belong to a tsconfig.
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        // `tsconfig.json` covers the app. Build scripts and the Vite config
        // live in `tsconfig.node.json` but are not referenced by it, so they
        // are listed explicitly and linted against that project instead.
        projectService: {
          allowDefaultProject: ["scripts/*.ts", "*.config.ts"],
          defaultProject: "tsconfig.node.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    // Application source: browser globals.
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },

  {
    // Build scripts and Vite config: Node globals, no JSX.
    files: ["scripts/**/*.ts", "*.config.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    // Tests deliberately feed malformed values to prove runtime validation,
    // which requires casts the strict rules would otherwise reject.
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  // Last, so it can turn off formatting rules that conflict with Prettier.
  prettier,
);
