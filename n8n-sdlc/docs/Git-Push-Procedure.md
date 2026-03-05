# Git & GitHub Push Procedure

## Two Repos, Two Purposes

This SDLC system involves **two separate git repos**:

| Repo | Purpose | Git Sync |
|------|---------|----------|
| **SDLC Framework** | The portable toolkit (rules, skills, docs, templates) | Manual -- push when you update the framework itself |
| **n8n Project** | Your workflow files, config, id-mappings | Automatic -- the SDLC skills commit after every operation |

This document covers manual procedures for the **SDLC Framework repo**. For the project repo, git sync is handled automatically by the skills (see the **n8n-sdlc-git-sync** skill).

---

## SDLC Framework Repo

### Repository

- **Remote:** <https://github.com/mgdpax8/sdlc-test>
- **Default branch:** `main`
- **Visibility:** Private

### Prerequisites

- `gh` CLI installed at `~/bin/gh` (PATH configured in `~/.zshrc`)
- Authenticated via `gh auth login` (stored in keyring)
- Git credential helper configured via `gh auth setup-git`

### Daily Workflow

#### 1. Check Status

```bash
git status
```

Review what files have changed. Pay attention to:

- Modified files you intended to change
- Untracked files that may need to be added or ignored

#### 2. Review Changes

```bash
git diff                 # unstaged changes
git diff --staged        # already-staged changes
```

#### 3. Stage Files

```bash
git add <file1> <file2>  # stage specific files
git add .                # stage everything (use with caution)
```

**Never commit these files** (already in `.gitignore`):

- `n8n-sdlc/config/project.json` -- contains instance-specific IDs
- `n8n-sdlc/config/id-mappings.json` -- contains credential mappings

#### 4. Commit

```bash
git commit -m "Short description of the change"
```

Commit message guidelines:

- Start with a verb: `Add`, `Update`, `Fix`, `Remove`, `Refactor`
- Keep the first line under 72 characters
- Examples:
  - `Add n8n-sdlc-git-sync skill for automatic project repo commits`
  - `Update n8n-sdlc-promote-workflow skill with backup step`
  - `Fix ID mapping schema for external dependencies`

#### 5. Push

```bash
git push
```

Since the branch tracks `origin/main`, a bare `git push` is all that's needed.

### Quick One-Liner

For simple changes where you want to stage everything and push:

```bash
git add . && git commit -m "Your message" && git push
```

### Asking Cursor to Push

You can ask the AI assistant:

- *"Commit and push my changes"*
- *"Push the latest changes to GitHub"*

The assistant will review changes, draft a commit message, and push after your approval.

---

## n8n Project Repo (Automatic)

The project repo is managed automatically by the SDLC skills. You rarely need to interact with it manually.

### How It Works

After every SDLC operation (push, pull, promote, seed, import, reserve), the **n8n-sdlc-git-sync** skill:

1. Stages the changed files
2. Commits with a structured message (e.g., `[push] DEV-Support Agent`)
3. Pushes to the remote

### Branch Model

- `dev` -- day-to-day work
- `main` -- mirrors production, updated via PR after promotion

### When You Might Need Manual Intervention

- **Merge conflicts**: If a teammate pushed changes that conflict with yours, you'll need to resolve manually
- **Force push**: Never needed under normal operation
- **Branch switching**: The SDLC warns if you're on the wrong branch

### Configuration

Git settings are in `n8n-sdlc/config/project.json`:

```json
{
  "git": {
    "enabled": true,
    "devBranch": "dev",
    "mainBranch": "main",
    "autoPush": true
  }
}
```

Set `enabled` to `false` to disable all automatic git sync.

---

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
