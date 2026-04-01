# GUÍA DE DISEÑO DEFINITIVA ATLAS v4

> Documento único, exhaustivo y definitivo. Reemplaza v1, v2, v3 y todos los addendums.
> Toda la UI de ATLAS sigue este documento sin excepción. Si no está aquí, no existe.

---

## 1. PALETA — Solo 3 familias

ATLAS usa exactamente tres familias de color. Nada más.

### Navy (identidad, acción, texto)
```
--navy-900: #042C5E    → botones primarios, links, H1 activo, texto principal fuerte
--navy-800: #0A3A72    → hover de botones primarios
--navy-700: #142C50    → sidebar background
--navy-600: #1E3A5F    → sidebar hover
--navy-100: #E8EFF7    → fondo de badge neutro, fondo de sección activa
--navy-50:  #F0F4FA    → fondo de hover en tablas
```

### Teal (acento, dato vivo, interactividad)
```
--teal-600: #1DA0BA    → acento UI, datos en tiempo real, link secundario, icono activo
--teal-100: #E6F7FA    → fondo de badge "en curso", fondo de chip interactivo
```

### Gris (estructura, texto secundario, fondos, bordes)
```
--grey-900: #1A2332    → texto principal (H1, importes grandes)
--grey-700: #303A4C    → texto cuerpo
--grey-500: #6C757D    → texto secundario, labels, placeholders
--grey-400: #9CA3AF    → texto deshabilitado
--grey-300: #C8D0DC    → bordes
--grey-200: #DDE3EC    → separadores
--grey-100: #EEF1F5    → fondo de sección, zebra rows
--grey-50:  #F8F9FA    → fondo de página
--white:    #FFFFFF    → fondo de cards, modales
```

### Prohibido
```
❌ Rojo, verde, amarillo, lila, naranja — NO EXISTEN en ATLAS
❌ #09182E — prohibido explícitamente
❌ Cualquier color fuera de las 3 familias
```

### ¿Sin rojo/verde cómo distinguimos estados financieros?

**Con tipografía, signo y texto.** No necesitamos colores semáforo.

```
A pagar:    22.510,95 €   (navy-900, bold, texto "A pagar" debajo)
A devolver:  -494,64 €    (teal-600, bold, texto "A devolver" debajo)
```

- Importes positivos (el contribuyente debe) → navy-900
- Importes negativos (le devuelven) → teal-600
- El signo (-) y la palabra ("A devolver") hacen el trabajo
- No hace falta rojo ni verde. El usuario lee.

Para datos que no son "a pagar/devolver" sino cifras neutras (base imponible, valor catastral, etc.) → siempre grey-900.

---

## 2. TIPOGRAFÍA

### Familias
```
UI:       'IBM Plex Sans', system-ui, sans-serif
Importes: 'IBM Plex Mono', monospace
```

Toda cifra monetaria, porcentaje o dato numérico tabular usa IBM Plex Mono con `font-variant-numeric: tabular-nums`.

### Escala (única, sin excepciones)
```
--t-xs:   0.75rem  (12px)   → badges, chips, meta
--t-sm:   0.8125rem (13px)  → texto secundario, líneas de detalle
--t-base: 0.875rem (14px)   → texto cuerpo, tabs, botones
--t-md:   1rem     (16px)   → subtítulos, labels destacados
--t-lg:   1.125rem (18px)   → H2, nombres de sección
--t-xl:   1.375rem (22px)   → H1 de página
--t-2xl:  1.75rem  (28px)   → KPI principal, resultado declaración
```

### Pesos
```
400  → texto cuerpo
500  → labels, tabs activos, botones
600  → H2, subtotales, importes importantes
700  → H1, KPI principal
```

---

## 3. CABECERA DE PÁGINA — Idéntica en TODAS las secciones

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  [icono 20px]  H1 de página              [Acción]        │
│                Subtítulo gris                            │
│                                                          │
│   Tab1      Tab2      Tab3                               │
│   ────                                                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Reglas estrictas

