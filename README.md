# Curb

Browser extension that sets daily caps and leaky-bucket rate limits on distracting sites. Firefox (MV2) and Chrome (MV3).

## Local testing

`./dev.sh <firefox|chrome>` builds `dist/<browser>/` as a tree of symlinks back into `src/` with the right manifest copied in, so both browsers can run side-by-side without clobbering each other's `manifest.json`. Edits in `src/` propagate live through the symlinks.

```bash
./dev.sh firefox     # symlinks + launches web-ext run
./dev.sh chrome      # symlinks; load dist/chrome/ as unpacked in chrome://extensions
```

Re-run after editing a manifest variant; other source edits don't need a re-run.

## Release

```bash
# Tag and push — CI builds Chrome + Firefox zips and attaches them to a GitHub Release
git tag -a v0.1.0 -m "v0.1.0" && git push --tags
```
