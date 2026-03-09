# 🔦 Lighthouse Accessibility Audit Guide

> Complete guide for running and interpreting Lighthouse accessibility audits for ATLAS application

## 🎯 Overview

Lighthouse is an automated tool by Google for improving web page quality. This guide focuses on the **Accessibility** category to ensure WCAG 2.1 Level AA compliance.

**Target Score**: 90+ (out of 100)  
**Current Baseline**: Not yet tested (estimated 70-75 based on automated tests)

---

## 📋 Prerequisites

### Option 1: Chrome DevTools (Recommended)
- Chrome browser (version 90+)
- No installation required

### Option 2: Lighthouse CLI
```bash
# Install globally
npm install -g lighthouse

# Or use npx (no installation)
npx lighthouse --version
```

### Option 3: Chrome Extension
- Install [Lighthouse Extension](https://chrome.google.com/webstore/detail/lighthouse/blipmdconlkpinefehnmjammfjpmpbjk)

---

## 🚀 Running Lighthouse Audits

### Method 1: Chrome DevTools

1. **Start the application**:
   ```bash
   npm start
   # App runs at http://localhost:3000
   ```

2. **Open Chrome DevTools**:
   - Press `F12` or `Ctrl+Shift+I` (Windows/Linux)
   - Press `Cmd+Option+I` (macOS)

3. **Navigate to Lighthouse tab**:
   - Click "Lighthouse" tab in DevTools
   - If not visible: Click `>>` and select "Lighthouse"

4. **Configure audit**:
   - ✅ Check "Accessibility" category
   - ⚪ Uncheck other categories (optional)
   - Select "Desktop" or "Mobile" device
   - Click "Analyze page load"

5. **Wait for results** (30-60 seconds)

6. **Save report**:
   - Click "💾 Save as HTML" button
   - Save to `lighthouse-reports/` folder

### Method 2: Lighthouse CLI

```bash
# Basic accessibility audit
npx lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --output=html \
  --output-path=./lighthouse-reports/audit-$(date +%Y%m%d).html

# Full audit (all categories)
npx lighthouse http://localhost:3000 \
  --output=html \
  --output-path=./lighthouse-reports/full-audit-$(date +%Y%m%d).html

# Audit specific page
npx lighthouse http://localhost:3000/horizon/panel \
  --only-categories=accessibility \
  --output=html \
  --output-path=./lighthouse-reports/panel-audit.html

# CI/CD friendly (JSON output)
npx lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --output=json \
  --output-path=./lighthouse-reports/audit.json
```

---

## 📊 Key Pages to Audit

### Critical User Flows

1. **Login/Authentication**
   - `/login`
   - Target: 95+ score

2. **Dashboard/Panel**
   - `/horizon/panel`
   - Target: 90+ score

3. **Property Management**
   - `/horizon/inmuebles/cartera`
   - Target: 90+ score

4. **Forms (Data Entry)**
   - `/horizon/inmuebles/contratos/nuevo`
   - Target: 90+ score

5. **Document Management**
   - `/inbox`
   - Target: 90+ score

### Audit All Critical Pages

```bash
#!/bin/bash
# Create reports directory
mkdir -p lighthouse-reports

# Critical pages array
pages=(
  "/"
  "/horizon/panel"
  "/horizon/inmuebles/cartera"
  "/horizon/tesoreria"
  "/inbox"
)

# Audit each page
for page in "${pages[@]}"; do
  page_name=$(echo "$page" | sed 's/\//-/g' | sed 's/^-//')
  if [ -z "$page_name" ]; then
    page_name="home"
  fi
  
  echo "Auditing: $page"
  npx lighthouse "http://localhost:3000$page" \
    --only-categories=accessibility \
    --output=html \
    --output-path="./lighthouse-reports/${page_name}-$(date +%Y%m%d).html"
done

echo "✅ All audits complete! Check lighthouse-reports/ folder"
```

---

## 🔍 Understanding Lighthouse Results

### Score Ranges

| Score | Status | Action Required |
|-------|--------|-----------------|
| 90-100 | ✅ Good | Maintain quality |
| 50-89 | ⚠️ Needs Improvement | Address issues |
| 0-49 | ❌ Poor | Immediate action |

### Common Issues and Fixes

#### 1. **Missing aria-labels on interactive elements**
**Issue**: Buttons, links without accessible names  
**Fix**: Run our script
```bash
npm run fix:aria-labels
```

#### 2. **Low color contrast**
**Issue**: Text doesn't meet WCAG AA standards  
**Fix**: Use ATLAS color tokens
```typescript
// ❌ Bad
<div className="text-yellow-400 bg-white">

// ✅ Good
<div style={{ color: 'var(--atlas-navy-1)', backgroundColor: 'var(--bg)' }}>
```

#### 3. **Missing form labels**
**Issue**: Input fields without associated labels  
**Fix**: Add proper labels
```tsx
// ❌ Bad
<input type="text" placeholder="Name" />

// ✅ Good
<label htmlFor="name">Name</label>
<input id="name" type="text" />
```

#### 4. **Images without alt text**
**Issue**: `<img>` tags missing alt attribute  
**Fix**: Always include alt text
```tsx
// ❌ Bad
<img src="/logo.png" />

// ✅ Good
<img src="/logo.png" alt="ATLAS Logo" />

// ✅ Good (decorative)
<img src="/decoration.png" alt="" role="presentation" />
```

#### 5. **Heading order**
**Issue**: Skipping heading levels (h1 → h3)  
**Fix**: Use proper hierarchy
```tsx
// ❌ Bad
<h1>Dashboard</h1>
<h3>Properties</h3>

// ✅ Good
<h1>Dashboard</h1>
<h2>Properties</h2>
```

#### 6. **Non-semantic HTML**
**Issue**: Using divs for buttons  
**Fix**: Run our conversion script
```bash
npm run fix:divs-to-buttons
```

---

## 📈 Tracking Progress

### Create Baseline Report

```bash
# Run comprehensive audit
npm start &
sleep 5  # Wait for app to start

npx lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --output=html,json \
  --output-path=./lighthouse-reports/baseline

# View HTML report
open lighthouse-reports/baseline.html  # macOS
xdg-open lighthouse-reports/baseline.html  # Linux
start lighthouse-reports/baseline.html  # Windows
```

### Compare Reports

Lighthouse provides comparison view in newer versions:
```bash
# Run audit before fixes
npx lighthouse http://localhost:3000 \
  --output=json \
  --output-path=./lighthouse-reports/before.json

# Apply fixes...

# Run audit after fixes
npx lighthouse http://localhost:3000 \
  --output=json \
  --output-path=./lighthouse-reports/after.json

# Compare (requires lighthouse-ci)
npm install -g @lhci/cli
lhci compare \
  --base=./lighthouse-reports/before.json \
  --current=./lighthouse-reports/after.json
```

---

## 🎯 Target Metrics

### Accessibility Category Breakdown

| Audit | Weight | Target | Notes |
|-------|--------|--------|-------|
| **[aria-*] attributes valid** | High | 100% | Validated ARIA |
| **Button elements have accessible name** | High | 100% | All buttons labeled |
| **Color contrast sufficient** | High | 100% | WCAG AA |
| **[id] attributes unique** | High | 100% | No duplicate IDs |
| **Image elements have [alt]** | High | 100% | All images |
| **Form elements have labels** | High | 100% | All inputs |
| **[role]s have required [aria-*]** | Medium | 100% | Complete ARIA |
| **Heading elements in order** | Medium | 95%+ | Proper hierarchy |
| **[tabindex] no greater than 0** | Medium | 100% | Natural tab order |
| **Interactive elements accessible** | Medium | 100% | Keyboard nav |

### Expected Score by Phase

| Phase | Score | Status |
|-------|-------|--------|
| **Current (Baseline)** | 70-75 | 🟡 Estimated |
| **After aria-labels** | 75-80 | 🎯 Target |
| **After div→button** | 80-85 | 🎯 Target |
| **After contrast fixes** | 85-90 | 🎯 Target |
| **Final (All fixes)** | 90-95 | ✅ Goal |

---

## 🔄 CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/lighthouse.yml`:

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build app
        run: npm run build
        
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/horizon/panel
          uploadArtifacts: true
          temporaryPublicStorage: true
```

### NPM Script for Local CI

Add to `package.json`:
```json
{
  "scripts": {
    "audit:lighthouse": "lighthouse http://localhost:3000 --only-categories=accessibility --output=html --output-path=./lighthouse-reports/latest.html",
    "audit:all-pages": "bash scripts/lighthouse-audit-all.sh"
  }
}
```

---

## 📝 Reporting Template

### Lighthouse Audit Report

**Date**: YYYY-MM-DD  
**Auditor**: [Name]  
**Lighthouse Version**: [Version]  
**Chrome Version**: [Version]

#### Overall Score
- **Accessibility**: XX/100
- **Change from Previous**: +/- X points

#### Passed Audits (XX)
- ✅ All buttons have accessible names
- ✅ Color contrast meets WCAG AA
- ✅ All images have alt text
- ✅ Form fields have labels
- ✅ [List other passed audits]

#### Failed Audits (XX)
1. **[Audit Name]** - X occurrences
   - Location: [Component/Page]
   - Issue: [Description]
   - Fix: [Suggested fix]
   - Priority: High/Medium/Low

#### Recommendations
1. [High priority recommendation]
2. [Medium priority recommendation]
3. [Low priority recommendation]

#### Next Steps
- [ ] Fix high priority issues
- [ ] Re-run audit to verify
- [ ] Document improvements

---

## 🛠️ Troubleshooting

### Issue: Lighthouse won't connect

**Solution**:
```bash
# Ensure app is running
lsof -i :3000

# Kill existing process if needed
kill -9 $(lsof -t -i :3000)

# Restart app
npm start
```

### Issue: Audit fails with errors

**Solution**:
- Check browser console for errors
- Ensure all dependencies loaded
- Try incognito mode (no extensions)
- Clear browser cache

### Issue: Score varies between runs

**Solution**:
- Run multiple times and average
- Use consistent device/network settings
- Disable browser extensions
- Use CLI for consistent results

---

## 📚 Resources

### Official Documentation
- [Lighthouse Docs](https://developers.google.com/web/tools/lighthouse)
- [Accessibility Audits](https://web.dev/lighthouse-accessibility/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### ATLAS Resources
- `ATLAS_ACCESSIBILITY_TESTING.md` - Manual testing guide
- `ATLAS_ACCESSIBILITY_RESULTS.md` - Assessment results
- `npm run test:accessibility` - Automated tests

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Extension](https://wave.webaim.org/extension/)
- [pa11y](https://pa11y.org/)

---

## ✅ Quick Checklist

Before running Lighthouse audit:

- [ ] App is running (`npm start`)
- [ ] All ATLAS linter warnings addressed
- [ ] Automated accessibility tests passed
- [ ] Manual keyboard navigation tested
- [ ] Reports directory created (`mkdir -p lighthouse-reports`)
- [ ] Chrome browser updated to latest version

After running Lighthouse audit:

- [ ] Score documented in tracking sheet
- [ ] Failed audits analyzed
- [ ] Fixes prioritized
- [ ] Issues created for tracking
- [ ] Report saved in lighthouse-reports/
- [ ] Results shared with team

---

**Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: After implementing fixes  
**Maintained by**: ATLAS Development Team
