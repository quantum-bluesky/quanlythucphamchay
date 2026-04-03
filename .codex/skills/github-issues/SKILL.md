---
name: github-issues
description: Create and manage GitHub issues from the current local repository or an explicit owner/repo. Use when Codex needs to open, inspect, list, comment on, edit, close, or reopen issues through GitHub API without relying on `gh`, while inferring the repository from `git remote origin` when possible.
---

# GitHub Issues

## Overview

Create and manage GitHub issues without depending on `gh`.
Resolve the target repository from explicit input first, then from the current git checkout if needed.

## Workflow

1. Resolve the repository.
2. Choose the issue action: `create`, `get`, `list`, `comment`, `edit`, `close`, or `reopen`.
3. Preserve the user's wording unless they asked for rewriting.
4. Run the bundled script and report the GitHub URL or the blocking error.

## Resolve Repo

- Prefer an explicit `owner/repo` if the user gave one.
- Otherwise read `git remote get-url origin` in the current workspace.
- Support both `https://github.com/owner/repo.git` and `git@github.com:owner/repo.git`.
- If the repo still cannot be resolved, stop and ask for the repository identifier.

## Authenticate

- Prefer `GITHUB_TOKEN`, then `GH_TOKEN`.
- If neither is set, use `git credential fill` for `github.com` and the resolved repo path.
- Never print secrets back to the user.
- If auth is unavailable, report that issue management is blocked and keep the prepared issue content ready.

## Supported Actions

- `create`: open a new issue with title, body, and optional labels.
- `get`: fetch one issue by number.
- `list`: list issues by state with optional labels and pagination limit.
- `comment`: add a new comment to an issue.
- `edit`: update title, body, labels, and state.
- `close`: close an issue without changing other fields.
- `reopen`: reopen an issue.

## Writing Rules

- Preserve the user's wording in titles, bodies, and comments unless they asked for rewriting.
- Use Markdown in the body when it improves readability.
- Keep screenshots or image references in the issue text if the user provided them, but do not invent attachments.
- Pass body text inline for short content or via `--body-file` for longer drafts.
- Prefer `edit` when the user wants to change labels, title, or body on an existing issue.

Example:

```powershell
python .codex/skills/github-issues/scripts/github_issues.py `
  --repo quantum-bluesky/quanlythucphamchay `
  create `
  --title "UI mobile: tự động ẩn 3 cụm floating" `
  --body-file issue.md
```

## Report Result

- On success, report the issue number and GitHub URL when the API returns one.
- On failure, summarize the blocking cause: repo resolution, auth, network, or GitHub API response.
- If a write action failed after the content was prepared, keep the final issue text in the response so the user can reuse it.

### scripts/
Use [github_issues.py](./scripts/github_issues.py) to manage issues through GitHub REST API.
The script is portable and does not require `gh`.
