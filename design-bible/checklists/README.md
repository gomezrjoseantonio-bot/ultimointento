# Checklists - ATLAS Design Bible

> Listas de validación rápidas para pantallas y features

## 🖥️ Checklist por Pantalla

### 📝 Desarrollo de Nueva Pantalla

```markdown
## Visual & Layout
- [ ] Fuente Inter aplicada correctamente
- [ ] font-variant-numeric: tabular-nums en datos numéricos
- [ ] Colores usan tokens ATLAS (no hardcoded)
- [ ] Iconos son únicamente de Lucide React
- [ ] Espaciado basado en grid de 4px
- [ ] Layout responsivo en móvil y desktop

## Componentes
- [ ] Botones siguen especificación (primario/secundario/destructivo)  
- [ ] Chips/badges usan colores apropiados para estado
- [ ] Cards tienen border, radius y shadow correctos
- [ ] Inputs tienen focus visible y placeholders útiles
- [ ] Empty states siguen patrón documentado

## Navegación
- [ ] Sidebar mantiene orden canónico exacto
- [ ] Separadores visibles en sidebar
- [ ] Item activo destacado en azul ATLAS
- [ ] Breadcrumbs (si aplica) usan separador "/"
- [ ] Links usan color atlas-blue

## Datos y Formatos
- [ ] Números: formato 1.234,56 (punto miles, coma decimales)
- [ ] Fechas: formato DD/MM/AAAA
- [ ] Moneda: formato 1.234,56 € (espacio antes del €)
- [ ] Porcentajes: formato XX,XX%
- [ ] Locale es-ES aplicado consistentemente

## Ayuda (SUA)
- [ ] Solo usa 4 patrones: EmptyState, InlineHint, InfoTooltip, HelperBanner
- [ ] NO hay ayuda en H1/H2
- [ ] NO hay modales de ayuda o tours
- [ ] Tooltips accesibles (hover + focus)

## Estados
- [ ] Loading state con spinner ATLAS
- [ ] Error states con mensajes accionables
- [ ] Success states con confirmación clara
- [ ] Empty states con CTA cuando corresponda
```

### 📱 Checklist Mobile Específico

```markdown
## Mobile UX
- [ ] Touch targets mínimo 44px
- [ ] Espaciado touch-friendly (mínimo 8px entre elementos)
- [ ] Drawer/modal cierra con gesture o botón visible
- [ ] Navegación accesible con pulgar
- [ ] Contenido legible sin zoom

## Performance Mobile
- [ ] Lazy loading en listas largas
- [ ] Imágenes optimizadas para móvil
- [ ] Componentes pesados diferidos
- [ ] Animaciones suaves (60fps)
```

## 🚀 Checklist por Feature Nueva

### 🔍 Diseño y Especificación

```markdown
## Documentación Requerida
- [ ] Propuesta añadida a /design-bible/components/ o /patterns/
- [ ] Ejemplos de código incluidos
- [ ] Casos de uso documentados
- [ ] Estados y variantes especificados
- [ ] Responsive behavior definido

## Consistencia Design System
- [ ] Usa tokens existentes (colores, espaciado, tipografía)
- [ ] Reutiliza patrones documentados
- [ ] Mantiene coherencia con componentes similares
- [ ] Considera impacto en changelog

## Accessibility desde Diseño
- [ ] Contraste verificado (mínimo WCAG AA)
- [ ] Navegación por teclado planificada
- [ ] ARIA labels identificadas
- [ ] Estructura semántica definida
```

### 💻 Implementación

```markdown
## Desarrollo
- [ ] Componente sigue API consistency
- [ ] Props tipadas correctamente (TypeScript)
- [ ] Variants manejadas con tokens
- [ ] Responsive implementado
- [ ] Performance optimizada

## Testing
- [ ] Unit tests para lógica
- [ ] Visual regression tests
- [ ] Accessibility tests (axe-core)
- [ ] Cross-browser testing
- [ ] Mobile testing en dispositivos reales

## Documentación Code
- [ ] JSDoc comments en props
- [ ] Ejemplos de uso en Storybook/docs
- [ ] Migration guide (si breaking change)
- [ ] README actualizado si necesario
```

### 🔍 Quality Assurance

