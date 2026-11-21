# Releasing

## A new version

1. `npm version patch` (or `minor`). This bumps `package.json`, `manifest.json` and `versions.json` together.
2. Push the commit, then the tag: `git push && git push --tags`. Tags are plain numbers, such as `1.0.1`, never `v1.0.1`.
3. The release workflow tests, builds and makes a **draft** release with `main.js`, `manifest.json` and `styles.css`. Check it on GitHub and press **Publish**.

## First submission to the community store

1. Merge the phase PRs into `main` in order (#1 to #6), so `manifest.json` is on the default branch.
2. Push the tag `1.0.0`: `git tag 1.0.0 && git push origin 1.0.0`, then publish the draft release.
3. Go to [community.obsidian.md](https://community.obsidian.md), sign in with your Obsidian account, link GitHub, and add the plugin from `tlowndes/weekly-wrap`.
4. Wait for the automated checks and the review. Fix anything they flag with a new patch release.