1. **Icono**: Lucide, 20px, color grey-500, SIN fondo, SIN círculo, SIN cuadrado. Solo el icono.
2. **H1**: `--t-xl` (22px), weight 700, color grey-900. Una línea.
3. **Subtítulo**: `--t-sm` (13px), weight 400, color grey-500. Opcional. Una línea máximo.
4. **Acción primaria**: Un solo botón arriba a la derecha, alineado con H1. Máximo uno.
5. **Tabs**: underline, `--t-base` (14px), SIN iconos, SIN pills. Tab activo = navy-900 + underline 2px navy-900. Tab inactivo = grey-500.
6. **Separador**: línea `grey-200` debajo de los tabs.

### Aplicación por sección

| Sección | Icono (Lucide) | H1 | Subtítulo | Tabs | Acción |
|---------|---------------|-----|-----------|------|--------|
| Dashboard | LayoutDashboard | Dashboard ejecutivo | Mar 2026 | No | Actualizar valores |
| Personal | User | Personal | Gestión de finanzas personales | Resumen · Gastos · Ingresos | Configurar |
| Inmuebles | Building2 | Cartera inmobiliaria | — | Resumen · Cartera · Evolución · Individual | Nuevo inmueble |
| Inversiones | TrendingUp | Inversiones | — | Resumen · Cartera · Rendimientos · Individual | Nueva posición |
| Tesorería | Landmark | Tesorería | Conciliación mensual | — | Importar CSV |
| Previsiones | BarChart3 | Proyección mensual | — | Proyección · Presupuesto · Real vs Previsión | Exportar |
| Mi Plan | Target | Mi Plan | Seguimiento de objetivos | — | Editar objetivos |
| Impuestos | Scale | Impuestos | — | Mi IRPF · Historial | Importar |
| Financiación | CreditCard | Financiación | — | — | Crear préstamo |
| Alquileres | Key | Alquileres | — | (por definir) | — |
| Documentación | FileText | Documentación | — | — | — |

### Prohibido en cabeceras
```
❌ Badges tipo "HORIZON · PRESUPUESTO" — no existen conceptos internos en la UI
❌ Iconos con fondo de color (círculos, cuadrados rellenos)
❌ Iconos de más de 20px en la cabecera
❌ Más de un botón de acción en la cabecera
❌ Iconos dentro de tabs
❌ Pills como tabs de navegación (pills = solo selectores de período)
```

---

## 4. TABS — Solo 2 tipos

### Tipo 1: Underline (navegación entre vistas)
```css
.tab {
  font-size: var(--t-base);    /* 14px */
  font-weight: 400;
  color: var(--grey-500);
  padding: 10px 0;
  margin-right: 32px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.tab-active {
  font-weight: 500;
  color: var(--grey-900);
  border-bottom-color: var(--navy-900);
}
```
Uso: navegación entre páginas/vistas dentro de una sección.

### Tipo 2: Selector de período (años, meses)

Exactamente como en la captura: botones rectangulares con borde, flechas de navegación, año activo en bold con fondo.

```css
.period-selector {
  display: flex;
  align-items: center;
  gap: 0;
}

.period-btn {
  font-size: var(--t-base);       /* 14px */
  font-weight: 400;
  color: var(--grey-700);
  padding: 8px 16px;
  border: 1.5px solid var(--grey-300);
  background: var(--white);
  cursor: pointer;
  font-family: 'IBM Plex Sans';
}

/* Primer botón: borde izquierdo redondeado */
.period-btn:first-child {
  border-radius: 8px 0 0 8px;
}

/* Último botón: borde derecho redondeado */
.period-btn:last-child {
  border-radius: 0 8px 8px 0;
}

/* Botones intermedios: sin bordes duplicados */
.period-btn + .period-btn {
  border-left: none;
}

.period-btn-active {
  font-weight: 700;
  color: var(--grey-900);
  background: var(--grey-100);
}

/* Flechas < > integradas en el primer y último botón */
.period-nav {
  font-size: var(--t-sm);
  color: var(--grey-500);
}
```

Ejemplo:
```
[ < 2025 ][ 2026 ][ 2027 > ]
           ^^^^^^
           activo (bold + fondo gris)
```