```markdown
## QA Manual
- [ ] Funcionalidad completa verificada
- [ ] Estados edge case probados
- [ ] Responsive en múltiples dispositivos
- [ ] Navegación por teclado funcional
- [ ] Lector de pantalla compatible

## QA Automatizada  
- [ ] CI/CD pasa todas las validaciones
- [ ] Atlas-lint.js sin errores
- [ ] Bundle size impact aceptable
- [ ] Performance benchmarks OK
- [ ] Accessibility tests green
```

## 🎨 Checklist Tokens y Foundations

### 🎨 Nuevos Tokens de Color

```markdown
## Propuesta
- [ ] Justificación del nuevo token documentada
- [ ] Casos de uso específicos identificados  
- [ ] Contraste verificado para accesibilidad
- [ ] Valor hex exacto especificado
- [ ] Naming convention seguida

## Implementación
- [ ] Token añadido a CSS custom properties
- [ ] Tailwind config actualizado
- [ ] TypeScript types actualizados  
- [ ] Documentación en /foundations/ actualizada
- [ ] Ejemplos de uso incluidos

## Validación
- [ ] No conflicta con tokens existentes
- [ ] Pasa validaciones CI
- [ ] Usado consistentemente en codebase
- [ ] Migration path definido si reemplaza token existente
```

### 📏 Nuevos Tokens de Espaciado

```markdown
## Grid Compliance
- [ ] Múltiplo de 4px (grid base)
- [ ] Naming convention: --space-{number}
- [ ] Documentado en foundations
- [ ] Casos de uso específicos

## Implementación
- [ ] CSS custom properties
- [ ] Tailwind spacing scale
- [ ] Utilities classes generadas
- [ ] Ejemplos visuales
```

## 🔒 Checklist Compliance CI

### 🚨 Auditoría Bloqueante

```markdown
## Pre-commit Validation
- [ ] atlas-lint.js pasa sin errores
- [ ] No hex/rgb/hsl hardcoded (excepto definiciones token)
- [ ] Solo iconos Lucide importados
- [ ] Font-family solo Inter + fallbacks
- [ ] No clases dark:* detectadas
- [ ] No overlays oscuros/bg-black

## Build Validation  
- [ ] TypeScript compilation sin errores
- [ ] Bundle size dentro de límites
- [ ] Todas las dependencies resueltas
- [ ] Assets optimizados

## Deploy Validation
- [ ] Lighthouse performance >90
- [ ] Accessibility score >95
- [ ] Cross-browser compatibility
- [ ] Mobile usability OK
```

### 📊 Métricas y Monitoring

```markdown
## Performance
- [ ] First Contentful Paint <2s
- [ ] Largest Contentful Paint <2.5s
- [ ] Cumulative Layout Shift <0.1
- [ ] First Input Delay <100ms

## Accessibility
- [ ] axe-core 0 violations
- [ ] Keyboard navigation 100% functional
- [ ] Screen reader compatible
- [ ] WCAG AA compliance verified

## Design System Usage
- [ ] >95% componentes usan Design Bible
- [ ] 0 custom colors fuera de tokens
- [ ] 0 non-Lucide icons detectados
- [ ] 100% Inter typography
```

## 📋 Checklist Release

### 🚀 Pre-Release

```markdown
## Documentación
- [ ] Changelog actualizado con todas las changes
- [ ] Version bumping correcto (semantic versioning)
- [ ] Breaking changes documentados
- [ ] Migration guides creados (si necesario)
- [ ] Design Bible docs actualizadas

## Testing  
- [ ] Todas las test suites passing
- [ ] Manual QA completada
- [ ] Accessibility audit OK
- [ ] Performance regression testing
- [ ] Cross-browser validation

## Comunicación
- [ ] Release notes preparadas
- [ ] Equipo notificado de cambios importantes
- [ ] Timeline de migration comunicado
- [ ] Support docs actualizados
```

### 📦 Post-Release

```markdown
## Monitoring
- [ ] Error rates monitoring (primeras 24h)
- [ ] Performance metrics tracking
- [ ] User feedback collection
- [ ] Accessibility violations monitoring

## Support
- [ ] Documentation team notificado
- [ ] Support team briefed sobre cambios
- [ ] FAQ actualizada (si necesario)
- [ ] Issues tracking configurado

## Follow-up
- [ ] Adoption metrics tracking
- [ ] Feedback collection y análisis
- [ ] Next iteration planning
- [ ] Lessons learned documentadas
```

## 🔄 Versión

**v1.0.0** - Checklists iniciales para desarrollo y QA