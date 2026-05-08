---
description: Create an atomic commit for current changes and push to remote
---

# Commit and Push Changes

## Process

### 1. Review Changes

```bash
git status
git diff HEAD
git diff --stat HEAD
```

Check for new untracked files:

```bash
git ls-files --others --exclude-standard
```

If the working tree is clean, report that and stop.

### 2. Stage Files

Add the untracked and changed files relevant to the current work.

**Do NOT stage:**

- `.env` or credential files
- Large binary files
- `node_modules/`, `dist/`, `*.log`, or generated files
- Files unrelated to the current task

### 3. Create Commit

Write an atomic commit message with a conventional commit tag:

- `feat:` — New capability or feature
- `fix:` — Bug fix
- `refactor:` — Code restructure without behavior change
- `docs:` — Documentation only
- `test:` — Test additions or fixes
- `chore:` — Build, CI, tooling changes
- `perf:` — Performance improvement

**For monorepo changes spanning multiple packages**, note the primary package in the scope:

```
feat(workflows): add DAG condition evaluator
fix(web): resolve SSE reconnection on navigation
refactor(isolation): simplify worktree resolution order
```

**Commit message format:**

```
tag(scope): concise description of what changed

[Optional body explaining WHY this change was made,
not just what changed. Include context that isn't
obvious from the diff.]

[Optional: Fixes #123, Closes #456]
```

### 4. Capture AI Context Changes

If any file matching `.claude/**`, `CLAUDE.md`, `.archon/**` was staged, add a `Context:` section to the commit body:

```
feat(orchestrator): add retry logic for session recovery

Added exponential backoff when SDK subprocess crashes mid-session.
Previously a single crash would fail the entire workflow.

Context:
- Updated .claude/rules/orchestrator.md with retry conventions
- Added .claude/commands/debug-session.md for session state inspection
- Surfaced issue: mock.module() in retry tests needs isolated batch

Fixes #482
```

**What counts as AI context changes:**

- `.claude/rules/` — on-demand conventions added, updated, or removed
- `.claude/commands/` — slash commands created or modified
- `.claude/docs/` — reference docs added or updated
- `CLAUDE.md` — global rules changes
- `.archon/workflows/` or `.archon/commands/` — workflow or command definitions

**Why this matters:** Your git log is long-term memory. Future agents and sessions use `git log` to understand project history. If context changes aren't captured in commits, the AI layer's evolution becomes invisible — you lose the ability to trace WHY a rule exists or WHEN a command was added.

### 5. Push to Remote

Check the current branch and remote tracking status:

```bash
git status -sb
git remote -v
```

Then push:

```bash
git push
```

**If the branch has no upstream set**, push and set tracking in one step:

```bash
git push -u origin HEAD
```

**If the push is rejected** (remote has commits not in local), stop and report the conflict rather than force-pushing. Do not run `git push --force` or `git push --force-with-lease` unless explicitly instructed by the user.

Report the final pushed commit hash and branch name on success:

```bash
git log -1 --oneline
```
