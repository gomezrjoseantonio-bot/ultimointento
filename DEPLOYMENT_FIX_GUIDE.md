# Deployment Configuration Guide

## Fixed Issues (Commit 1f98b48)

### 1. TypeScript Compilation Errors
- **Problem**: Variable `totalDuplicates` used before declaration
- **Solution**: Moved variable declaration before usage
- **Prevention**: Always run `npm run build` locally before committing

### 2. Netlify Configuration Conflicts
- **Problem**: Duplicate configurations in `netlify.toml` and `public/_headers`/`public/_redirects`
- **Solution**: Removed duplicate files, kept single source in `netlify.toml`
- **Prevention**: Use only ONE configuration method

## Deployment Best Practices

### Always Check Before Committing:
```bash
# 1. Install dependencies
npm ci

# 2. Run TypeScript check
npm run build

# 3. Run tests if they exist
npm test -- --watchAll=false

# 4. Check for linting issues
npm run lint (if available)
```

### Netlify Configuration Rules:
- ✅ USE: `netlify.toml` for all deployment config
- ❌ AVOID: `public/_headers` and `public/_redirects` when using `netlify.toml`
- ✅ Specify Node.js version explicitly
- ✅ Keep environment variables in `netlify.toml`

### File Structure:
```
project/
├── netlify.toml          ← Single source of truth
├── public/
│   ├── index.html
│   └── manifest.json     ← NO _headers or _redirects here
└── src/
```

## Current Configuration
- Node.js: 20 (from .nvmrc)
- Build: `npm ci && npm run build`
- Deploy: `build/` directory
- Headers: Security headers configured in netlify.toml
- Redirects: SPA routing configured in netlify.toml

This ensures reliable deployments without conflicts.

## Netlify Extension Outage Playbook (ENETUNREACH)

If Netlify fails during **Installing extensions** (for example extension `neon`) before `npm ci` starts, the repo build command is not the root cause.

### Symptoms
- Build stops at `Installing extensions`
- Error includes `npm ERR! ENETUNREACH`
- Failure references downloading `buildhooks.tgz` from an extension host

### Actions
1. Open **Netlify UI → Site configuration → Extensions**.
2. Disable/remove the failing extension (for this incident: `neon`).
3. Re-run deploy.
4. If extension is required, retry later once connectivity is restored.
5. If the failure repeats, contact Netlify support and include the failing host URL + deploy log.

### Why this works
Netlify installs extensions before running the configured build command (`npm ci && npm run build`). When extension package download fails, deployment exits early with a non-zero code.