Las flechas `<` y `>` van DENTRO del botón del año, no como botones separados.
- Botón izquierdo: `< 2025` (navega al anterior)
- Botón centro: `2026` (año activo, bold, fondo grey-100)
- Botón derecho: `2027 >` (navega al siguiente)

Se usa para: selector de año en Previsiones, Impuestos (pills de año aparte). Selector de mes en Tesorería.

**NUNCA iconos dentro de los botones de período.**

### Tipo 3: Pill (selector de ejercicio en Impuestos)

Para cuando hay muchos años visibles simultáneamente (Mi IRPF: 2026, 2025, 2024...).

```css
.pill {
  font-size: var(--t-sm);         /* 13px */
  font-weight: 400;
  color: var(--grey-700);
  padding: 6px 14px;
  border-radius: 20px;
  border: 1.5px solid var(--grey-300);
  background: var(--white);
  cursor: pointer;
}
.pill-active {
  font-weight: 600;
  color: var(--white);
  background: var(--navy-900);
  border-color: var(--navy-900);
}
```
Máximo 5 pills visibles + flechas (< >) si hay más.
**NUNCA iconos dentro de pills.**

---

## 5. BOTONES — 3 variantes, nada más

### Primario
```css
.btn-primary {
  background: var(--navy-900);
  color: var(--white);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: var(--t-base);
  font-weight: 500;
  border: none;
}
.btn-primary:hover {
  background: var(--navy-800);
}
```
Uso: acción principal. Máximo UNO por pantalla.

### Secundario
```css
.btn-secondary {
  background: transparent;
  color: var(--navy-900);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: var(--t-base);
  font-weight: 500;
  border: 1.5px solid var(--grey-300);
}
.btn-secondary:hover {
  background: var(--grey-50);
}
```
Uso: acciones secundarias, cancelar, exportar.

### Ghost
```css
.btn-ghost {
  background: transparent;
  color: var(--grey-500);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: var(--t-base);
  font-weight: 400;
  border: none;
}
.btn-ghost:hover {
  color: var(--grey-700);
  background: var(--grey-100);
}
```
Uso: acciones terciarias, links funcionales.

### Acciones destructivas
No hay botón rojo. Eliminar/descartar va en **menú kebab → confirmación modal**.
El modal de confirmación usa botón primario (navy) con texto claro: "Eliminar inmueble".

### Botones de cabecera (Importar, Exportar, Crear)

Los botones que van en la cabecera (arriba a la derecha, alineados con H1) siguen el mismo estilo del selector de período: rectangulares, borde grey-300, icono Lucide 16px + texto.

```css
.btn-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1.5px solid var(--grey-300);
  background: var(--white);
  color: var(--grey-700);
  font-size: var(--t-base);       /* 14px */
  font-weight: 500;
  cursor: pointer;
  font-family: 'IBM Plex Sans';
}
.btn-header:hover {
  background: var(--grey-50);
  color: var(--grey-900);
}
```

Ejemplo en cabecera:
```
[icono] H1 del módulo                  [ ↑ Importar ]  [ ↓ Exportar ]
        Subtítulo
```

Si la cabecera tiene un botón de CREAR (acción principal), ese sí es `btn-primary` (navy relleno):
```
[icono] Cartera inmobiliaria           [ + Nuevo inmueble ]  ← btn-primary
```

Si la cabecera tiene acciones secundarias (importar, exportar), son `btn-header` (borde gris):
```
[icono] Tesorería                      [ ↑ Importar CSV ]   ← btn-header
```

**Regla:** máximo 2 botones en cabecera. Si hay 1 primario + 1 secundario, van en ese orden (secundario izquierda, primario derecha). Si hay 2 secundarios, ambos `btn-header`.

### Cerrar, Cancelar, Volver, X — Definidos

Cuatro acciones de "salir" estandarizadas:

