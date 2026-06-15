# Netlify deploy troubleshooting (plugin/extension install failures)

## Symptom

Build logs fail before `npm ci` with an extension install error such as:

- `Installing extensions - neon`
- `npm ERR! code ENOTFOUND`
- request to `https://<site>.netlify.app/packages/buildhooks.tgz` failed

## Root cause

This failure happens during Netlify extension/plugin bootstrap, before the app dependency install starts. If the extension package URL is unreachable, Netlify exits early.

## Fix checklist

1. In **Netlify UI → Site configuration → Extensions (or Build plugins)**, locate `neon`.
2. Update the package source to a reachable artifact, or uninstall/disable the extension.
3. Keep `netlify.toml` free of remote plugin tarball URLs unless they are publicly resolvable from Netlify build workers.
4. Redeploy once the extension is disabled or corrected.

## Repository note

This repository intentionally does **not** configure `[[plugins]]` in `netlify.toml`, so extension installs shown in logs are coming from site-level Netlify configuration, not from this repo.
