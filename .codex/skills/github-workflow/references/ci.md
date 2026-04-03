# CI Playbook

## Use This Playbook

Use when the request is about failing checks, GitHub Actions, test failures, build errors, or "why is CI red?"

## Steps

1. Resolve the repo, branch, PR, and failing check names.
2. Fetch the failing status and inspect logs if the machine can access them.
3. Identify the first concrete failing command, test, or step instead of guessing from the final summary line.
4. Reproduce locally when feasible.
5. Fix the root cause, then rerun the narrowest useful validation.

## Focus Areas

- Environment mismatch between local and CI
- Missing files, secrets, or generated artifacts
- Flaky tests versus deterministic failures
- Ordering bugs, race conditions, and platform-specific path issues

## Output

- State which check failed and the first real failure point.
- Distinguish confirmed root cause from likely hypothesis.
- If logs are unavailable, say so explicitly and stop at the best-supported diagnosis.
