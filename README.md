# bobuk.io · GitHub organization profile

Source for the public overview at **https://github.com/bobuk-io**.
Product catalog, installation guides and support: **https://bobuk.io/**.

GitHub displays `profile/README.md` from the public `bobuk-io/.github` repository on the organization's Overview tab.

## Local commands

Requires Node.js 22+, Git and an authenticated [GitHub CLI](https://cli.github.com/). No npm dependencies.

```sh
cd ~/GitHub/bobuk.io/.github
npm test
npm run prepare:profile  # Fetch public GitHub repositories; rebuild profile and assets
npm run check            # Read-only check against current GitHub visibility
```

Edit `design/catalog.json` for app copy, order, site slugs and installation commands.
Edit `scripts/profile.mjs` for shared copy and layout.
Edit `design/assets/banner-{light,dark}.svg` for the banners.
The banner colors and mark match bobuk.io. Icons are copied from the public landing site.
`profile/` is generated; do not edit it directly.
Asset URLs are absolute so they work on the organization's Overview tab as well as in the repository.

### Public repositories only

- The API request explicitly uses `type=public` and retrieves all pages.
- A second filter requires `private === false`, `visibility === 'public'`, the correct owner and full name.
- The design catalog is **not** permission to publish an app. Its source repository must pass the public filter.
- Private, internal, missing or unknown-visibility repositories are excluded, including their descriptions, app copy and generated icons.
- A private/missing Homebrew tap also removes its installation commands.
- New public repositories appear under “More public repositories”. Archived projects appear there without app installation promotion.
- No full API response or private repository inventory is written to disk.
- Obsolete generated icons are removed. Network/API errors stop the build before output changes.

The scheduled workflow refreshes the page every six hours. Run it manually after changing visibility, or regenerate and publish locally. GitHub schedules can be delayed; **a static README cannot remove a formerly public project instantly**. Previously published data remains in Git history and caches. For a planned privacy change, remove its profile entry before changing visibility and review pinned repositories separately.

## Publish

Publication is explicit. The script checks current public visibility, runs tests and requires a clean commit on `main`. It never commits changes, changes an existing repository's visibility or force-pushes.

First publication:

```sh
git init -b main
npm run prepare:profile
npm test
git add README.md package.json scripts tests design profile .github .gitignore
git commit -m 'feat(profile): add public organization overview'
npm run publish:profile
```

Updates:

```sh
npm run prepare:profile
npm test
git diff
# Review, stage and commit your changes, then:
npm run publish:profile
```

The first publication creates the public repository `bobuk-io/.github`. Later publications push `main` to that repository only. Automatic refreshes require GitHub Actions and write access for the repository's `GITHUB_TOKEN`.

## Organization settings (separate from the README)

Suggested description: `Small native macOS apps. Less noise, more of your own work.`
Website: `https://bobuk.io/`.
Use the site's orange `b.` mark for the organization avatar.
Suggested pinned repositories, **only while public**: Ting, Splash Finish, HAScS, Lowkey, homebrew-tap, BobukKit.
Pins and organization settings are not changed by the preparation or publication scripts.
Domain verification is a separate DNS step; the README does not claim Verified status.
