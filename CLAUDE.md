# Invade

Hackathon project: friends put virtual coins into a pot, walk in real life to build armies, and battle over a map for the pot. Pitch line: "Invade: bet on your own steps."
Full spec: `docs/PRODUCT.md` (coming). Architecture: `docs/ARCHITECTURE.md` (coming).

## Git workflow (mandatory, see CONTRIBUTING.md)

- Never commit or push to `main`. Always work on a branch named `feat|fix|chore|docs/<area>-<thing>`.
- Before starting: `git switch main && git pull`, then create the branch.
- Use conventional commits (`feat(engine): ...`). Commit small and push at least hourly.
- Open PRs with `gh pr create --draft --fill` and include `Closes #<issue>`. Squash-merge only.
- Before marking a PR ready: `git pull --rebase origin main` and make sure checks pass.
- Never commit secrets or `.env*` files other than `.env.example`.
- If a change touches shared contracts (engine types, DB schema, function signatures), tell the user to announce it to the team before merging.
