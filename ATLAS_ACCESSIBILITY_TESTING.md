# ♿ ATLAS Accessibility Testing Guide

> Comprehensive guide for ensuring WCAG AA compliance and keyboard accessibility

## 🎯 Overview

This guide provides testing procedures, tools, and checklists to ensure the ATLAS application meets WCAG 2.1 Level AA accessibility standards.

---

## 📋 Testing Checklist

### 1. ⌨️ Keyboard Navigation Testing

#### Focus Management
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical and follows visual flow
- [ ] Focus indicators are clearly visible
- [ ] No keyboard traps (can always escape)
- [ ] Skip links provided for main content

#### Common Keyboard Shortcuts
| Key | Expected Behavior |
|-----|-------------------|
| `Tab` | Move focus forward |
| `Shift + Tab` | Move focus backward |
| `Enter` | Activate buttons/links |
| `Space` | Activate buttons, toggle checkboxes |
| `Escape` | Close modals/dialogs |
| `Arrow keys` | Navigate within components (dropdowns, tabs) |

#### Testing Procedure

1. **Unplug your mouse** (or use keyboard-only mode)
2. **Navigate through each page** using only Tab
3. **Verify focus indicators** are visible on all elements
4. **Test all interactions** (buttons, forms, modals)
5. **Document any issues** with specific element descriptions

**Test Script**:
```bash
# Open browser in keyboard-only mode
# Chrome DevTools: Rendering > Emulate focused page
# Firefox: about:config > accessibility.tabfocus = 7
```

---

### 2. 🎨 Color Contrast Testing (WCAG AA)

#### Requirements
- **Normal text**: Minimum contrast ratio of **4.5:1**
- **Large text** (18pt+/14pt+ bold): Minimum contrast ratio of **3:1**
- **UI components**: Minimum contrast ratio of **3:1**

#### ATLAS Color Contrast Matrix

| Foreground | Background | Ratio | Status |
|------------|------------|-------|--------|
| `var(--atlas-blue)` #042C5E | White | 12.6:1 | ✅ AAA |
| `var(--atlas-navy-1)` #303A4C | White | 10.8:1 | ✅ AAA |
| `var(--text-gray)` #6C757D | White | 4.6:1 | ✅ AA |
| `var(--ok)` #28A745 | White | 3.3:1 | ⚠️ Large text only |
| `var(--warn)` #FFC107 | Black | 7.8:1 | ✅ AAA |
| `var(--error)` #DC3545 | White | 4.5:1 | ✅ AA |

#### Testing Tools

