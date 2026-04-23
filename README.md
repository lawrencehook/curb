# Curb

Browser extension that sets daily caps and leaky-bucket rate limits on distracting sites. Firefox (MV2) and Chrome (MV3).

## Local testing (Firefox)

```bash
# Load src/ in a temporary Firefox profile with live reload
cd src && cp firefox_manifest.json manifest.json && web-ext run
```

## Release

```bash
# Tag and push — CI builds Chrome + Firefox zips and attaches them to a GitHub Release
git tag -a v0.1.0 -m "v0.1.0" && git push --tags
```
