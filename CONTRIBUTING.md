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
git clone https://github.com/<your-username>/DocChat.git
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

# Check production compile build
pnpm run build
```

---

## Pull Request Guidelines

1. **Prior Discussion**: We prefer that contributions map to an open issue. Please comment on the issue you wish to resolve and wait for maintainer assignment before starting work.
2. **Focus**: Keep PRs small and focused. Avoid mixing unrelated bug fixes or cosmetic styling edits with feature implementations.
3. **Checklist Documentation**: Fill out the [Pull Request Template](file:///c:/Users/Rushabh%20Mahajan/Documents/GitHub/DocChat/.github/pull_request_template.md) fields completely when opening your PR.
4. **Visual Demonstrations**: If your changes affect the user interface, attach screenshots or a short screen recording demonstrating the modified states.
5. **No Exposure of Credentials**: Do not push or log active API keys, encryption secrets, or local configuration files (`.env` is excluded in `.gitignore`).