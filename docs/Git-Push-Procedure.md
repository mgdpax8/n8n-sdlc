# Git & GitHub Push Procedure

## Repository

- **Remote:** https://github.com/mgdpax8/sdlc-test
- **Default branch:** `main`
- **Visibility:** Private

## Prerequisites

- `gh` CLI installed at `~/bin/gh` (PATH configured in `~/.zshrc`)
- Authenticated via `gh auth login` (stored in keyring)
- Git credential helper configured via `gh auth setup-git`

## Daily Workflow

### 1. Check Status

```bash
git status
```

Review what files have changed. Pay attention to:
- Modified files you intended to change
- Untracked files that may need to be added or ignored

### 2. Review Changes

```bash
git diff                 # unstaged changes
git diff --staged        # already-staged changes
```

### 3. Stage Files

```bash
git add <file1> <file2>  # stage specific files
git add .                # stage everything (use with caution)
```

**Never commit these files** (already in `.gitignore`):
- `config/project.json` — contains instance-specific IDs
- `config/id-mappings.json` — contains credential mappings

### 4. Commit

```bash
git commit -m "Short description of the change"
```

Commit message guidelines:
- Start with a verb: `Add`, `Update`, `Fix`, `Remove`, `Refactor`
- Keep the first line under 72 characters
- Examples:
  - `Add invoice agent workflow`
  - `Update promote-workflow skill with backup step`
  - `Fix ID mapping for billing tool`

### 5. Push

```bash
git push
```

Since the branch tracks `origin/main`, a bare `git push` is all that's needed.

## Quick One-Liner

For simple changes where you want to stage everything and push:

```bash
git add . && git commit -m "Your message" && git push
```

## Asking Cursor to Push

You can ask the AI assistant:
- *"Commit and push my changes"*
- *"Push the latest changes to GitHub"*

The assistant will review changes, draft a commit message, and push after your approval.

## Troubleshooting

### Authentication expired

```bash
gh auth login
gh auth setup-git
```

### Push rejected (remote has new commits)

```bash
git pull --rebase
git push
```

### Accidentally staged a sensitive file

```bash
git reset HEAD <file>
```
