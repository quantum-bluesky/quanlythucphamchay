# Publish Playbook

## Use This Playbook

Use when the request is about committing local changes, pushing a branch, opening a PR, or publishing work already in the workspace.

## Steps

1. Inspect git status and confirm the intended scope.
2. Avoid reverting unrelated user changes.
3. Stage only the files that belong to the requested work.
4. Create a focused commit message that matches the actual delta.
5. Push the current branch or create a new branch if needed.
6. Open a PR with a concise title and body that summarize user-facing impact, validation, and risk.

## Focus Areas

- Dirty worktree safety
- Branch naming and current HEAD
- Missing tests or validations before publish
- PR body quality and reviewer context

## Output

- Report the branch, commit, and PR URL when created.
- If publish is blocked, name the exact blocker such as auth, remote, or unresolved local conflicts.
