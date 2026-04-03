# Issue Triage Playbook

## Use This Playbook

Use when the request is to inspect open issues, summarize what needs attention, prepare a new issue, or decide whether an issue should be edited, closed, or escalated.

## Steps

1. Resolve the repo and target scope: one issue, open issues, or a label/state slice.
2. Read the issue title, body, labels, and recent comments.
3. Classify the issue: bug, feature, support, duplicate, blocked, or stale follow-up.
4. Check whether the issue has enough reproduction detail or acceptance criteria.
5. Route lifecycle actions to `$github-issues` when creating or editing issues.

## Focus Areas

- Missing repro steps or expected behavior
- Duplicate or overlapping issues
- Labels or state that do not match the actual request
- Whether the next action is implement, ask for detail, or close

## Output

- Return a concise triage summary with next action.
- If editing or creating an issue, preserve the user's wording unless rewriting was requested.
