# Review Playbook

## Use This Playbook

Use when the request is about PR review comments, requested changes, unresolved threads, or "what is actionable in this review?"

## Steps

1. Resolve the repo and PR number first.
2. Fetch review comments, changed files, and the current diff.
3. Separate true defects from preference-only feedback.
4. Prioritize findings by regression risk, missing tests, and behavioral impact.
5. If asked to fix comments, implement only the actionable items that the user approved or clearly requested.

## Focus Areas

- Broken behavior introduced by the PR
- Missing validation or error handling
- Schema, migration, or compatibility risk
- Tests that should exist but do not
- Review threads that imply a mismatch between code and expected workflow

## Output

- List findings first, ordered by severity.
- Include file paths and line references when available.
- Keep summaries short after the findings.
