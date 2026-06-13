# Contributing Guide

Thank you for your interest in contributing to DocChat.

DocChat is a RAG-based app that lets users chat with documentation. Contributions are welcome across frontend, backend, scraping, ingestion, retrieval, and docs.

---

## Getting Started

### 1. Fork and Clone

```bash
git clone https://github.com/<your-username>/DocChat.git
cd DocChat
```

### 2. Install Dependencies

Install frontend dependencies:

```bash
pnpm install
```

Install backend dependencies:

```bash
cd backend
pnpm install
cd ..
```

### 3. Set Up Environment Variables

Backend env file is located in the backend directory:

```bash
cp backend/.env.example backend/.env
```

Fill all required variables in `backend/.env` before running the backend.

### 4. Run the Project

Run frontend (from repo root):

```bash
pnpm run dev
```

Run backend (in another terminal):

```bash
cd backend
pnpm run dev
```

---

## Before You Start

- Check existing issues before starting work.
- If an issue already exists, comment and get it assigned.
- For new features, open an issue first to discuss scope.

---

## How to Contribute

1. Fork the repository.
2. Create a focused branch:

```bash
git checkout -b feat/short-feature-name  # for features
git checkout -b fix/short-bug-name  # or for bugs
```

3. Make your changes.
4. Run checks locally before opening a PR:

```bash
pnpm run lint
pnpm run build
```

5. Commit with a clear message following the [Conventional Commits](#commit-messages) format:

```bash
git commit -m "feat: add dark mode toggle"
git commit -m "fix: resolve session expiration race condition"
```

6. Push your branch:

```bash
git push origin <your-branch-name>
```

7. Open a Pull Request.

---

## Contribution Areas

- Performance improvements (scraping, ingestion, retrieval)
- UI/UX enhancements
- Better chunking strategies (especially code-aware splitting)
- Crawling improvements (depth control, filtering)
- Bug fixes
- Documentation improvements (not minor typo/grammar-only changes; focus on structure, clarity, and better explanations)
- API and backend optimizations

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

Thanks for contributing and helping improve DocChat.