| Acción | Dónde | Cómo | Icono | Estilo |
|--------|-------|------|-------|--------|
| **Cerrar (X)** | Modales, drawers | Esquina superior derecha | `X` 20px | Solo icono, sin texto, grey-500, hover grey-700 |
| **Cancelar** | Wizards, formularios | Esquina superior derecha | `X` 16px + "Cancelar" | Texto + icono, ghost button, grey-500 |
| **Volver** | Ficha de detalle, subpáginas | Esquina superior izquierda (antes del H1) | `ArrowLeft` 20px | Solo icono, grey-500, hover grey-700 |
| **Cancelar en footer** | Dentro de wizard (paso a paso) | Botón izquierdo del footer | Sin icono | btn-secondary: "Anterior" o "Cancelar" |

```css
/* Cerrar modal (X) */
.btn-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--grey-500);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-close:hover {
  background: var(--grey-100);
  color: var(--grey-700);
}

/* Cancelar wizard (X + texto) */
.btn-cancel {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--t-sm);
  font-weight: 400;
  color: var(--grey-500);
  background: transparent;
  border: none;
  cursor: pointer;
}
.btn-cancel:hover {
  color: var(--grey-700);
}

/* Volver (flecha) */
.btn-back {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--grey-500);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-back:hover {
  background: var(--grey-100);
  color: var(--grey-700);
}
```

**Reglas:**
- **Modales**: siempre `X` arriba a la derecha + `Esc` para cerrar
- **Wizards**: siempre `× Cancelar` arriba a la derecha + `Anterior` en el footer
- **Fichas de detalle**: siempre `←` arriba a la izquierda antes del título
- **No mezclar**: un modal no tiene "Volver", una ficha no tiene "Cancelar"

---

## 6. BADGES Y CHIPS

### Badge de estado (texto + fondo)
```css
.badge {
  font-size: var(--t-xs);     /* 12px */
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 6px;
}
```

| Estado | Color texto | Fondo | Ejemplo |
|--------|-----------|-------|---------|
| En curso | teal-600 | teal-100 | Ejercicio fiscal vivo |
| Pendiente | grey-700 | grey-100 | Pendiente de presentar |
| Declarado | navy-900 | navy-100 | Ejercicio declarado |
| Activo | teal-600 | teal-100 | Contrato/inmueble activo |
| Inactivo | grey-400 | grey-100 | Contrato finalizado |
| Vacío | grey-400 | grey-100 | Sin datos |

Solo 6 estados. Sin amarillo, sin rojo, sin verde. La distinción es por la combinación de navy/teal/gris.

### Chip de acción (gastos faltantes, tags)
```css
.chip {
  font-size: var(--t-xs);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--grey-500);
  background: var(--grey-100);
  cursor: pointer;
}
.chip:hover {
  color: var(--grey-700);
  background: var(--grey-200);
}
```
Todos los chips son grises. No hay chips de colores.

---

## 7. CARDS

```css
.card {
  background: var(--white);
  border: 1px solid var(--grey-200);
  border-radius: 12px;
  padding: 24px;
}
```

Sin sombras. Sin bordes de color. Sin líneas de acento arriba.
La jerarquía visual se logra con tipografía y espaciado, no con decoración.

---

## 8. TABLAS

```css
.table th {
  font-size: var(--t-xs);
  font-weight: 600;
  color: var(--grey-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 10px 16px;
  background: var(--grey-50);
  border-bottom: 1px solid var(--grey-200);
}

.table td {
  font-size: var(--t-sm);
  color: var(--grey-700);
  padding: 12px 16px;
  border-bottom: 1px solid var(--grey-100);
}

.table tr:hover {
  background: var(--navy-50);
}
```

Importes en celdas: IBM Plex Mono, `--t-sm`, alineado a la derecha, `tabular-nums`.
Sin zebra stripes. El hover es suficiente para seguir la fila.

---

## 9. GRÁFICOS — Paleta de 6 tonos

Toda visualización usa esta paleta exacta, en este orden:

```
--chart-1: #042C5E    (navy-900)     → serie principal / categoría mayor
--chart-2: #1DA0BA    (teal-600)     → segunda serie
--chart-3: #5B8DB8    (navy claro)   → tercera serie
--chart-4: #A8C4DE    (navy pastel)  → cuarta serie
--chart-5: #C8D0DC    (grey-300)     → residual / "otros"
--chart-6: #303A4C    (grey-700)     → sexta serie (raro, evitar >5 series)
```

