# 🎨 Referencia de Tokens de Color ATLAS

> Guía completa para usar tokens de color en lugar de valores hardcodeados

## 🎯 Principio Fundamental

**NUNCA uses colores hardcodeados** (`#042C5E`, `rgb(4, 44, 94)`, etc.)

**SIEMPRE usa tokens CSS** (`var(--atlas-blue)`, `var(--ok)`, etc.)

---

## 📋 Tokens Primarios ATLAS

### Colores de Marca

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `var(--atlas-blue)` | `#042C5E` | Color primario, botones, links, CTA |
| `var(--atlas-teal)` | `#1DA0BA` | Acento para módulo PULSE |
| `var(--atlas-navy-1)` | `#303A4C` | Texto principal |
| `var(--atlas-navy-2)` | `#142C50` | Sidebar, topbar |

**Ejemplo**:
```tsx
// ❌ INCORRECTO
<button style={{ backgroundColor: '#042C5E' }}>

// ✅ CORRECTO
<button style={{ backgroundColor: 'var(--atlas-blue)' }}>
<button className="bg-[var(--atlas-blue)]">
```

---

## 🎨 Tokens Funcionales

### Estados

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `var(--ok)` | `#28A745` | Éxito, aprobado, validado |
| `var(--warn)` | `#FFC107` | Advertencia, pendiente, atención |
| `var(--error)` | `#DC3545` | Error, rechazado, crítico |

**Ejemplo**:
```tsx
// ❌ INCORRECTO
<span className="text-[#28A745]">Aprobado</span>

// ✅ CORRECTO
<span style={{ color: 'var(--ok)' }}>Aprobado</span>
```

### Fondos

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `var(--bg)` | `#F8F9FA` | Fondo claro base |
| `var(--hz-card-bg)` | `#FFFFFF` | Fondo de tarjetas |

### Textos

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `var(--atlas-navy-1)` | `#303A4C` | Texto principal |
| `var(--text-gray)` | `#6C757D` | Texto secundario, hints |

---

## 🏢 Tokens Horizon (Módulo Inmobiliario)

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `var(--hz-primary)` | `#042C5E` | Primario Horizon |
| `var(--hz-bg)` | `#F8F9FA` | Fondo Horizon |
| `var(--hz-text)` | `#303A4C` | Texto Horizon |
| `var(--hz-success)` | `#28A745` | Éxito Horizon |
| `var(--hz-warning)` | `#FFC107` | Warning Horizon |
| `var(--hz-error)` | `#DC3545` | Error Horizon |
| `var(--hz-info)` | `#042C5E` | Info Horizon |

### Neutrales Horizon

| Token CSS | Uso |
|-----------|-----|
| `var(--hz-neutral-900)` | Texto más oscuro |
| `var(--hz-neutral-700)` | Texto secundario |
| `var(--hz-neutral-500)` | Texto muted |
| `var(--hz-neutral-300)` | Bordes claros |
| `var(--hz-neutral-100)` | Fondos claros |

**Ejemplo**:
```tsx
// ❌ INCORRECTO
<div className="border-[#DEE2E6]">

// ✅ CORRECTO
<div style={{ borderColor: 'var(--hz-neutral-300)' }}>
```

---

## 💰 Tokens para Movimientos Financieros

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `var(--movement-previsto-ingreso)` | `#28A745` | Ingreso previsto |
| `var(--movement-previsto-gasto)` | `#DC3545` | Gasto previsto |
| `var(--movement-confirmado)` | `#042C5E` | Movimiento confirmado |
| `var(--movement-vencido)` | `#FFC107` | Vencido/atrasado |
| `var(--movement-no-previsto)` | `#6C757D` | No previsto |

**Ejemplo**:
```tsx
// ❌ INCORRECTO
const color = type === 'ingreso' ? '#28A745' : '#DC3545';

// ✅ CORRECTO
const color = type === 'ingreso' 
  ? 'var(--movement-previsto-ingreso)' 
  : 'var(--movement-previsto-gasto)';
```

---

## 🎭 Transparencias y Opacidades

Para colores con opacidad, usa `rgba()` con los valores RGB del token:

| Color Base | RGBA |
|------------|------|
| ATLAS Blue | `rgba(4, 44, 94, 0.1)` - fondo suave |
| ATLAS Blue | `rgba(4, 44, 94, 0.2)` - hover |
| OK Green | `rgba(40, 167, 69, 0.1)` - success bg |
| Warning | `rgba(255, 193, 7, 0.1)` - warning bg |
| Error | `rgba(220, 53, 69, 0.1)` - error bg |

