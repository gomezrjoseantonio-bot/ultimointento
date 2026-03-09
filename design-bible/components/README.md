# Components - ATLAS Design Bible

> Guía de estilo para todos los componentes UI de ATLAS

## 🔘 Botones

### Primario
**Uso**: Acción principal en cada pantalla
```css
background-color: var(--atlas-blue);  /* #042C5E */
color: white;
padding: 12px 16px;
border-radius: 6px;
font-weight: 500;
```

### Secundario
**Uso**: Acciones secundarias
```css
background-color: transparent;
color: var(--atlas-blue);
border: 1px solid var(--atlas-blue);
padding: 12px 16px;
border-radius: 6px;
font-weight: 500;
```

### Destructivo
**Uso**: Acciones de eliminación/peligro
```css
background-color: var(--error);  /* #DC3545 */
color: white;
padding: 12px 16px;
border-radius: 6px;
font-weight: 500;
```

## 🏷️ Chips/Badges

### Neutral
**Uso**: Etiquetas generales, estados OCR
```css
background-color: #ECF7FA;
color: #0F3D62;
padding: 4px 8px;
border-radius: 6px;
font-size: 0.875rem;
font-weight: 500;
```

### Gestión (PULSE)
**Uso**: Elementos relacionados con gestión
```css
background-color: rgba(29, 160, 186, 0.1);
color: var(--atlas-teal);  /* #1DA0BA */
padding: 4px 8px;
border-radius: 6px;
font-size: 0.875rem;
font-weight: 500;
```

### Estados
```css
/* Éxito */
.chip-success {
  background-color: rgba(40, 167, 69, 0.1);
  color: var(--ok);  /* #28A745 */
}

/* Advertencia */
.chip-warning {
  background-color: rgba(255, 193, 7, 0.1);
  color: var(--warn);  /* #FFC107 */
}

/* Error */
.chip-error {
  background-color: rgba(220, 53, 69, 0.1);
  color: var(--error);  /* #DC3545 */
}
```

## 🚨 Alerts/Toasts

### Principios
- ❌ **SIN overlays oscuros**
- ✅ **Fondos claros únicamente**
- ✅ **Bordes definidos**
- ✅ **Iconos Lucide**

### Alert Card
```css
background-color: white;
border: 1px solid var(--hz-neutral-300);
border-radius: 10px;
padding: 16px;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
```

### Toast
```css
background-color: white;
border: 1px solid var(--hz-neutral-300);
border-radius: 10px;
padding: 12px 16px;
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
position: fixed;
top: 20px;
right: 20px;
```

## 🗂️ Modales

### Principios
- ❌ **SIN overlays oscuros**
- ✅ **Overlay claro (rgba(255,255,255,0.8))**
- ✅ **Modal centrado con sombra**
- ✅ **Cerrable con Esc**

```css
/* Overlay */
.modal-overlay {
  background-color: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(2px);
}

/* Modal */
.modal-content {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  padding: 24px;
}
```

## 📱 Drawers

### Principios
- ✅ **Slide desde lateral**
- ✅ **Fondo blanco**
- ✅ **Sombra pronunciada**

```css
.drawer {
  background-color: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  min-width: 320px;
  padding: 24px;
}
```

## 🧭 Sidebar/Topbar

### Sidebar
```css
background-color: var(--atlas-navy-2);  /* #142C50 */
width: 256px;
```

### Separadores
**OBLIGATORIOS** - Deben ser visibles
```css
.sidebar-separator {
  color: #9CA3AF;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 16px;
  margin-top: 16px;
}
```

### Item Activo
```css
background-color: var(--atlas-blue);  /* #042C5E */
color: white;
border-radius: 8px;
```

### Topbar
```css
background-color: white;
border-bottom: 1px solid var(--hz-neutral-300);
height: 64px;
padding: 0 24px;
```

## 📊 Tablas

### Principios
- ✅ **Headers sortable**
- ✅ **Zebra stripes opcionales**
- ✅ **Padding denso (8px)**
- ✅ **Números tabulares**

```css
.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.table th {
  background-color: var(--bg);  /* #F8F9FA */
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid var(--hz-neutral-300);
}

.table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--hz-neutral-300);
  font-variant-numeric: tabular-nums;
}

.table tbody tr:nth-child(even) {
  background-color: rgba(248, 249, 250, 0.5);
}
```

## 📝 Inputs/Selects

### Input Base
```css
background-color: white;
border: 1px solid var(--hz-neutral-300);
border-radius: 6px;
padding: 12px;
font-family: "Inter", system-ui, sans-serif;
font-size: 1rem;
```

### Estados
```css
/* Focus */
.input:focus {
  outline: 2px solid var(--atlas-blue);
  outline-offset: 1px;
  border-color: var(--atlas-blue);
}

/* Error */
.input-error {
  border-color: var(--error);
  outline-color: var(--error);
}
```

### Placeholders
**Ejemplos útiles**:
- `"DD/MM/AAAA"` para fechas
- `"0,00 €"` para importes
- `"Introduce el concepto..."` para textos

## 📅 Datepickers

```css
.datepicker {
  background-color: white;
  border: 1px solid var(--hz-neutral-300);
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.datepicker-day-selected {
  background-color: var(--atlas-blue);
  color: white;
}
```

## 💬 Tooltips

### Principios
- ✅ **Accesibles (hover + focus)**
- ✅ **Fondo claro**
- ✅ **Texto legible**

```css
.tooltip {
  background-color: white;
  border: 1px solid var(--hz-neutral-300);
  border-radius: 6px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-size: 0.875rem;
  max-width: 200px;
}
```

## 🎴 Cards

```css
.card {
  background-color: white;
  border: 1px solid var(--hz-neutral-300);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
}

.card-header {
  margin-bottom: 16px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--atlas-navy-1);
}
```

## 📭 Empty States

### Principios
- ✅ **Icono Lucide representativo**
- ✅ **Mensaje claro y accionable**
- ✅ **CTA cuando corresponda**

```css
.empty-state {
  text-align: center;
  padding: 48px 24px;
}

.empty-state-icon {
  color: var(--text-gray);
  margin-bottom: 16px;
}

.empty-state-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--atlas-navy-1);
  margin-bottom: 8px;
}

.empty-state-description {
  color: var(--text-gray);
  margin-bottom: 24px;
}
```

## 🔄 Versión

**v1.0.0** - Especificación inicial de componentes