### Reglas de asignación
- **2 series**: chart-1 + chart-2
- **3 series**: chart-1 + chart-2 + chart-3
- **Donut/pie**: orden chart-1 → chart-5, categoría mayor siempre chart-1, "Otros" siempre chart-5
- **Barras positivas/negativas**: positivo = chart-1 (navy), negativo = chart-2 (teal)

### Barras de flujo de caja
```
Mes con flujo positivo: chart-1 (navy-900)
Mes con flujo negativo: chart-3 (navy claro, 50% opacidad)
```
No hay rojo para negativo. Se distingue porque la barra va hacia abajo y es más clara.

### Ejes y grid
```
Eje X labels:  --t-xs, grey-500
Eje Y labels:  --t-xs, grey-500
Grid lines:    grey-200, stroke-dasharray: 3 3
Zero line:     grey-300, solid
```

### Tooltip
```css
.chart-tooltip {
  background: var(--white);
  border: 1px solid var(--grey-200);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  font-size: var(--t-xs);
}
```
Sin fondos oscuros en tooltips. Siempre fondo blanco.

---

## 10. ICONOS — Solo Lucide

### Librería
```
lucide-react — ÚNICA permitida
```

### Tamaños
```
16px → dentro de botones, junto a texto, acciones de tabla
20px → cabeceras de página (junto a H1)
24px → navegación sidebar
48px → empty states
```

### Color
```
Siempre `currentColor` — hereda del padre.
```

### Iconos de acción en tablas
Siempre los mismos, siempre en el mismo orden:
```
Eye        → ver detalle
Download   → descargar (si hay archivo)
Upload     → importar (si falta archivo)
Pencil     → editar
MoreVertical → menú kebab (acciones secundarias)
```
Color: grey-500. Hover: grey-700.

### Iconos prohibidos
```
❌ Emoji en la UI (ni como icono, ni como decoración)
❌ SVG custom
❌ Cualquier librería que no sea lucide-react
❌ Iconos con fondo de color (círculos/cuadrados rellenos detrás)
```

---

## 11. EMPTY STATES

```
[icono Lucide 48px, grey-400]

Texto principal (--t-md, grey-700, weight 600)
Texto secundario (--t-sm, grey-500, weight 400)

[Botón primario]
```

Centrado. Sin ilustraciones. Sin imágenes decorativas. Solo icono + texto + CTA.

Si el usuario no ha configurado algo necesario, el empty state lo dice y lo enlaza:
```
"No hay objetivos configurados"
"Define tus objetivos para hacer seguimiento"
[Configurar objetivos]
```

---

## 12. SIDEBAR

```css
.sidebar {
  background: var(--navy-700);
  width: 240px;
  color: var(--white);
}

.sidebar-section-label {
  font-size: var(--t-xs);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  padding: 20px 16px 8px;
}

.sidebar-item {
  font-size: var(--t-base);
  font-weight: 400;
  color: rgba(255,255,255,0.65);
  padding: 8px 16px;
  border-radius: 8px;
  margin: 1px 8px;
}

.sidebar-item:hover {
  background: var(--navy-600);
  color: rgba(255,255,255,0.85);
}

.sidebar-item-active {
  background: var(--navy-900);
  color: var(--white);
  font-weight: 500;
}
```

### Secciones del sidebar (orden exacto)
```
SUPERVISIÓN
  Dashboard
  Personal
  Inmuebles
  Inversiones
  Tesorería
  Previsiones
  Mi Plan
  Impuestos
  Financiación
  Informes

GESTIÓN
  Alquileres

DOCS
  Documentación
  Herramientas
  Glosario
```

Iconos sidebar: Lucide 20px, misma opacidad que el texto.
Separadores entre secciones: solo el label uppercase + espacio. Sin líneas.

---

## 13. MODALES

```css
.modal-overlay {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(2px);
}

.modal {
  background: var(--white);
  border: 1px solid var(--grey-200);
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
```

Sin overlays oscuros. Siempre overlay claro. Cerrable con Esc.

---

## 14. INPUTS

