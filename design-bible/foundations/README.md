# Foundations - ATLAS Design Bible

> Tokens y fundamentos del sistema de diseño ATLAS

## 🎨 Colores (Tokens Bloqueados)

### Colores de Marca

```css
--atlas-blue: #042C5E;     /* Primario/CTA/links - ÚNICO azul permitido */
--atlas-teal: #1DA0BA;     /* Acento gestión PULSE */
--atlas-navy-1: #303A4C;   /* Texto principal */
--atlas-navy-2: #142C50;   /* Sidebar/topbar */
```

### Colores Funcionales

```css
--ok: #28A745;             /* Estado éxito */
--warn: #FFC107;           /* Estado advertencia */
--error: #DC3545;          /* Estado error */
--bg: #F8F9FA;             /* Fondo claro */
--text-gray: #6C757D;      /* Texto secundario */
```

### ⛔ Color Prohibido

```css
/* #09182E - NUNCA USAR - Color prohibido explícitamente */
```

## 📝 Tipografía

### Familia Tipográfica

**ÚNICA PERMITIDA**: Inter

```css
font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
```

**Pesos disponibles**: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

### Configuración Global

```css
/* Aplicar globalmente para datos financieros */
font-variant-numeric: tabular-nums;
```

### Escala Tipográfica

```css
--text-caption: 0.875rem;   /* 14px - Chips, etiquetas */
--text-body: 1rem;          /* 16px - Texto base */
--text-h2: 1.125rem;        /* 18px - Subtítulos */
--text-h1: 1.25rem;         /* 20px - Títulos */
--text-kpi: 1.5rem;         /* 24px - KPIs importantes */
--text-kpi-large: 1.75rem;  /* 28px - KPIs destacados */
--text-hero: 2rem;          /* 32px - Títulos principales */
```

## 🎯 Iconografía

### Set Único: Lucide

- **Librería**: `lucide-react`
- **Tamaño**: 24px por defecto
- **Stroke**: 1.5
- **Color**: `currentColor` (hereda del padre)

```tsx
import { Icon } from 'lucide-react';

<Icon size={24} strokeWidth={1.5} />
```

### ⛔ Iconos Prohibidos

- ❌ @heroicons/react
- ❌ @material-ui/icons
- ❌ react-icons
- ❌ @mui/icons

## 📐 Espaciado

### Grid Base: 4px

```css
/* Espaciado basado en múltiplos de 4px */
--space-1: 4px;    /* 0.25rem */
--space-2: 8px;    /* 0.5rem */
--space-3: 12px;   /* 0.75rem */
--space-4: 16px;   /* 1rem */
--space-5: 20px;   /* 1.25rem */
--space-6: 24px;   /* 1.5rem */
--space-8: 32px;   /* 2rem */
--space-10: 40px;  /* 2.5rem */
--space-12: 48px;  /* 3rem */
--space-16: 64px;  /* 4rem */
```

### Densidad Financiera

```css
/* Paddings específicos para tablas y formularios */
--padding-table: 8px;    /* Celdas de tabla */
--padding-form: 12px;    /* Campos de formulario */
--padding-dense: 6px;    /* Elementos muy densos */
```

## 🌍 Formatos ES (España)

### Números

```
Formato: 1.234.567,89
- Miles: punto (.)
- Decimales: coma (,)
- Sin espacios
```

### Fechas

```
Formato: DD/MM/AAAA
Ejemplos:
- 15/03/2024
- 01/12/2023
```

### Moneda

```
Formato: 1.234.567,89 €
- Separador miles: punto
- Separador decimales: coma
- Símbolo: € (al final con espacio)
```

### Ejemplos de Implementación

```typescript
// Formato número
const formatNumber = (value: number) => 
  new Intl.NumberFormat('es-ES').format(value);

// Formato moneda
const formatCurrency = (value: number) => 
  new Intl.NumberFormat('es-ES', { 
    style: 'currency', 
    currency: 'EUR' 
  }).format(value);

// Formato fecha
const formatDate = (date: Date) => 
  new Intl.DateTimeFormat('es-ES').format(date);
```

## 🔄 Versión

**v1.0.0** - Especificación inicial de foundations