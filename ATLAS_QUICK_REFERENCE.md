# 📋 ATLAS Compliance - Quick Reference

> Enlaces rápidos a toda la documentación ATLAS y herramientas de auditoría

## 🎯 Estado Actual

**ATLAS Linter**: ✅ 0 errores, 275 warnings  
**Compliance**: 73% completado  
**Última auditoría**: Diciembre 2024  

---

## 📚 Documentación Principal

### Guías de Usuario
- **[GUIA_USO_SENCILLO.md](./GUIA_USO_SENCILLO.md)** - Guía completa de uso intuitivo
  - 9 flujos principales con pasos detallados
  - Patrones de interacción
  - Checklist de UX
  - Atajos de teclado

### Guías de Desarrollo

#### Design Bible Completo
- **[Design Bible](./design-bible/README.md)** - Índice principal
- **[Foundations](./design-bible/foundations/README.md)** - Tokens base
- **[Changelog](./design-bible/changelog.md)** - Historial de cambios

#### Guías Específicas ATLAS
- **[ATLAS_BUTTON_GUIDE.md](./design-bible/ATLAS_BUTTON_GUIDE.md)** - Sistema de botones
  - 5 variantes (primary, secondary, destructive, ghost, success)
  - Tamaños y estados
  - Ejemplos y anti-patrones
  
- **[ATLAS_COLOR_TOKENS.md](./design-bible/ATLAS_COLOR_TOKENS.md)** - Tokens de color
  - 50+ mappings hex → tokens
  - Guía de transparencias
  - Ejemplos completos

### Auditorías
- **[AUDITORIA_ATLAS_COMPLETA.md](./AUDITORIA_ATLAS_COMPLETA.md)** - Informe ejecutivo completo
- **[AUDITORIA_FINAL_ATLAS.md](./AUDITORIA_FINAL_ATLAS.md)** - Auditoría anterior

---

## 🛠️ Herramientas y Scripts

### Scripts de Automatización

```bash
# Linter ATLAS (verificar compliance)
npm run lint:atlas

# Build con validación ATLAS
npm run build:atlas

# Fix confirmations (window.confirm → ATLAS)
node scripts/fix-window-confirm.js

# Replace colors (dry-run para ver cambios)
node scripts/replace-hardcoded-colors.js --dry-run

# Replace colors (aplicar cambios)
node scripts/replace-hardcoded-colors.js
```

### Scripts Disponibles
- **[fix-window-confirm.js](./scripts/fix-window-confirm.js)** - Migrar confirmaciones browser
- **[replace-hardcoded-colors.js](./scripts/replace-hardcoded-colors.js)** - Migrar colores a tokens
- **[atlas-lint.js](./scripts/atlas-lint.js)** - Linter ATLAS completo

---

## 🎨 Quick Reference

### Colores ATLAS

```css
/* Primarios */
var(--atlas-blue)      /* #042C5E - Primario, CTAs */
var(--atlas-teal)      /* #1DA0BA - PULSE accent */
var(--atlas-navy-1)    /* #303A4C - Texto principal */
var(--atlas-navy-2)    /* #142C50 - Sidebar */

/* Funcionales */
var(--ok)              /* #28A745 - Éxito */
var(--warn)            /* #FFC107 - Advertencia */
var(--error)           /* #DC3545 - Error */
var(--bg)              /* #F8F9FA - Fondo */
var(--text-gray)       /* #6C757D - Texto secundario */
```

### Clases de Botón

```tsx
<button className="atlas-btn-primary">    {/* Acción principal */}
<button className="atlas-btn-secondary">  {/* Cancelar */}
<button className="atlas-btn-destructive">{/* Eliminar */}
<button className="atlas-btn-ghost">      {/* Terciario */}
<button className="atlas-btn-success">    {/* Aprobar */}

{/* Tamaños */}
<button className="atlas-btn-primary atlas-btn-sm">
<button className="atlas-btn-primary atlas-btn-lg">
```

### Confirmaciones

```tsx
import { confirmDelete } from './services/confirmationService';

// Confirmar eliminación
const confirmed = await confirmDelete('este elemento');
if (confirmed) {
  // Proceder con eliminación
}
```

### Toasts

```tsx
import { showSuccess, showError, showWarning } from './services/toastService';

showSuccess('Operación exitosa');
showError('Error al guardar', 'Verifica los datos e inténtalo de nuevo');
showWarning('Datos incompletos');
```

---

## ✅ Checklist de Compliance

Para cualquier nuevo componente, verificar:

### Colores
- [ ] Usa `var(--atlas-*)` en lugar de hex
- [ ] No usa colores prohibidos (#09182E)
- [ ] Colores semánticos (ok/warn/error)

### Botones
- [ ] Usa clases `atlas-btn-*`
- [ ] No usa clases Tailwind directamente
- [ ] Incluye estados disabled cuando aplica

### Confirmaciones
- [ ] No usa `window.confirm()`
- [ ] Usa `confirmationService`
- [ ] Tipo apropiado (warning/danger/info)

### Iconos
- [ ] Usa Lucide React únicamente
- [ ] No usa @heroicons
- [ ] Tamaño 24px (o 16px en contextos pequeños)

### Tipografía
- [ ] Fuente Inter aplicada
- [ ] Pesos: 400, 500, 600, 700
- [ ] `font-variant-numeric: tabular-nums` para datos financieros

### UX
- [ ] Feedback con toast
- [ ] Estados vacíos informativos
- [ ] Loading states
- [ ] Navegable por teclado
- [ ] Mensajes de error con solución

---

## 📊 Métricas de Progreso

```
ATLAS Compliance Progress
███████████████████████████░░░░░░░  73%

✅ Confirmaciones       100%
✅ Documentación        100%
🟡 Colores              40%
🟡 Botones              20%
⚪ Testing               0%
```

### Warnings por Categoría

| Categoría | Count | Acción |
|-----------|-------|--------|
| Botones no estándar | 211 | Script de migración pendiente |
| Colores hardcoded | 63 | `replace-hardcoded-colors.js` |
| Fuentes | 1 | Revisar manualmente |

---

## 🚀 Próximos Pasos

1. **Migrar botones** (211 warnings)
   - Crear script automatizado
   - Reemplazar clases Tailwind por ATLAS
   
2. **Continuar migración de colores** (63 warnings)
   - Ejecutar script periódicamente
   - Revisar casos especiales

3. **Testing de accesibilidad**
   - Navegación por teclado
   - Contraste WCAG AA
   - Screen readers

---

## 📞 Soporte

**Dudas sobre ATLAS**: Ver Design Bible en `/design-bible/`  
**Reportar issues**: GitHub Issues  
**Sugerencias**: Equipo de Product  

---

## 🔗 Enlaces Útiles

- [Design Bible README](./design-bible/README.md)
- [Guía de Uso Sencillo](./GUIA_USO_SENCILLO.md)
- [Auditoría Completa](./AUDITORIA_ATLAS_COMPLETA.md)
- [Tokens de Color](./design-bible/ATLAS_COLOR_TOKENS.md)
- [Guía de Botones](./design-bible/ATLAS_BUTTON_GUIDE.md)

---

**Última actualización**: Diciembre 2024  
**Versión**: 1.0