```css
.input {
  font-family: 'IBM Plex Sans';
  font-size: var(--t-base);
  padding: 10px 16px;
  border: 1.5px solid var(--grey-300);
  border-radius: 8px;
  background: var(--white);
  color: var(--grey-900);
}

.input:focus {
  border-color: var(--navy-900);
  outline: 2px solid rgba(4, 44, 94, 0.15);
  outline-offset: 1px;
}

.input::placeholder {
  color: var(--grey-400);
}
```

---

## 15. ESPACIADO

```
Grid base: 4px
--s-1:  4px
--s-2:  8px
--s-3:  12px
--s-4:  16px
--s-5:  20px
--s-6:  24px
--s-8:  32px
--s-10: 40px
--s-12: 48px
--s-16: 64px

Border radius:
--r-sm: 4px    (chips, badges)
--r-md: 8px    (botones, inputs, tabs)
--r-lg: 12px   (cards, modales)
--r-xl: 20px   (pills de año)
```

---

## 16. FORMATOS ES

```
Números:    1.234.567,89     (punto miles, coma decimales)
Fechas:     15/03/2024       (DD/MM/AAAA)
Moneda:     1.234,56 €       (espacio antes de €)
Porcentaje: 4,50%            (sin espacio)
```

---

## 17. DATOS SIN CONFIGURAR

Cuando una sección necesita datos que el usuario no ha introducido:

**NO mostrar valores por defecto inventados.** 
**NO mostrar 0 € como si fuera un dato real.**
**SÍ mostrar "—" para valores ausentes.**
**SÍ mostrar empty state con CTA si toda la sección está vacía.**

Ejemplos concretos:
- Mi Plan sin objetivos → empty state "Configura tus objetivos"
- Previsiones sin perfil → empty state "Configura tu perfil para generar proyecciones"
- Tesorería sin cuentas → empty state "Añade tu primera cuenta bancaria"
- Impuestos sin datos → "—" en cada campo + botón "Importar"

---

## 18. FOCUS Y ACCESIBILIDAD

```css
*:focus-visible {
  outline: 2px solid var(--navy-900);
  outline-offset: 2px;
}
```

- Contraste mínimo WCAG AA (4.5:1)
- Touch target mínimo 44×44px
- Transiciones: `all 150ms ease`
- Tab order lógico en formularios

---

## 19. DICCIONARIO DE ICONOS — Un concepto, un icono, siempre

Cada concepto de negocio tiene UN icono Lucide asignado. Se usa siempre el mismo en sidebar, cabeceras, tablas, botones y empty states. Sin excepción.

### Secciones / navegación

| Concepto | Icono Lucide | Uso |
|----------|-------------|-----|
| Dashboard | `LayoutDashboard` | Sidebar, cabecera |
| Personal | `User` | Sidebar, cabecera |
| Inmuebles / Cartera | `Building2` | Sidebar, cabecera, referencia a propiedades |
| Inversiones | `TrendingUp` | Sidebar, cabecera, referencia a posiciones |
| Tesorería | `Landmark` | Sidebar, cabecera, referencia a cuentas |
| Previsiones | `BarChart3` | Sidebar, cabecera |
| Mi Plan / Objetivos | `Target` | Sidebar, cabecera |
| Impuestos / Fiscal | `Scale` | Sidebar, cabecera, referencia a declaraciones |
| Financiación / Deuda | `CreditCard` | Sidebar, cabecera, referencia a préstamos |
| Informes | `FileText` | Sidebar, cabecera |
| Alquileres | `Key` | Sidebar, cabecera, referencia a contratos |
| Documentación | `FolderOpen` | Sidebar, cabecera |
| Herramientas | `Wrench` | Sidebar, cabecera |
| Glosario | `BookOpen` | Sidebar, cabecera |

### Acciones

