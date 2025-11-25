# Testing Guide

This project uses [Vitest](https://vitest.dev/) as the test framework.

## Important: Bun vs Vitest

**⚠️ Critical:** This project uses Vitest for testing, not Bun's built-in test runner.

### Correct Commands

```bash
# ✅ Correct - uses Vitest
bun run test
bun run test:unit
bun run test:integration
bun run test:e2e
```

### Incorrect Commands

```bash
# ❌ Wrong - uses Bun's built-in test runner (will fail)
bun test
```

**Why?** The command `bun test` invokes Bun's built-in test runner which has different APIs and behavior than Vitest. Always use `bun run test` to execute the npm script that launches Vitest.

## Test Structure

Tests are organized by type:

- **Unit tests** (`*.unit.test.ts`) - 171 tests
  - Test individual functions and modules in isolation
  - Use mocks for external dependencies
  - Fast execution

- **Integration tests** (`*.integration.test.ts`) - 28 tests
  - Test interaction between components
  - May use mocks for external services
  - Medium execution time

- **E2E tests** (`*.e2e.test.ts`) - 11 tests
  - Test complete workflows
  - Require actual ClickHouse instance
  - Slower execution

## Running Tests

### All Tests

```bash
bun run test
```

Runs all 210 tests across all categories.

### By Category

```bash
# Unit tests only
bun run test:unit

# Integration tests only
bun run test:integration

# E2E tests only
bun run test:e2e
```

### Development Commands

```bash
# Watch mode - automatically re-run tests on file changes
bun run test:watch

# Interactive UI - visual test interface in browser
bun run test:ui

# Coverage report - generates code coverage metrics
bun run test:coverage
```

## Configuration

Test configuration is in [`vitest.config.ts`](./vitest.config.ts):

- **Test timeout:** 30 seconds
- **File parallelism:** Enabled
- **Isolation:** Enabled for proper mock cleanup

## Writing Tests

### Basic Test Structure

```typescript
import { describe, expect, it } from 'vitest'

describe('Feature name', () => {
  it('should do something', () => {
    const result = myFunction()
    expect(result).toBe(expectedValue)
  })
})
```

### Using Mocks

```typescript
import { describe, expect, it, vi } from 'vitest'

// Mock a module
vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => ({
    query: vi.fn(),
    exec: vi.fn(),
  }))
}))

describe('With mocks', () => {
  it('should use mocked client', () => {
    // Test code using mocked client
  })
})
```

### Mock Cleanup Best Practices

Always clean up mocks to prevent test interference. Use the appropriate hook based on your needs:

#### `afterEach` - Use for per-test cleanup

Use when mock state affects subsequent tests in the same file:

```typescript
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

describe('Test suite', () => {
  beforeEach(() => {
    vi.clearAllMocks() // Reset before each test
  })

  afterEach(() => {
    vi.restoreAllMocks() // Restore original implementations
  })

  it('test case 1', () => {
    // Mock state is clean
  })

  it('test case 2', () => {
    // Mock state is clean again
  })
})
```

**When to use `afterEach`:**
- Tests modify mock return values or implementations
- Tests use `vi.spyOn()` that need restoration
- Mock state from one test could interfere with another

#### `afterAll` - Use for test suite cleanup

Use for expensive cleanup operations that only need to run once:

```typescript
import { afterAll, describe, it, vi } from 'vitest'

describe('Test suite', () => {
  afterAll(() => {
    vi.clearAllMocks() // Clean up once after all tests
  })

  it('test case', () => {
    // test code
  })
})
```

**When to use `afterAll`:**
- Tests don't modify mock state
- Mocks are stateless and don't interfere
- Cleanup is expensive (file operations, etc.)

#### Using Test Helpers

For consistency, use shared mock helpers from `tests/helpers/`:

```typescript
import { createMockClickHouseClient } from './helpers/mockClickHouseClient'

const { mockClient, mockQuery, mockExec } = createMockClickHouseClient()

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}))

describe('Test suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations to defaults
    mockQuery.mockResolvedValue({ json: vi.fn().mockResolvedValue([]) })
  })

  // tests...
})
```

## E2E Test Requirements

E2E tests require running ClickHouse instances. The test setup has been automated to start containers automatically.

### Automated Setup (Recommended)

```bash
# Run E2E tests (automatically starts required containers)
bun run test:e2e
```

This command will:
1. Start both `clickhouse` and `clickhouse_tls` containers
2. Run all E2E tests
3. Leave containers running for subsequent test runs

### Manual Container Management

If you prefer to manage containers manually:

```bash
# Start containers manually
bun run test:e2e:setup

# Run E2E tests (without starting containers)
vitest run tests/*.e2e.test.ts

# Stop containers when done
bun run test:e2e:teardown
```

### Individual Container Commands

```bash
# Start specific containers
docker-compose up -d clickhouse        # For standard E2E tests
docker-compose up -d clickhouse_tls    # For TLS E2E tests

# Stop all containers
docker-compose down
```

**Important:** E2E tests will fail with a clear error message if required ClickHouse containers are not running. This is intentional to ensure proper test infrastructure in CI/CD environments.

## Troubleshooting

### Tests fail with "unknown function" errors

Make sure you're using `bun run test` and not `bun test`.

### Mock interference between tests

This is expected behavior with Vitest when running all tests together. Run test categories separately:

```bash
bun run test:unit
bun run test:integration
bun run test:e2e
```

### E2E tests fail with container errors

E2E tests require running ClickHouse containers. The `bun run test:e2e` command automatically starts both required containers (`clickhouse` and `clickhouse_tls`).

If you see container-related errors:

```bash
# Start containers manually
bun run test:e2e:setup

# Or start specific containers
docker-compose up -d clickhouse        # For standard E2E tests
docker-compose up -d clickhouse_tls    # For TLS E2E tests
```

If containers are not running, tests will fail immediately with a clear error message indicating which container is missing.

To verify containers are running:

```bash
docker ps --filter "name=clickhouse"
```

## CI/CD

In CI pipelines, always use:

```bash
bun run test
```

For publishing, the `prepublishOnly` script automatically runs tests:

```bash
bun publish  # automatically runs: bun run test && bun run check
```

### Testing GitHub Workflows Locally with Act

[Act](https://github.com/nektos/act) allows running GitHub Actions workflows locally in Docker containers.

#### Quick Start

```bash
# Install act (macOS)
brew install act

# Run unit tests job
act -j unit-tests

# Run integration tests job
act schedule -j integration-tests --matrix node:24 --matrix clickhouse:latest

# Run all matrix combinations sequentially (more reliable)
act -j unit-tests --matrix node:20
act -j unit-tests --matrix node:22
act -j unit-tests --matrix node:24
```

#### Common Issues and Solutions

**Issue: `actions-setup-node@v4` MODULE_NOT_FOUND**

Clear corrupted action cache:
```bash
rm -rf ~/.cache/act/actions-setup-node@v4/
```

**Issue: Parallel matrix jobs fail**

Run matrix combinations sequentially to avoid cache conflicts:
```bash
act schedule -j integration-tests --matrix node:20 --matrix clickhouse:latest
act schedule -j integration-tests --matrix node:22 --matrix clickhouse:latest
act schedule -j integration-tests --matrix node:24 --matrix clickhouse:latest
```

**Expected Results:**
- Unit tests: 165/165 ✅
- Integration tests: ~11-12/12 ✅ (TLS test may occasionally timeout)

#### Configuration

The project is configured for act compatibility:
- Docker networking: `DOCKER_NETWORK_MODE=host` in CI
- ClickHouse readiness checks with `SELECT 1` query validation
- Docker compose v2 syntax
- Logging: `DOCKER_LOGGING_DRIVER=none` to reduce noise

## Migration from Jest

This project was migrated from Jest to Vitest. Key changes:

- `@jest/globals` → `vitest`
- `jest.fn()` → `vi.fn()`
- `jest.mock()` → `vi.mock()`
- `jest.spyOn()` → `vi.spyOn()`
- Test timeout configuration moved to `vitest.config.ts`

All tests have been updated and verified to work with Vitest.