**Ejemplo**:
```tsx
// ✅ CORRECTO
<div style={{ 
  backgroundColor: 'rgba(4, 44, 94, 0.05)',
  borderColor: 'var(--atlas-blue)' 
}}>
```

---

## 🔄 Mapeo de Colores Comunes

### Azules
| Hardcoded | Token ATLAS |
|-----------|-------------|
| `#042C5E` | `var(--atlas-blue)` |
| `#0B2B5C` | `var(--atlas-blue)` |
| `#022D5E` | `var(--atlas-blue)` |
| `#0A2A57` | `var(--atlas-blue)` |
| `#0A84FF` | `var(--atlas-blue)` |

### Grises y Neutrales
| Hardcoded | Token ATLAS |
|-----------|-------------|
| `#303A4C` | `var(--atlas-navy-1)` |
| `#6C757D` | `var(--text-gray)` |
| `#6B7280` | `var(--text-gray)` |
| `#F8F9FA` | `var(--bg)` |
| `#F3F4F6` | `var(--hz-neutral-100)` |
| `#E5E7EB` | `var(--hz-neutral-300)` |
| `#D7DEE7` | `var(--hz-neutral-300)` |
| `#D1D5DB` | `var(--hz-neutral-300)` |

### Verdes (Success)
| Hardcoded | Token ATLAS |
|-----------|-------------|
| `#28A745` | `var(--ok)` |
| `#10B981` | `var(--ok)` |
| `#D1FAE5` | `rgba(40, 167, 69, 0.1)` |

### Amarillos (Warning)
| Hardcoded | Token ATLAS |
|-----------|-------------|
| `#FFC107` | `var(--warn)` |
| `#F59E0B` | `var(--warn)` |

### Rojos (Error)
| Hardcoded | Token ATLAS |
|-----------|-------------|
| `#DC3545` | `var(--error)` |
| `#EF4444` | `var(--error)` |
| `#DC2626` | `var(--error)` |

---

## 🛠️ Herramientas

### Script de Reemplazo Automático

Usa el script para migrar colores automáticamente:

```bash
# Ver qué se cambiaría (dry-run)
node scripts/replace-hardcoded-colors.js --dry-run

# Aplicar cambios
node scripts/replace-hardcoded-colors.js

# Ver detalles
node scripts/replace-hardcoded-colors.js --verbose
```

### Linter ATLAS

Verifica cumplimiento:

```bash
npm run lint:atlas
```

---

## ✅ Checklist de Migración

Al migrar un componente:

- [ ] Buscar todos los `#` hex colors
- [ ] Reemplazar por tokens `var(--*)`
- [ ] Buscar `rgb()` y `rgba()`
- [ ] Verificar que los colores tengan semántica correcta
- [ ] Ejecutar `npm run lint:atlas`
- [ ] Probar visualmente el componente
- [ ] Verificar estados (hover, focus, disabled)

---

## 🚫 Colores Prohibidos

❌ **NUNCA usar**:
- `#09182E` - Explícitamente prohibido en ATLAS
- `#1e40af` - No es token ATLAS
- Cualquier color que no esté en esta guía

---

## 📚 Referencias

- **Tokens CSS**: `/src/index.css` - Definiciones completas
- **Tailwind Config**: `/tailwind.config.js` - Tokens en Tailwind
- **Design Bible**: `/design-bible/foundations/README.md`

---

## 💡 Ejemplos Completos

### Componente con Tokens

```tsx
import React from 'react';

const StatusBadge: React.FC<{ status: 'ok' | 'warn' | 'error' }> = ({ status }) => {
  const colors = {
    ok: {
      bg: 'rgba(40, 167, 69, 0.1)',
      text: 'var(--ok)',
      border: 'var(--ok)'
    },
    warn: {
      bg: 'rgba(255, 193, 7, 0.1)',
      text: 'var(--warn)',
      border: 'var(--warn)'
    },
    error: {
      bg: 'rgba(220, 53, 69, 0.1)',
      text: 'var(--error)',
      border: 'var(--error)'
    }
  };

  return (
    <span style={{
      backgroundColor: colors[status].bg,
      color: colors[status].text,
      border: `1px solid ${colors[status].border}`,
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      fontSize: '0.875rem',
      fontWeight: '500'
    }}>
      {status.toUpperCase()}
    </span>
  );
};
```

### Botón con Tokens

```tsx
const AtlasButton: React.FC = () => {
  return (
    <button
      className="atlas-btn-primary"
      style={{
        // Los tokens ya están aplicados por la clase
        // Pero puedes agregar overrides si es necesario
      }}
    >
      Guardar
    </button>
  );
};
```

---

**Versión**: 1.0  
**Última actualización**: 2024  
**Script de migración**: `/scripts/replace-hardcoded-colors.js`
