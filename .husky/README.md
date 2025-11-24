# Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Available Hooks

### pre-commit
Runs before each commit to ensure code quality:
- **Unit tests**: Fast unit tests only (`bun run test:unit`)
- **Biome check**: Lints and formats code (`bun run check`)
- **TypeScript check**: Validates TypeScript compilation (`bunx tsc --noEmit`)

### pre-push
Runs before pushing to remote to ensure stability:
- **Test suite**: Runs all tests (`bun run test`)
- **Build verification**: Ensures the project builds successfully (`bun run build`)

### commit-msg
Validates commit message format to follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:** `<type>[optional scope]: <description>`

**Valid types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes
- `build` - Build system changes
- `revert` - Revert previous commit

**Examples:**
```
feat: add migration rollback support
fix(cli): handle missing config file
docs: update installation instructions
test: add integration tests for migrations
```

## Bypassing Hooks

While not recommended, you can bypass hooks when necessary:

```sh
# Skip pre-commit hook
git commit --no-verify -m "your message"

# Skip pre-push hook
git push --no-verify
```

## Installation

Hooks are automatically installed when running `bun install` via the `prepare` script in package.json.

To manually reinstall hooks:
```sh
bun run prepare
```
