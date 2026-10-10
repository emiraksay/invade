# How we work

Three people, three laptops, one `main` that always works. Speed comes from small, frequent merges, not from skipping process.

## The loop (every task)

1. **Pick an issue** on the project board and assign yourself. No issue, no branch.
2. **Branch from fresh `main`:**
   ```bash
   git switch main && git pull
   git switch -c feat/<area>-<thing>     # e.g. feat/engine-dice, fix/ui-lobby-crash
   ```
   Prefixes: `feat/`, `fix/`, `chore/`, `docs/`. Areas: `engine`, `ui`, `backend`, `ai`, `pitch`.
3. **Commit small and often** with conventional commits:
   `feat(engine): resolve dice battles`, `fix(ui): lobby list overflow`, `chore: bump deps`.
4. **Push at least every hour**, so nobody's work lives only on one laptop:
   ```bash
   git push -u origin HEAD
   ```
5. **Open a draft PR early:** `gh pr create --draft --fill`. Put `Closes #<issue>` in the body.
6. **Stay in sync:** before you mark it ready, run `git pull --rebase origin main`, fix any conflicts, and confirm checks pass.
7. **Ready for review:** `gh pr ready`. Ask in chat with the PR link. One approval from a teammate is needed, and reviews should take less than 10 minutes.
8. **Merge: only Emir merges** (squash only, at the merge windows). Never merge your own PR. After a merge: `git switch main && git pull`.

## Rules

- **Never push to `main` directly.** Everything goes through a PR.
- **One owner per area** (see the project board). If you change someone else's area, they review it.
- **Contracts are sacred.** Changes to `packages/engine` types, the DB schema, or function signatures need a heads-up in chat *before* you merge, because they break other people's work.
- **Never commit secrets.** Keys go in `.env.local` (gitignored) or Supabase secrets. `.env.example` lists the names only.
- **PRs stay small:** under about 300 lines changed, one purpose each.
- **Merge checkpoints:** at each checkpoint on the build-day plan, everyone merges what works and pulls `main`.

## Staying informed

- Install the **GitHub mobile app** and enable push notifications.
- On the repo page: **Watch → All Activity**.
- Our team chat gets an automatic message for every push, PR and merge.
- Quick status from the terminal: `gh pr status`, `gh pr list`, `git log --oneline -10 origin/main`.
