# Git Commit Skill

Stage, analyze, and commit changes with a concise commit message.

## Workflow

### Step 1: Check for Changes

Run `git status --porcelain`. If empty, inform the user "No changes to commit" and stop.

### Step 2: Get Branch Name

Run `git branch --show-current` to get the current branch name.

### Step 3: Stage All Changes

Run `git add .` to stage all changes.

### Step 4: Analyze Changes

Run `git diff --cached` to understand what the changes accomplish at a high level.

Focus on the overall purpose (feature, bugfix, refactor, etc.) - not individual file changes.

### Step 5: Create Commit Message

Format:

```
<branch-name>
<brief description of what was done>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Guidelines:
- First line: branch name only
- Second line: brief, high-level description of what the commit accomplishes
- Keep it simple - describe what someone would expect to see from the outside
- Do NOT list individual file changes
- Always end with the Co-Authored-By line

### Step 6: Commit

```bash
git commit -m "$(cat <<'EOF'
<branch-name>
<brief description>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Step 7: Push (if remote exists)

Run `git remote -v`. If a remote exists, run `git push`.

### Step 8: Report Results

Brief summary: commit message used and push status.

## Error Handling

- If commit fails, report the error and do NOT retry with `--amend`
- If push fails, note the local commit was successful
- Never use `--force` when pushing