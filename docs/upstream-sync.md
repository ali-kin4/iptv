# Upstream Synchronization

## Remotes

After the GitHub fork exists:

```bash
git remote -v
git remote add upstream https://github.com/iptv-org/iptv.git  # only if missing
git fetch upstream master
```

Expected mapping:

- `origin` -> `ali-kin4/iptv`
- `upstream` -> `iptv-org/iptv`

## Safe policy

Do not auto-force the fork's default branch. The supplied `upstream-sync.yml` creates/refreshes `automation/upstream-sync` and opens a PR into `master`.

If merging upstream creates conflicts, the workflow fails and leaves the default branch untouched. Resolve the conflict explicitly, paying special attention to `.github/workflows/`, `package*.json`, and any upstream file that the fork intentionally overrides.

## Custom overlay advantage

Because custom stream records live outside `streams/*.m3u`, most upstream stream-file churn should merge without custom-entry conflicts. Derived playlists are rebuilt after synchronization.
