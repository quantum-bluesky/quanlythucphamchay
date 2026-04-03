---
name: github-workflow
description: Orchestrate common GitHub repository workflows from the current local checkout or an explicit owner/repo. Use when Codex needs one entrypoint to triage repos, route issue work, summarize or inspect pull requests, address review feedback, debug CI, or publish local changes while choosing the best available tool path for the machine.
---

# GitHub Workflow

## Overview

Use this skill as the top-level router for GitHub work.
Resolve the repository and request type first, then hand off to the narrowest workable flow instead of mixing issue, PR, CI, and publish logic together.

## Workflow

1. Resolve repository, branch, and item scope.
2. Classify the task.
3. Choose the narrowest tool path that can complete it on the current machine.
4. Execute the work and report the exact target and result.

## Resolve Context

- Prefer an explicit `owner/repo`, issue number, PR number, or GitHub URL if the user already gave one.
- Otherwise infer the repository from `git remote get-url origin`.
- If the request is about the current branch or current PR, inspect local git state before choosing a GitHub path.
- If the repository cannot be resolved from either user input or local checkout, ask for it.

## Route Map

- `issue lifecycle`: use `$github-issues` for create, get, list, comment, edit, close, and reopen.
- `repo or PR triage`: prefer a GitHub connector or API-backed source when available because it returns structured metadata. Fall back to local `git` context plus direct URLs only when necessary.
- `review follow-up`: inspect the review comments, changed files, and unresolved threads first. Focus on actionable feedback and likely regressions before making code changes.
- `CI debugging`: inspect failing checks and logs with the best available source. If the machine lacks access to logs, state that clearly and stop at the highest-confidence diagnosis available.
- `publish changes`: use local `git` non-interactively, stage intentionally, commit with a scoped message, push the branch, and create a PR through a connector or `gh` when available.

## Tool Preference

- Prefer existing structured GitHub connectors when available.
- Use local `git` for branch, status, diff, commit, and push operations.
- Use `gh` only when it is actually installed and the connector does not cover the job well.
- For issue-only work on a machine without `gh`, call `$github-issues` instead of re-implementing issue logic.
- Avoid interactive git flows. Use non-interactive commands and deterministic scripts.

## Write Safety

- Restate the exact repo, issue, PR, branch, or comment target before applying write actions.
- Preserve the user's wording for issue titles, issue bodies, comments, and PR text unless they asked for rewriting.
- Do not imply that logs or review-thread state are available if the current tool path cannot actually fetch them.
- If a write action is blocked by auth, missing tooling, or missing repo context, stop and report the blocker precisely.

## Output Expectations

- For triage, return the current state, the main risks, and the next likely action.
- For write actions, return the created or updated URL and the exact identifier such as issue number or PR number.
- For mixed requests, say which narrower flow you are taking and why.

## Playbooks

- For PR summary or inspection, load [references/pr-triage.md](./references/pr-triage.md).
- For review comment follow-up, load [references/review.md](./references/review.md).
- For CI investigation, load [references/ci.md](./references/ci.md).
- For publish flow, load [references/publish.md](./references/publish.md).
- For issue triage, load [references/issue-triage.md](./references/issue-triage.md).

## Examples

- "Use $github-workflow to summarize the open PRs in this repo and tell me what needs attention."
- "Use $github-workflow to create an issue for this bug in the current repo."
- "Use $github-workflow to inspect PR 482 and tell me which review comments are actionable."
- "Use $github-workflow to debug the failing GitHub checks on this branch."
- "Use $github-workflow to publish my local changes and open a draft PR."