| Acción | Icono Lucide | Uso |
|--------|-------------|-----|
| Ver detalle | `Eye` | Tablas, listas |
| Editar | `Pencil` | Tablas, fichas |
| Eliminar | `Trash2` | Solo dentro de menú kebab |
| Importar / Subir | `Upload` | Botones, tablas |
| Descargar | `Download` | Botones, tablas |
| Exportar | `Download` | Botones de exportación |
| Añadir / Crear | `Plus` | Botones primarios |
| Buscar | `Search` | Campos de búsqueda |
| Filtrar | `SlidersHorizontal` | Botones de filtro |
| Menú acciones | `MoreVertical` | Kebab en tablas |
| Cerrar | `X` | Modales, drawers |
| Cancelar | `X` | Botones secundarios en wizards |
| Configurar | `Settings` | Botones de configuración |
| Actualizar | `RefreshCw` | Botones de recarga |

### Estados / información

| Concepto | Icono Lucide | Uso |
|----------|-------------|-----|
| Información | `Info` | Banners informativos, tooltips |
| Aviso / Atención | `AlertCircle` | Banners de aviso, vencimientos |
| Éxito / Completado | `CheckCircle2` | Confirmaciones, punteado |
| Calendario / Fecha | `Calendar` | Selectores de fecha, vencimientos |
| Documento PDF | `FileText` | Referencia a PDFs, declaraciones |
| Gráfico / Evolución | `BarChart3` | Secciones de evolución |
| Tendencia | `TrendingUp` | Indicadores de tendencia |

### Conceptos de negocio

| Concepto | Icono Lucide | Uso |
|----------|-------------|-----|
| Gastos / Expenses | `Receipt` | Presupuesto inmueble, gastos operativos |
| Ingresos / Rentas | `Coins` | Ingresos por alquiler, cobros |
| Vender inmueble | `LogOut` | Acción de venta, simulación venta |
| Comprar / Adquirir | `LogIn` | Registro de compra |
| Contrato | `FileSignature` | Contratos de alquiler |
| Inquilino | `UserCheck` | Referencia a inquilinos |
| Proveedor | `HardHat` | Proveedores de servicios |
| Factura | `ReceiptText` | Facturas individuales |

### Regla absoluta
```
❌ PROHIBIDO usar un icono distinto para el mismo concepto en diferentes pantallas
❌ PROHIBIDO usar el mismo icono para conceptos diferentes
✅ Si "Financiación" es CreditCard, es CreditCard en sidebar, cabecera, tabla y empty state
```

---

## 20. WIZARDS / PASO A PASO

Cuando un flujo tiene múltiples pasos (crear préstamo, importar declaración, configurar inmueble), sigue esta estructura:

### Layout

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  H1 del wizard                              × Cancelar   │
│                                                          │
│  ① Identificación ─── ② Condiciones ─── ③ Resumen       │
│  ●                    ○                  ○               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │  Contenido del paso actual                         │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│                          [Anterior]    [Siguiente →]     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Stepper

```css
.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 32px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--t-sm);         /* 13px */
  color: var(--grey-400);
  font-weight: 400;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid var(--grey-300);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--t-xs);          /* 12px */
  font-weight: 600;
  color: var(--grey-400);
  background: transparent;
}

.step-active .step-number {
  background: var(--navy-900);
  border-color: var(--navy-900);
  color: var(--white);
}

.step-active {
  color: var(--grey-900);
  font-weight: 500;
}

.step-completed .step-number {
  background: var(--navy-900);
  border-color: var(--navy-900);
  color: var(--white);
  /* Mostrar ✓ en vez del número */
}

.step-connector {
  flex: 1;
  height: 1px;
  background: var(--grey-300);
  margin: 0 12px;
}

.step-connector-completed {
  background: var(--navy-900);
}
```

### Reglas

1. **Máximo 5 pasos.** Si un wizard necesita más, hay que simplificar el flujo.
2. **Nombres cortos.** Una o dos palabras por paso: "Identificación", "Condiciones", "Resumen".
3. **Sin iconos en los pasos.** Solo número o ✓.
4. **Colores:** navy-900 para activo/completado, grey-300/400 para pendiente. Sin otros colores.
5. **Botones del wizard:**
   - Izquierda: "Anterior" (btn-secondary) — oculto en paso 1
   - Derecha: "Siguiente" (btn-primary) — cambia a "Confirmar" o "Crear" en el último paso
   - "Cancelar" arriba a la derecha con icono X, siempre visible
