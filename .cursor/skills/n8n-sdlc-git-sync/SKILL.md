---
name: n8n-sdlc-git-sync
description: Automatically commit and push workflow changes to the project git repo after SDLC operations. Called as a post-step by other skills. Use when user says "sync to git", "commit my changes", or "push to GitHub".
---

Automatically commits and pushes workflow changes to the project's git repo after every SDLC operation. Called as a post-step by other skills -- not typically invoked directly by the user.

## When to Use

- Called automatically by n8n-sdlc-push-workflow, n8n-sdlc-pull-workflow, n8n-sdlc-promote-workflow, n8n-sdlc-seed-dev, n8n-sdlc-import-project, and n8n-sdlc-reserve-workflows after their main operation completes
- User says "sync to git", "commit my changes", "push to GitHub"

## Prerequisites

- `n8n-sdlc/config/project.json` must have `git.enabled` set to `true` (or omitted -- defaults to true)
- The workspace must be a git repository with a remote configured
- For PR creation: `gh` CLI installed and authenticated (optional -- falls back to manual instructions)

## Behavior

If `git.enabled` is `false` in `n8n-sdlc/config/project.json`, skip all git operations silently.

If the workspace is not a git repo or has no remote, warn the user once and skip.

## Step 1: Verify Git State

```bash
git rev-parse --is-inside-work-tree
git remote -v
```

If not a git repo or no remote: warn and skip.

Read `n8n-sdlc/config/project.json` for git settings:
- `git.devBranch` (default: `"dev"`)
- `git.mainBranch` (default: `"main"`)
- `git.autoPush` (default: `true`)

## Step 2: Verify Branch

Check the current branch:

```bash
git branch --show-current
```

**For non-promote operations** (push, pull, seed, import, reserve):
- If on `devBranch`: proceed normally
- If on `mainBranch`: warn the user:
  ```
  You are on the main branch. Day-to-day work should be on the dev branch.
  Switch to dev? (yes/no)
  ```
  If yes: `git checkout {devBranch}`
  If no: proceed but note the warning

**For promote operations**:
- Any branch is acceptable (the commit goes to current branch; PR handles the merge)

## Step 3: Pull Before Push

To avoid conflicts (especially in team environments):

```bash
git pull --rebase origin {current branch}
```

If rebase has conflicts: warn the user and stop. Do not auto-resolve.

## Step 4: Stage Changed Files

Stage only the files that changed during the SDLC operation:

```bash
git add {list of changed files}
```

Typical files staged per operation:

| Operation | Files Staged |
|-----------|-------------|
| n8n-sdlc-push-workflow | `{localPath}{workflow}.json`, `n8n-sdlc/config/id-mappings.json` |
| n8n-sdlc-pull-workflow | `{localPath}{workflow}.json`, `n8n-sdlc/config/id-mappings.json` |
| n8n-sdlc-promote-workflow | `{localPath}{workflow}.backup.*.json`, `n8n-sdlc/config/id-mappings.json` |
| n8n-sdlc-seed-dev | `{localPath}{DEV workflow}.json`, `n8n-sdlc/config/id-mappings.json` |
| n8n-sdlc-import-project | All workflow JSONs, `n8n-sdlc/config/id-mappings.json`, `n8n-sdlc/config/project.json` |
| n8n-sdlc-reserve-workflows | `n8n-sdlc/config/id-mappings.json` |

**Never stage**: `n8n-sdlc/config/secrets.json`, `.env`, or any file containing API keys.

## Step 5: Commit

Commit with a structured message provided by the calling skill:

```bash
git commit -m "{message}"
```

### Commit Message Format

Each calling skill provides a prefix:

```
[push] DEV-Support Agent
[pull] Support Agent
[promote] Support Agent (v3)
[seed] DEV-Support Agent from PROD
[import] Initial import: 5 workflows discovered
[reserve] Claimed 3 DEV slots
```

If there are no changes to commit (nothing staged), skip the commit and note:
```
No changes to commit (files unchanged).
```

## Step 6: Push to Remote

If `git.autoPush` is `true`:

```bash
git push origin {current branch}
```

If push fails (e.g., remote has new commits):
```bash
git pull --rebase origin {current branch}
git push origin {current branch}
```

If autoPush is `false`, inform the user:
```
Changes committed locally. Run "git push" when ready.
```

## Step 7: Offer PR (Promote Only)

After a successful n8n-sdlc-promote-workflow operation, offer to create a pull request:

```
Promotion committed and pushed to the dev branch.

Would you like to create a pull request to merge dev into main?
This keeps the main branch in sync with what's running in production.

1. Yes -- create PR now
2. No -- I'll do it later
```

If the user says yes:

**Try `gh` CLI first:**
```bash
gh pr create \
  --base {mainBranch} \
  --head {devBranch} \
  --title "[promote] {workflow name}" \
  --body "Promoted {workflow name} from DEV to PROD.\n\nTransformations applied:\n- Name: stripped DEV- prefix\n- Workflow IDs: dev -> prod\n- Credential IDs: dev -> prod (if mapped)"
```

**If `gh` is not available**, provide manual instructions:
```
The gh CLI is not available. Create the PR manually:

1. Go to: https://github.com/{owner}/{repo}/compare/{mainBranch}...{devBranch}
2. Title: [promote] {workflow name}
3. Merge when ready
```

## Confirmation Output

After git sync completes:

```
Git: committed and pushed to {branch}
  {commit message}
```

Or if skipped:
```
Git: sync skipped (git.enabled is false)
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Not a git repo | Warn once, skip all git steps |
| No remote configured | Warn once, skip push (commit still works) |
| Rebase conflicts | Stop and tell user to resolve manually |
| Push rejected | Pull --rebase and retry once |
| gh CLI not found | Fall back to manual PR instructions |
| Nothing to commit | Skip silently (not an error) |
| git.enabled is false | Skip silently |

## What This Skill Does NOT Do

- Does NOT initialize git repos (the get-started wizard handles that)
- Does NOT create branches (the get-started wizard handles that)
- Does NOT merge PRs (the user does that)
- Does NOT force push or rewrite history

## Related Skills

- `n8n-sdlc-getting-started` - Sets up git config during the wizard
- `n8n-sdlc-push-workflow` - Calls this after pushing to n8n
- `n8n-sdlc-pull-workflow` - Calls this after pulling from n8n
- `n8n-sdlc-promote-workflow` - Calls this after promotion (with PR offer)
- `n8n-sdlc-seed-dev` - Calls this after seeding
- `n8n-sdlc-import-project` - Calls this after initial import
- `n8n-sdlc-reserve-workflows` - Calls this after claiming slots