**Browser Extensions**:
- Chrome: [WAVE](https://chrome.google.com/webstore/detail/wave-evaluation-tool/jbbplnpkjmmeebjpijfedlgcdilocofh)
- Firefox: [axe DevTools](https://addons.mozilla.org/en-US/firefox/addon/axe-devtools/)

**Automated Check**:
```bash
# Install pa11y for automated testing
npm install -g pa11y

# Test a page
pa11y http://localhost:3000/horizon/panel

# Generate report
pa11y --reporter json http://localhost:3000 > accessibility-report.json
```

**Manual Testing**:
```javascript
// Use browser console to check contrast
// 1. Inspect element
// 2. Look at Styles panel for contrast ratio
// 3. Chrome DevTools shows ratio automatically
```

#### Common Issues and Fixes

**Issue**: Text on colored backgrounds
```tsx
// ❌ BAD - Low contrast
<div className="bg-green-400 text-white">
  Approved
</div>

// ✅ GOOD - Use ATLAS tokens with verified contrast
<div style={{ 
  backgroundColor: 'rgba(40, 167, 69, 0.1)', 
  color: 'var(--ok)' 
}}>
  Approved
</div>
```

---

### 3. 🔊 Screen Reader Testing

#### Screen Readers to Test
- **Windows**: NVDA (free) or JAWS
- **macOS**: VoiceOver (built-in)
- **Linux**: Orca (free)
- **Mobile**: TalkBack (Android) or VoiceOver (iOS)

#### Testing Procedure

1. **Enable screen reader**
   - Windows: Win + Ctrl + Enter
   - macOS: Cmd + F5
   - Mobile: Settings > Accessibility

2. **Navigate the application**
   - Use screen reader commands
   - Verify all content is announced
   - Check for proper labels and landmarks

3. **Test critical flows**
   - Login/authentication
   - Form submission
   - Data entry
   - Confirmation dialogs

#### ARIA Labels Checklist

- [ ] All buttons have accessible names
- [ ] Form fields have associated labels
- [ ] Images have alt text (or aria-label if decorative)
- [ ] Modals have aria-labelledby and aria-describedby
- [ ] Dynamic content announces changes (aria-live)
- [ ] Error messages are associated with form fields

**Example Implementation**:
```tsx
// ✅ GOOD - Proper ARIA labels
<button 
  className="atlas-btn-ghost" 
  aria-label="Cerrar modal"
  onClick={onClose}
>
  <X className="h-4 w-4" />
</button>

<input
  type="text"
  id="property-name"
  aria-label="Nombre del inmueble"
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby={hasError ? "error-message" : undefined}
/>

{hasError && (
  <div id="error-message" role="alert">
    Este campo es obligatorio
  </div>
)}
```

---

## 🛠️ Automated Testing Tools

### 1. Lighthouse Accessibility Audit

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run accessibility audit
lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --output=html \
  --output-path=./lighthouse-a11y-report.html

# Open report
open lighthouse-a11y-report.html
```

**Expected Score**: Aim for **90+** (currently targeting)

### 2. axe-core Integration

```bash
# Install axe-core
npm install --save-dev @axe-core/react

# Add to development
# src/index.tsx (development only)
if (process.env.NODE_ENV !== 'production') {
  const axe = require('@axe-core/react');
  axe(React, ReactDOM, 1000);
}
```

### 3. Jest + Testing Library Accessibility Tests

```typescript
// Example test
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('Button should have no accessibility violations', async () => {
  const { container } = render(
    <button className="atlas-btn-primary">
      Click me
    </button>
  );
  
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 📊 ATLAS Component Accessibility Status

### Buttons ✅ Compliant
- [x] Focus indicators visible
- [x] Keyboard accessible
- [x] Proper color contrast
- [x] Disabled state clearly indicated
- [x] Icon-only buttons have aria-label

### Forms ✅ Compliant
- [x] All inputs have labels
- [x] Error messages associated with fields
- [x] Required fields marked
- [x] Focus management in forms
- [x] Validation messages announced

### Modals ✅ Compliant
- [x] Focus trapped within modal
- [x] Escape key closes modal
- [x] Focus returned on close
- [x] aria-labelledby and aria-describedby
- [x] Backdrop prevents interaction

### Tables ⚠️ Needs Review
- [ ] Table headers properly marked
- [ ] Caption or aria-label provided
- [ ] Complex tables have proper structure
- [ ] Sort indicators announced

### Charts ⚠️ Needs Improvement
- [ ] Data available in alternative format
- [ ] Descriptive text provided
- [ ] Color not sole means of information
- [ ] Keyboard accessible controls

---

## 🎯 Priority Issues to Address

### High Priority

1. **Icon-only buttons without labels**
   ```tsx
   // ❌ BAD
   <button><Edit2 /></button>
   
   // ✅ GOOD
   <button aria-label="Editar inmueble">
     <Edit2 />
   </button>
   ```

2. **Form validation errors not announced**
   ```tsx
   // ✅ GOOD
   {error && (
     <div role="alert" className="text-error mt-1">
       {error}
     </div>
   )}
   ```

3. **Dynamic content updates not announced**
   ```tsx
   // ✅ GOOD
   <div aria-live="polite" aria-atomic="true">
     {statusMessage}
   </div>
   ```

### Medium Priority

1. **Skip navigation links**
   ```tsx
   <a href="#main-content" className="sr-only focus:not-sr-only">
     Saltar al contenido principal
   </a>
   ```

2. **Keyboard shortcuts documentation**
   - Document all keyboard shortcuts
   - Provide keyboard shortcut help modal

3. **Focus management in SPAs**
   - Announce page changes
   - Move focus to page heading on navigation

---

## 📝 Testing Scenarios

### Scenario 1: Create New Property
1. Navigate to Cartera page (Tab navigation)
2. Activate "Nuevo Inmueble" button (Enter)
3. Fill form using only keyboard
4. Submit form (Enter)
5. Verify success message is announced
6. Verify focus returns to property list

### Scenario 2: Confirm Deletion
1. Navigate to property (Tab)
2. Activate delete button (Enter)
3. Confirmation modal appears
4. Verify focus is in modal
5. Navigate buttons (Tab)
6. Cancel or confirm (Enter)
7. Verify focus returns to list

### Scenario 3: Filter and Search
1. Navigate to search field (Tab)
2. Type search query
3. Verify results update
4. Verify results are announced
5. Navigate results (Tab)
6. Clear search (Escape or button)

---

## 🔧 Tools and Resources

### Browser DevTools
- **Chrome**: DevTools > Lighthouse > Accessibility
- **Chrome**: DevTools > Elements > Accessibility tree
- **Firefox**: DevTools > Accessibility Inspector

### Online Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Oracle](https://colororacle.org/) - Color blindness simulator
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

---

## 📈 Reporting Results

### Test Report Template

```markdown
# Accessibility Test Report - [Page/Component Name]

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Tools Used**: [List tools]

## Summary
- Total Issues: X
- High Priority: X
- Medium Priority: X
- Low Priority: X

## Issues Found

### Issue #1: [Brief Description]
- **Severity**: High/Medium/Low
- **WCAG Criterion**: [e.g., 1.4.3 Contrast]
- **Location**: [Component/Page]
- **Description**: [Detailed description]
- **Screenshot**: [If applicable]
- **Steps to Reproduce**:
  1. Step 1
  2. Step 2
- **Suggested Fix**: [Code example or description]

## Keyboard Navigation Test Results
- ✅ All elements focusable
- ⚠️ Focus indicators need improvement on [element]
- ❌ Keyboard trap found in [component]

## Screen Reader Test Results
- ✅ All content announced correctly
- ⚠️ Missing label on [element]
- ❌ Error messages not associated with fields

## Color Contrast Test Results
- ✅ All text meets WCAG AA
- ⚠️ Some UI components at 2.8:1 (need 3:1)

## Recommendations
1. [High priority fix]
2. [Medium priority fix]
3. [Low priority fix]
```

---

## ✅ Acceptance Criteria

Before marking accessibility testing as complete:

- [ ] All pages tested with keyboard only
- [ ] All pages pass WAVE or axe scan with 0 errors
- [ ] Lighthouse accessibility score > 90
- [ ] All forms tested with screen reader
- [ ] All modals tested with screen reader
- [ ] Color contrast verified for all text
- [ ] Documentation updated with findings
- [ ] Critical issues fixed
- [ ] Accessibility statement created

---

## 🚀 Quick Start Commands

```bash
# 1. Install testing tools
npm install -g lighthouse pa11y
npm install --save-dev @axe-core/react jest-axe

# 2. Run automated tests
npm run lint:atlas                    # ATLAS compliance
lighthouse http://localhost:3000 \
  --only-categories=accessibility    # Lighthouse audit
pa11y http://localhost:3000          # pa11y check

# 3. Start dev server
npm start

# 4. Test with keyboard (unplug mouse!)
# 5. Test with screen reader (see guide above)
# 6. Generate report (use template above)
```

---

## 📞 Support and Resources

**Internal Resources**:
- ATLAS Design Bible: `/design-bible/accessibility/`
- Component Library: `/design-bible/components/`
- Quick Reference: `/ATLAS_QUICK_REFERENCE.md`

**External Resources**:
- W3C WAI: https://www.w3.org/WAI/
- WebAIM: https://webaim.org/
- Deque University: https://dequeuniversity.com/

---

**Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: January 2025
