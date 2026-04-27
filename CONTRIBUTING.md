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

5. Commit with a clear message:

```bash
git commit -m "feat: short description" # for features
git commit -m "fix: short description" # or for bugs
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