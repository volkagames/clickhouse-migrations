# Changelog

## 2.0.1 (2025-11-25)


### Features

* [[#1](https://github.com/volkagames/clickhouse-migrations/issues/1)] improve comments ([0c24d4a](https://github.com/volkagames/clickhouse-migrations/commit/0c24d4afca157024ce0a24caacae62a5b069e229))
* [[#13](https://github.com/volkagames/clickhouse-migrations/issues/13)] added --engine option and CH_MIGRATION_ENGINE env for providing ON CLUSTER and/or ENGINE clauses when initially db is created ([9ecdcc2](https://github.com/volkagames/clickhouse-migrations/commit/9ecdcc21793830bdedfd7e8a27103742d6c52aa3))
* add configurable migration table name with default '_migrations' ([b31d613](https://github.com/volkagames/clickhouse-migrations/commit/b31d6139d9877a750c48668b155c65fcfb2d8f5d))
* add ds_store to ignore ([752c1fa](https://github.com/volkagames/clickhouse-migrations/commit/752c1fa5efb6f39ed85a9aad95131ac1c871a03e))
* add github workflow ([d033b42](https://github.com/volkagames/clickhouse-migrations/commit/d033b4208dba20dfd73fa492c304791fa19cbf68))
* add structured JSON logging with severity levels, filtering, and custom prefixes ([69c7d53](https://github.com/volkagames/clickhouse-migrations/commit/69c7d5303c5afe6ea8640ae4adfa4f2c2c262bfd))
* add supporting query settings, add more tests ([56ab433](https://github.com/volkagames/clickhouse-migrations/commit/56ab4337830aa2922e72292dfbe22ecbdbe73292))
* add tests workflow ([d288166](https://github.com/volkagames/clickhouse-migrations/commit/d288166dc59b1422a573a01d37c3159cd4641719))
* add ts eslint parser ([7d8341b](https://github.com/volkagames/clickhouse-migrations/commit/7d8341bf7889740966cbfdec27aa9eda266882e2))
* avoid imidiately close connection ([21cfcb0](https://github.com/volkagames/clickhouse-migrations/commit/21cfcb0b036d7dcf9e8c035f3330f38480211e7a))
* correct connection parameters ([351becc](https://github.com/volkagames/clickhouse-migrations/commit/351becce38b051cf8f26fe09ff6de1bd4803a888))
* correct options name, use env variables as default for options ([5eddb48](https://github.com/volkagames/clickhouse-migrations/commit/5eddb480b02f215020f4f6eeff3c2ed3fd7d6670))
* early ignore non sql files in the migration folder ([5de5749](https://github.com/volkagames/clickhouse-migrations/commit/5de57493498a48fbb460d113e1d858806adc924c))
* enhance TLS support with certificate generation and improved authentication ([8acaff2](https://github.com/volkagames/clickhouse-migrations/commit/8acaff27e36498b2b5bd1b8a66a0bb78a454b09f))
* export for in-ts use ([5a7394b](https://github.com/volkagames/clickhouse-migrations/commit/5a7394b45397188753587c4efacce5e02c238d6b))
* export for in-ts use ([5e90852](https://github.com/volkagames/clickhouse-migrations/commit/5e90852159ad6120a8937fa2a0e9b928ba44fefe))
* fix lint errors ([93afe86](https://github.com/volkagames/clickhouse-migrations/commit/93afe864fe1f7eb4ac97ba55da8c695b2d14b5b2))
* fix linting error ([f1ba101](https://github.com/volkagames/clickhouse-migrations/commit/f1ba101285efebeb159cbcfe00e3cfc6f26241ec))
* fix workflow and disable automatic publishing ([b84f4a3](https://github.com/volkagames/clickhouse-migrations/commit/b84f4a3e7067225e028dbf3e5a92fece04a4524b))
* fix workflows ([d946de9](https://github.com/volkagames/clickhouse-migrations/commit/d946de983faffbb52cb4cdc1a1e5b7f764f616e9))
* ignore child directories and non sql files ([e02d23d](https://github.com/volkagames/clickhouse-migrations/commit/e02d23dbc2c9032e0588b86c27afb3d2b652e7cf))
* improve error message if migration directory not exist ([e2cffde](https://github.com/volkagames/clickhouse-migrations/commit/e2cffde98636e741976fe91307877e7c8f399593))
* improve parsing comments in migrations ([421a8e9](https://github.com/volkagames/clickhouse-migrations/commit/421a8e9ae9b7ff202b3be71df8f5f00e1197ec2d))
* improve readme ([3407b0c](https://github.com/volkagames/clickhouse-migrations/commit/3407b0cab635b50d6271866453a704a0658e03f5))
* improve readme file ([57525e7](https://github.com/volkagames/clickhouse-migrations/commit/57525e749c298539135d0335c757eacf293ee077))
* improve tests ([9703d6e](https://github.com/volkagames/clickhouse-migrations/commit/9703d6eec8d82d169e3512256e7dd92cef0407e2))
* improve types usage ([a632b27](https://github.com/volkagames/clickhouse-migrations/commit/a632b2707947aab9bf283bfa3ec54cf76511b06a))
* migrate to Rollup with ESM/CJS dual-package support ([5f2658f](https://github.com/volkagames/clickhouse-migrations/commit/5f2658fe2568b5bfd479510799ec2f5a32d2b63e))
* provide correct type import for clickhouse client ([af4c5fd](https://github.com/volkagames/clickhouse-migrations/commit/af4c5fd8ebbea87ff415300e9363fc280e35afca))
* remove unused ClickHouseClientConfigOptions type ([693fe18](https://github.com/volkagames/clickhouse-migrations/commit/693fe188fb0f45ef9616173e87e853bec2e9a660))
* revert for creating db ([9e47dd8](https://github.com/volkagames/clickhouse-migrations/commit/9e47dd88f30ebcb570b4704b47c2b8d970722a3d))
* support tls connection ([#25](https://github.com/volkagames/clickhouse-migrations/issues/25)) ([#26](https://github.com/volkagames/clickhouse-migrations/issues/26)) ([#14](https://github.com/volkagames/clickhouse-migrations/issues/14)) ([e3bf5b5](https://github.com/volkagames/clickhouse-migrations/commit/e3bf5b54eb51213cb0172cda4008cc266b9fbd09))
* update clickhause client to 1.5.0 and related packages ([ed110bb](https://github.com/volkagames/clickhouse-migrations/commit/ed110bb9fb3442c9beaae4ff45a3b3c37ed06e6a))
* update package versions, update eslinter conf ([9d9e5ff](https://github.com/volkagames/clickhouse-migrations/commit/9d9e5ffe0bcf88fd536a1547b6647c2483df67b2))
* update packages ([d9fec9a](https://github.com/volkagames/clickhouse-migrations/commit/d9fec9a142502478ec676caea54dda85112e2444))
* update packages to latest version ([4125b31](https://github.com/volkagames/clickhouse-migrations/commit/4125b3128d4fbd4ffe31c0170801b24ec2e0bc42))
* update release workflow to use OIDC Trusted Publisher for npm publishing to enhance security and simplify authentication process ([f5d78f0](https://github.com/volkagames/clickhouse-migrations/commit/f5d78f02a14a04ee170c51129cf7a7d826131541))
* update to eslint 9, update dependencies ([f91cf7d](https://github.com/volkagames/clickhouse-migrations/commit/f91cf7d83bbccde937de00206092e0474a885fac))
* update version ([e6ad270](https://github.com/volkagames/clickhouse-migrations/commit/e6ad27048a5c9022d53565e9436bc4a3b8365c76))


### Bug Fixes

* cleanup import syntax and type definitions ([eced934](https://github.com/volkagames/clickhouse-migrations/commit/eced934c34409f61f2a8d3b04d69984f52b8e1d7))
* correct test parameter order and environment handling ([d8177f5](https://github.com/volkagames/clickhouse-migrations/commit/d8177f54b51ef91f6b3f552b32b95d2f62909cbf))
* ensure client is closed on connection or database creation errors to prevent resource leaks ([c3ef138](https://github.com/volkagames/clickhouse-migrations/commit/c3ef1380edddac6accd839eec409a8cc2f81edfc))
* improve migration version parsing and add duplicate detection ([7e216d2](https://github.com/volkagames/clickhouse-migrations/commit/7e216d2c8e3d0bdf81411c090e585f366490f58e))
* improve SET statement parsing to handle edge cases ([302ed69](https://github.com/volkagames/clickhouse-migrations/commit/302ed696b4052e4fd72a0a4732d0fed2f60e3d11))
* make linter happy ([dfb36e4](https://github.com/volkagames/clickhouse-migrations/commit/dfb36e4695b7732f3677435f965b533bbe00c743))
* **package.json:** add src directory mapping to package.json for better module resolution ([e82000d](https://github.com/volkagames/clickhouse-migrations/commit/e82000d3f6cce321667fac5054e5a81a2e352a80))
* replace runtime package.json reading with compile-time JSON import for better bundler compatibility ([d81782e](https://github.com/volkagames/clickhouse-migrations/commit/d81782e53c1337d778141eafe0398ac7ccc513dd))
* set correct default db engine for opensource or cloud CH ([#30](https://github.com/volkagames/clickhouse-migrations/issues/30)) ([6b1f02a](https://github.com/volkagames/clickhouse-migrations/commit/6b1f02a717884ccf1a9734ee49377dae828f37f3))


### Miscellaneous Chores

* release 1.0.2 ([f761a87](https://github.com/volkagames/clickhouse-migrations/commit/f761a875da5a6a8038467a4322ba5d0f3df87e9d))
* release 1.0.2 ([a194e0c](https://github.com/volkagames/clickhouse-migrations/commit/a194e0ccd316a0f4370995f9da19de02798c5777))
* release 1.0.3 ([3f50c00](https://github.com/volkagames/clickhouse-migrations/commit/3f50c00910d6c76fe2db1e8f3d963ee3451f5864))
* release 1.0.4 ([2b653e3](https://github.com/volkagames/clickhouse-migrations/commit/2b653e3cdcb0b5d7db0bcb47ab99dd6ae4dd389b))
* release 1.0.5 ([cb60c99](https://github.com/volkagames/clickhouse-migrations/commit/cb60c990c555b4e6b1e5ef85b486c435335dcba8))
* **release:** force version ([c1e832a](https://github.com/volkagames/clickhouse-migrations/commit/c1e832ac148e21f7f679ba5e164f18cc99390eba))

## [Unreleased]

## [2.0.1](https://github.com/volkagames/clickhouse-migrations/compare/v2.0.0...v2.0.1) (2025-11-25)

### Bug Fixes

* **Build Compatibility**: replace runtime package.json reading with compile-time JSON import for better bundler compatibility
  - Fixes issues with bundlers that don't support dynamic JSON imports
  - Improves compatibility with various build tools
  - Resolves module resolution edge cases

* **Code Quality**: fix linting issues to maintain code quality standards

## [2.0.0](https://github.com/volkagames/clickhouse-migrations/compare/v1.2.0...v2.0.0) (2025-11-24)

### Breaking Changes

* **Package Rename**: Package renamed from `clickhouse-migrations` to `@volkagames/clickhouse-migrations`
  - Update import statements to use new package name
  - This is a fork with active maintenance and governance

* **Build Output**: Build output directory changed from `lib` to `dist`
  - Update any direct references to built files
  - Binary path now `dist/cli.js` instead of `lib/cli.js`

* **Module System**: Full ESM/CJS dual-package support with Rollup
  - Package now provides both ESM (`dist/migrate.js`) and CJS (`dist/migrate.cjs`) builds
  - Better compatibility with modern JavaScript ecosystems
  - Proper `exports` field in package.json

* **Repository & Ownership**: Repository transferred to volkagames organization
  - New repository: https://github.com/volkagames/clickhouse-migrations
  - New npm package: @volkagames/clickhouse-migrations
  - Original author credited in contributors

### Features

* **Dual-Package Support**: migrate to Rollup with ESM/CJS dual-package support
  - Enable both ES modules and CommonJS compatibility
  - Improve module resolution and bundling
  - Better support for modern JavaScript ecosystems

* **Configurable Migration Table**: add configurable migration table name with default '_migrations'
  - Allow customization of migrations tracking table name
  - Improve flexibility for different deployment scenarios

* **Utility Functions Export**: export utility functions to make them accessible for external use and improve modularity
  - Enable programmatic access to internal utilities
  - Better integration with custom tooling

* **Structured Logging**: add structured JSON logging with severity levels, filtering, and custom prefixes
  - Support for JSON output format
  - Configurable log severity levels
  - Custom log prefixes for better log organization

* **DSN Support**: add Data Source Name (DSN) connection string support with ClickHouse settings via query parameters
  - Enable connection configuration through single DSN string
  - Support for ClickHouse settings as URL query parameters
  - Simplifies connection setup and configuration

* **Migration Status**: implement migration status command to view applied and pending migrations
  - Add `displayMigrationStatus` to exported functions
  - Show clear overview of migration state
  - Help track migration progress

* **Optional Authentication**: make username, password, and database optional parameters
  - More flexible authentication configuration
  - Support for environments with different security requirements

* **Password Security**: add password sanitization to prevent exposure in logs and error messages
  - Enforce DSN/params separation for better security
  - Protect sensitive credentials in output

* **Path Validation**: add `validateMigrationsHome` function to enhance security of migrations directory path handling
  - Prevent path traversal vulnerabilities
  - Ensure only valid paths are processed

* **Centralized Logging**: separate CLI logic and add centralized logger for consistent output handling

* **Documentation**: enhance installation instructions and clarify DSN usage
  - Add "Philosophy: Forward-Only Migrations" section to README clarifying migration strategy and rationale for no rollback support
  - Improve documentation for additional options

### Bug Fixes

* **Resource Management**: ensure client is closed on connection or database creation errors to prevent resource leaks

* **Import Cleanup**: cleanup import syntax and type definitions for better code consistency

* **SQL Injection**: fix multiple SQL injection vulnerabilities
  - Add validation for db_name and table_engine parameters
  - Update database creation query to use parameterized queries
  - Sanitize db_engine parameter to prevent malicious SQL injection

* **Migration Parsing**: improve migration version parsing and add duplicate version detection
  - Fix migration version parsing to handle edge cases
  - Detect and prevent duplicate migration versions

* **SET Statement Parsing**: improve SET statement parsing to handle edge cases

* **Test Fixes**: correct test parameter order and environment handling
  - Fix TLS unit tests by adding missing table_engine parameter
  - Fix CLI integration test to inherit process.env
  - Fix duplicate versions test error message
  - Ensure all unit and integration tests pass

* **Error Handling**: improve error handling for empty migrations array

* **SQL Parser**: fix unterminated block comments handling
  - Throw error for unterminated block comments
  - Preserve whitespace correctly in parsed SQL

### Code Refactoring

* **Module System**: migrate to ES2020 for improved module support and modern JavaScript features
  - Upgrade TypeScript target to ES2020
  - Better async/await support and language features
  - Improved compatibility with modern tooling

* **Build System**: migrate to Rollup for optimized dual-package builds
  - Generate both ESM and CJS outputs
  - Better tree-shaking and bundle optimization
  - Improved source mapping

* **Logger Architecture**: remove global logger instance for better modularity
  - Eliminate global state
  - Improve testability and flexibility
  - Enable better dependency injection

* **Type Definitions**: remove redundant cli.d.ts type separation
  - Consolidate type definitions
  - Improve type consistency

* **Test Framework**: migrate from Jest to Vitest
  - Improve test performance and developer experience
  - Better ESM support and faster execution
  - Apply Biome formatting and linting to test suite

* **Build Tooling**: migrate to Bun and Biome for modernized tooling
  - Replace npm/yarn with Bun for faster package management
  - Replace ESLint/Prettier with Biome for unified linting and formatting
  - Add preinstall hook to enforce Bun usage

* **Test Organization**: separate unit and integration tests for better test organization
  - Move authentication tests to E2E suite
  - Improve error handling in tests

* **Async Patterns**: refactor connect function to be asynchronous
  - Update file reading to use async/await
  - Better performance and error handling during TLS configuration

* **Package Configuration**: add src directory mapping to package.json for better module resolution

### Development

* **Git Hooks**: add Husky for automated code quality checks
  - pre-commit: Run unit tests, Biome check, and TypeScript validation
  - pre-push: Run full test suite and build verification
  - commit-msg: Enforce Conventional Commits format

* **VSCode Configuration**: add workspace settings for consistent development experience
  - Configure Biome as default formatter
  - Recommended extensions (Biome, Bun)
  - Optimal settings for TypeScript and Git workflows

## [1.2.0](https://github.com/VVVi/clickhouse-migrations/compare/v1.1.3...v1.2.0) (2025-11-21)


### Features

* **SQL Parser**: rewrite SQL parser with string-aware architecture for robust comment handling
  - Implement ParserStack and SqlParser classes for reusable, stateful parsing
  - Add string-aware block comment removal (handles `*/` inside strings)
  - Add string-aware line comment removal (handles `--`, `#` markers)
  - Add `splitByDelimiter` utility for proper query/SET extraction
  - Rename exports to camelCase (`sqlQueries`, `sqlSets`) with backwards-compatible aliases

* **Type Safety**: add type imports for MigrationBase, MigrationsRowData, CliParameters, and QueryError to enhance type safety and clarity in the migration process

* **Boolean Parsing**: introduce `parseBoolean` function to handle boolean parsing for better clarity and consistency in handling CLI arguments and environment variables

* **Documentation**: improve documentation for better user experience


### Bug Fixes

* **Security**: implement Identifier type for safe escaping of database name to prevent SQL injection vulnerabilities
  - Update database creation query to use parameterized query

* **TLS Configuration**: validate TLS configuration to ensure both cert and key are provided together to prevent connection issues

* **Error Messages**: update error messages for clarity and consistency in error handling


### Performance Improvements

* **File Operations**: refactor migration handling to use async/await for file operations to improve performance and error handling


### Code Refactoring

* **API Design**: replace 13-parameter functions with typed config objects for better maintainability
  - Add DRY error handling helper
  - Improve error message consistency
  - Update tests for new API

* **Code Quality**: improve code quality with camelCase naming and better patterns
  - Rename all functions and variables from snake_case to camelCase
  - Extract constants (COLORS, VALIDATION_PATTERNS) for better maintainability
  - Add `isQueryError` type guard for consistent error handling
  - Refactor `applyMigrations` into smaller helper functions
  - Replace sparse array with Map for better performance
  - Add timeout validation and improve string handling
  - Maintain backward compatibility via export aliases


### Miscellaneous

* **Dependencies**: npm audit fix to address security vulnerabilities

## [1.1.3](https://github.com/VVVi/clickhouse-migrations/compare/v1.1.2...v1.1.3) (2025-11-21)


### Features

* add --abort-divergent option to allow ignoring divergent migrations
  - Add new CLI option `--abort-divergent` (default: true) to control behavior when applied migrations have different checksums
  - Add environment variable `CH_MIGRATIONS_ABORT_DIVERGENT` support
  - When set to false, migration process continues with warning instead of aborting on checksum mismatch
  - Similar to `set_abort_divergent` feature from Rust's Refinery library

## [1.1.2](https://github.com/VVVi/clickhouse-migrations/compare/v1.1.1...v1.1.2) (2025-11-21)


### Features

* add --table-engine option to configure migrations table engine
  - Add new CLI option `--table-engine` (default: "MergeTree") to configure engine for the _migrations table
  - Add environment variable `CH_MIGRATIONS_TABLE_ENGINE` support
  - Allows customization of the _migrations table engine (e.g., ReplicatedMergeTree for clustered setups)

## [1.1.1](https://github.com/VVVi/clickhouse-migrations/compare/v1.1.0...v1.1.1) (2025-09-30)


### Bug Fixes

* set correct default db engine for opensource or cloud CH ([#30](https://github.com/VVVi/clickhouse-migrations/issues/30)) ([6b1f02a](https://github.com/VVVi/clickhouse-migrations/commit/6b1f02a717884ccf1a9734ee49377dae828f37f3))

## [1.1.0](https://github.com/VVVi/clickhouse-migrations/compare/v1.0.5...v1.1.0) (2025-09-25)


### Features

* support tls connection ([#25](https://github.com/VVVi/clickhouse-migrations/issues/25)) ([#26](https://github.com/VVVi/clickhouse-migrations/issues/26)) ([#14](https://github.com/VVVi/clickhouse-migrations/issues/14)) ([e3bf5b5](https://github.com/VVVi/clickhouse-migrations/commit/e3bf5b54eb51213cb0172cda4008cc266b9fbd09))

## [1.0.5](https://github.com/VVVi/clickhouse-migrations/compare/v1.0.4...v1.0.5) (2025-08-09)


### Features

* early ignore non sql files in the migration folder ([5de5749](https://github.com/VVVi/clickhouse-migrations/commit/5de57493498a48fbb460d113e1d858806adc924c))
* ignore child directories and non sql files ([e02d23d](https://github.com/VVVi/clickhouse-migrations/commit/e02d23dbc2c9032e0588b86c27afb3d2b652e7cf))


### Miscellaneous Chores

* release 1.0.5 ([cb60c99](https://github.com/VVVi/clickhouse-migrations/commit/cb60c990c555b4e6b1e5ef85b486c435335dcba8))

## [1.0.4](https://github.com/VVVi/clickhouse-migrations/compare/v1.0.3...v1.0.4) (2025-01-21)


### Features

* update to eslint 9, update dependencies ([f91cf7d](https://github.com/VVVi/clickhouse-migrations/commit/f91cf7d83bbccde937de00206092e0474a885fac))


### Miscellaneous Chores

* release 1.0.4 ([2b653e3](https://github.com/VVVi/clickhouse-migrations/commit/2b653e3cdcb0b5d7db0bcb47ab99dd6ae4dd389b))

## [1.0.3](https://github.com/VVVi/clickhouse-migrations/compare/v1.0.2...v1.0.3) (2025-01-20)


### Features

* update packages to latest version ([4125b31](https://github.com/VVVi/clickhouse-migrations/commit/4125b3128d4fbd4ffe31c0170801b24ec2e0bc42))


### Miscellaneous Chores

* release 1.0.3 ([3f50c00](https://github.com/VVVi/clickhouse-migrations/commit/3f50c00910d6c76fe2db1e8f3d963ee3451f5864))

## [1.0.2](https://github.com/VVVi/clickhouse-migrations/compare/v1.0.1...v1.0.2) (2024-09-14)


### Miscellaneous Chores

* release 1.0.2 ([f761a87](https://github.com/VVVi/clickhouse-migrations/commit/f761a875da5a6a8038467a4322ba5d0f3df87e9d))
* release 1.0.2 ([a194e0c](https://github.com/VVVi/clickhouse-migrations/commit/a194e0ccd316a0f4370995f9da19de02798c5777))
