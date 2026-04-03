# PR Triage Playbook

## Use This Playbook

Use when the request is about summarizing a pull request, inspecting what changed, identifying risky areas, or answering "what does this PR do?"
Do not use it for line-by-line review follow-up; use `review.md` for that.

## Steps

1. Resolve the repo and PR number first.
2. Fetch PR metadata, status, changed files, and diff or patch context.
3. Summarize the user-facing behavior change before discussing implementation details.
4. Identify the highest-risk files, migrations, workflow changes, and missing tests.
5. Call out blockers such as failing checks, merge conflicts, or missing review context.

## Focus Areas

- What behavior changes if this PR merges
- Which files or modules carry the most risk
- Whether tests and docs match the code change
- Whether the PR scope is coherent or mixes unrelated concerns
- Whether there are obvious regressions, compatibility risks, or rollout concerns

## Output

- Start with a concise PR summary.
- Follow with the main risks or open questions.
- Include the PR URL, status, and notable changed areas when available.