6. **El contenido del paso** va dentro de una Card estándar.
7. **Sin scroll dentro del wizard si es evitable.** Si el paso tiene mucho contenido, dividir en más pasos antes que hacer scroll.

---

## 21. ANTI-SCROLL — Si no aporta, no se hace scroll

### Principio
La pantalla visible (viewport) debe contener la información esencial sin necesidad de scroll. El scroll solo se justifica cuando hay **datos variables** (listas de inmuebles, movimientos, historial) que genuinamente no caben.

### Reglas

1. **KPIs y resumen SIEMPRE visibles sin scroll.** Si el usuario tiene que hacer scroll para ver el dato principal de la pantalla, el layout está mal.

2. **Cabecera + tabs + KPIs = above the fold.** Todo lo que define "dónde estoy y cómo voy" debe verse al entrar sin tocar el ratón.

3. **Tablas largas: sí scroll.** Una tabla con 20 movimientos o 10 inmuebles necesita scroll. Eso es legítimo.

4. **Formularios largos: dividir en pasos (wizard) antes que hacer scroll** dentro de un formulario interminable.

5. **Cards de KPI: máximo 4 por fila.** Si hay más de 4 KPIs, son demasiados. Priorizar.

6. **Padding excesivo = scroll innecesario.** Los paddings internos de cards y secciones deben ser los mínimos para que respire, no decorativos.

7. **Empty states compactos.** Icono 48px + 2 líneas de texto + botón. No necesitan más espacio.

### Layout de referencia (1080px viewport height)

```
Cabecera (icono + H1 + sub):          ~60px
Tabs:                                  ~44px
Gap:                                   ~24px
KPIs (1 fila de 4 cards):            ~100px
Gap:                                   ~16px
Contenido principal (tabla/cards):    ~700px
─────────────────────────────────────────────
Total:                                ~944px  ← cabe sin scroll
```

Si la suma excede el viewport, lo primero que se sacrifica es el padding, nunca la información.

### Prohibido

```
❌ Páginas con 200px de padding superior/inferior decorativo
❌ Cards con 48px de padding cuando 24px es suficiente
❌ Espacios vacíos que empujan contenido útil fuera del viewport
❌ Scroll para llegar a la acción principal (botón de crear, importar, etc.)
❌ Hero banners, bloques decorativos o secciones de "bienvenida" que ocupan media pantalla
```

---

## 22. CHECKLIST DE CUMPLIMIENTO

Cada PR que toque UI debe verificar:

- [ ] Solo colores de las 3 familias (navy, teal, gris)
- [ ] Cero rojo, verde, amarillo, lila, naranja
- [ ] Solo Lucide icons, sin emoji, sin SVG custom
- [ ] Cada concepto usa su icono del diccionario (sección 19)
- [ ] Cabecera sigue el estándar (icono 20px sin fondo + H1 + subtítulo + tabs sin iconos)
- [ ] Tabs son underline o pill, nunca mixtos
- [ ] Máximo 1 botón primario por pantalla
- [ ] Importes en IBM Plex Mono con tabular-nums
- [ ] Empty states sin datos inventados
- [ ] Valores ausentes = "—", no "0"
- [ ] Focus visible en todos los interactivos
- [ ] Sin overlays oscuros en modales
- [ ] Wizards siguen el patrón de stepper estándar (máx 5 pasos)
- [ ] KPIs y resumen visibles sin scroll (above the fold)
- [ ] Sin padding decorativo que genere scroll innecesario
- [ ] Selector de período usa el patrón rectangular [< 2025][2026][2027 >]
- [ ] Botones de cabecera (importar/exportar) usan btn-header (borde gris, no primario)
- [ ] Cerrar modal = X arriba derecha. Cancelar wizard = × Cancelar arriba derecha. Volver = ← antes del título
- [ ] Sin mezclar patrones: modal no tiene "Volver", ficha no tiene "Cancelar"
- [ ] Sin conceptos HORIZON o PULSE visibles en la UI

---

## 23. VERSIÓN

Estado: **v4.0**
Reemplaza: v1, v2, v3, todos los addendums
Conceptos eliminados: HORIZON, PULSE (no existen en la UI)
