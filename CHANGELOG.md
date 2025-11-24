# Changelog

## [Unreleased]

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
