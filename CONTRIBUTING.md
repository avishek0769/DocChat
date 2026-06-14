# Contributing Guide

Thank you for your interest in contributing to **DocChat**! 

DocChat is a RAG-based application that allows users to chat with documentation. Contributions are welcome across the entire stack—frontend UX/UI, backend APIs, crawling, text processing, vector search, and documentation.

---

## 🚀 Quick Links
* **Guides**: Refer to the [Architecture Guide](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/DocChat/docs/architecture.md) and [Troubleshooting Guide](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/DocChat/docs/troubleshooting.md) for local environment setup.
* **Pull Request Template**: [.github/pull_request_template.md](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/DocChat/.github/pull_request_template.md)
* **Issue Templates**:
  * Report a bug: [Bug Report Template](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/DocChat/.github/ISSUE_TEMPLATE/bug_report.md)
  * Propose a feature: [Feature Request Template](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/DocChat/.github/ISSUE_TEMPLATE/feature_request.md)

---

## Branching & Naming Conventions

To keep our repository organized, please name your branches following these prefixes:
* `feat/short-description` — for new features or capabilities.
* `fix/short-description` — for bug fixes or errors.
* `docs/short-description` — for changes or improvements to documentation.
* `refactor/short-description` — for codebase rewrites that do not add features or fix bugs.
* `perf/short-description` — for changes that improve indexing speeds or response latencies.

---

## Development Workflow

### 1. Fork and Clone
Fork the repository on GitHub, and then clone your fork locally:
```bash
git clone https://github.com/avishek0769/DocChat.git
cd DocChat
```

### 2. Install Dependencies
Install packages in both directories:
```bash
# Install frontend packages (at root)
pnpm install

# Install backend packages
cd backend
pnpm install
cd ..
```

### 3. Create a Local Branch
Always work on a separate, descriptive branch created from the latest `main`:
```bash
git checkout -b feat/my-new-feature
```

### 4. Make Changes & Test Locally
Before committing any changes, verify that the project builds and runs without errors.

#### Running Tests
DocChat contains backend integration and unit tests using **Vitest**. Make sure all tests pass before proposing a PR:
```bash
cd backend
pnpm test
```
*To run tests in watch mode:*
```bash
pnpm dlx vitest
```

#### Linting & Formatting Checks
Verify that eslint runs successfully:
```bash
# Run lint check from the root directory
pnpm run lint
pnpm run build
```

5. Commit with a clear message following the [Conventional Commits](#commit-messages) format:

```bash
git commit -m "feat: add dark mode toggle"
git commit -m "fix: resolve session expiration race condition"
```

6. Push your branch:

# Check production compile build
pnpm run build
```

---

## PR Guidelines

- Comment on the issue you want to work on and wait until it is assigned before starting.
- PRs without prior issue discussion/assignment may be closed.
- Keep each PR focused on one issue.
- Start with a short summary of what changed and why.
- Link the assigned issue.
- Add screenshots or a short video in PRs when possible. (Explanatory visuals are highly appreciated)
- Ensure the app runs without errors.
- Avoid bundling unrelated changes in one PR.

Note: Please do not open a PR without a corresponding issue assignment.

---

## Commit Messages

DocChat enforces [Conventional Commits](https://www.conventionalcommits.org/) via a `commit-msg` hook. Non-conforming commits are rejected automatically.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Allowed Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructure without feature or fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD configuration changes |
| `chore` | Maintenance tasks |
| `revert` | Reverting a previous commit |

### Rules

- Use **imperative mood**: "add" not "added" or "adds"
- Keep the description **under 72 characters**
- Start description with **lowercase**
- No period at the end
- Scope is optional but must be **kebab-case** when used

### Good Examples

```bash
feat: add pagination to chat history
fix(auth): prevent redirect loop on token expiry
docs: update environment variable setup steps
refactor(retrieval): extract chunking logic to separate module
perf: cache user session data to reduce DB queries
ci: add lint check to GitHub Actions workflow
```

### Bad Examples

```bash
# No type prefix
added dark mode

# Wrong tense
feat: added dark mode

# Too vague
fix: fixed bug

# Uppercase start
feat: Add dark mode

# Period at end
fix: resolve login issue.

# Multiple unrelated changes in one message
feat: add dark mode and fix auth bug and update readme

# WIP or placeholder messages
WIP
temp
misc changes
update stuff
```

### Breaking Changes

Add `!` after the type, or include a `BREAKING CHANGE` footer:

```bash
feat(api)!: change response format to JSON:API

BREAKING CHANGE: All API responses now use camelCase keys.
Update client-side parsers accordingly.
```

### Issue References

Link issues in the footer:

```bash
fix(upload): handle empty file gracefully

Fixes #142
```

---

## Code Guidelines

- Write clean, readable, maintainable code.
- Keep changes minimal and targeted.
- Avoid unnecessary new dependencies.
- Follow existing project structure and style.
- Do not log or expose API keys or secrets.

---

## Good First Contributions

If you are new, look for issues labeled `good first issue`.

---

## Need Help?
- Open an issue: [GitHub Issues](https://github.com/avishek0769/DocChat/issues)
- Join Discord: [Discord Server](https://discord.gg/t6B7YDAk8y)

---
## Pull Request Guidelines

1. **Prior Discussion**: We prefer that contributions map to an open issue. Please comment on the issue you wish to resolve and wait for maintainer assignment before starting work.
2. **Focus**: Keep PRs small and focused. Avoid mixing unrelated bug fixes or cosmetic styling edits with feature implementations.
3. **Checklist Documentation**: Fill out the [Pull Request Template](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/DocChat/.github/pull_request_template.md) fields completely when opening your PR.
4. **Visual Demonstrations**: If your changes affect the user interface, attach screenshots or a short screen recording demonstrating the modified states.
5. **No Exposure of Credentials**: Do not push or log active API keys, encryption secrets, or local configuration files (`.env` is excluded in `.gitignore`).
