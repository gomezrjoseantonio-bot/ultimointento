# TAREA CC · T39 · Listado gastos recurrentes redesign · Personal + Inmueble · 1 PR único

> **Tipo** · feature UI · 1 PR único · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama madre `main`
> **Predecesores** · T34 + T35 + T34-fix + T35-fix + T34.b + T35.b + T38 · todos mergeados
> **Tiempo estimado** · 10-12h CC · 1h revisión Jose
> **DB** · NO se sube DB_VERSION · solo cambio de UI · datos quedan igual
> **Riesgo** · medio · feature de presentación + edición lateral · sin migración de datos
> **Output** · 1 PR contra `main` con listado redesign · Personal e Inmueble · panel lateral edición · click expande detalle · ordenación

---

## 0 · Contexto · qué problema resuelve

Tras T38 (campo `tipoFamilia` + coherencia `categoria`) los datos están coherentes. Pero el listado actual sigue siendo · cita literal Jose · "cuajarón infumable de Nombre · Tipo · Categoría · Patrón · poco amigable · feo · sin gracia".

Problemas concretos:

1. **Tabla plana** · 14 filas con misma jerarquía · sin agrupación visual
2. **Lenguaje técnico crudo** · "mensualDiaFijo" · "cadaNMeses" · "anualMesesConcretos" en columna Patrón · "vivienda.suministros" · "obligaciones.multas" en columna Categoría
3. **Redundancia** · Tipo + Categoría duplican info ("Día a día" + "dia_a_dia.salud")
4. **Sin iconos** · solo texto · sin estética
5. **Filtros con valores legacy** · 4 botones (impuesto · otros · suministro · suscripcion) · NO las 6/7 familias nuevas
6. **Edición lenta** · click en lápiz → navega a página completa → vuelve · friccion para cambios pequeños
7. **Click en fila no hace nada** · oportunidad perdida
8. **Sin ordenación** · usuario no puede ordenar por importe ni por próximo cargo

T39 redesign cierra estas brechas en **ambos listados** (Personal · T34.b · y Inmueble · T35.b) reusando el mismo componente.

---

## 1 · Solución · agrupación + edición lateral + expandible + ordenación

### 1.1 · Modelo conceptual

**Antes:**
- Tabla plana de N filas
- 6 columnas planas · Nombre · Tipo · Categoría · Patrón · Mensual · Estado · Acciones
- Click lápiz → página completa
- Click fila → nada

**Después:**
- **Agrupación por `tipoFamilia`** · una card por familia · colapsable
- **Filas con jerarquía visual** · icono + nombre/sub + patrón humanizado + cuenta + importe + estado + acciones
- **Click en fila (no lápiz)** → expande detalle inline (próximos cargos · histórico · documentos)
- **Click en lápiz** → abre **panel lateral** (drawer) con formulario de edición
- **KPI strip arriba** · 3 tarjetas con resumen
- **Filtro pills** · 6 familias Personal · 7 familias Inmueble
- **Ordenación** · columnas Importe · Próximo cargo

### 1.2 · Catálogo de iconos por familia y subtipo

CC codifica en `src/modules/shared/components/ListadoGastos/iconMapping.ts`:

```typescript
import {
  Home, Zap, Flame, Droplet, Wifi, Smartphone,
  ShoppingCart, Car, Coffee, Star, Heart, Shirt, Scissors,
  Tv, Music, Code2, Cloud, Newspaper,
  Shield, Dumbbell, GraduationCap, Briefcase, HandHeart,
  CirclePlus, Landmark, Users, Wrench, Settings,
} from 'lucide-react';

// Iconos por FAMILIA (cabecera de grupo)
export const FAMILY_ICONS_PERSONAL = {
  vivienda:        Home,
  suministros:     Zap,
  dia_a_dia:       ShoppingCart,
  suscripciones:   Tv,
  seguros_cuotas:  Shield,
  otros:           CirclePlus,
};

export const FAMILY_ICONS_INMUEBLE = {
  tributos:    Landmark,
  comunidad:   Users,
  suministros: Zap,
  seguros:     Shield,
  gestion:     Briefcase,
  reparacion:  Wrench,
  otros:       CirclePlus,
};

// Iconos por SUBTIPO (fila individual)
export const SUBTYPE_ICONS = {
  // Personal · Vivienda
  alquiler:        Home,
  ibi:             Landmark,
  comunidad:       Users,
  seguro_hogar:    Shield,

  // Personal · Suministros
  luz:             Zap,
  gas:             Flame,
  agua:            Droplet,
  internet:        Wifi,
  movil:           Smartphone,

  // Personal · Día a día
  supermercado:    ShoppingCart,
  transporte:      Car,
  restaurantes:    Coffee,
  ocio:            Star,
  salud:           Heart,
  ropa:            Shirt,
  cuidado_personal: Scissors,

  // Personal · Suscripciones
  streaming:       Tv,
  musica:          Music,
  software:        Code2,
  cloud:           Cloud,
  prensa:          Newspaper,

  // Personal · Seguros y cuotas
  seguro_salud:    Heart,
  seguro_coche:    Car,
  seguro_vida:     Shield,
  seguro_otros:    Shield,
  gimnasio:        Dumbbell,
  educacion:       GraduationCap,
  profesional:     Briefcase,
  ong:             HandHeart,

  // Personal · Otros
  impuestos:       Landmark,
  multas:          CirclePlus,
  mantenimiento_coche: Settings,
  personalizado:   CirclePlus,

  // Inmueble · Reparación
  mantenimiento_caldera:  Flame,
  mantenimiento_integral: Wrench,
  limpieza:               Settings,

  // Inmueble · Gestión
  honorarios_agencia: Briefcase,
  gestoria:           Briefcase,
  asesoria:           Briefcase,

  // Inmueble · Tributos
  tasa_basuras:       Landmark,

  // Inmueble · Comunidad
  cuota_ordinaria:    Users,
  derrama:            Users,

  // Inmueble · Seguros
  hogar:              Shield,
  impago:             Shield,

  // fallback
  otros:              CirclePlus,
};
```

CC puede ajustar iconos · pero el **mapping debe ser cerrado y exhaustivo** · cada subtipo tiene su icono · `otros` es el fallback general.

### 1.3 · Humanización del patrón de calendario

CC codifica en `src/modules/shared/components/ListadoGastos/patternFormatter.ts`:

```typescript
export function formatPattern(c: CompromisoRecurrente): {
  primary: string;       // "Mensual · día 18"
  secondary: string;     // "próximo · 18 may 2026"
} {
  const patron = c.patron;

  switch (patron.tipo) {
    case 'mensualDiaFijo':
      return {
        primary: `Mensual · día ${patron.dia}`,
        secondary: `próximo · ${nextDateForMensualDiaFijo(patron, c.fechaInicio)}`,
      };
    case 'cadaNMeses':
      return {
        primary: `Cada ${patron.nMeses} meses · día ${patron.dia}`,
        secondary: `próximo · ${nextDateForCadaNMeses(patron, c.fechaInicio)}`,
      };
    case 'anualMesesConcretos':
      const meses = patron.meses.map(monthShort).join(' + ');  // "jun + nov"
      return {
        primary: `Anual · ${meses}`,
        secondary: `próximo · ${nextDateForAnualMesesConcretos(patron, c.fechaInicio)}`,
      };
    case 'mensualDiaRelativo':
      return {
        primary: `Mensual · ${patron.relativo}`,  // "último hábil" · "primer hábil"
        secondary: `próximo · ${nextDateForMensualDiaRelativo(patron)}`,
      };
    default:
      return { primary: 'Patrón personalizado', secondary: '' };
  }
}

function monthShort(monthIndex: number): string {
  return ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][monthIndex - 1];
}
```

CC adapta a la función `expandirPatron` real del repo (importa la función existente · NO reinventa).

---

## 2 · INSTRUCCIONES INVIOLABLES

### 2.1 · Scope estricto

CC trabaja **solo** en:

1. Crear componente reutilizable `<ListadoGastosRecurrentes />` en `src/modules/shared/components/ListadoGastos/`
2. Crear sub-componentes · `GroupCard` · `ExpenseRow` · `RowExpandedDetail` · `KpiStrip` · `FilterPills` · `EditDrawer`
3. Crear utils · `iconMapping.ts` · `patternFormatter.ts` · `groupingHelpers.ts` · `sortingHelpers.ts`
4. Sustituir el listado actual de Personal · Gastos por el nuevo componente con catálogo Personal
5. Sustituir el listado actual de Inmueble · pestaña Gastos por el nuevo componente con catálogo Inmueble
6. Implementar **EditDrawer** · panel lateral derecho que abre al pulsar lápiz · contiene formulario de edición usando los componentes ya existentes (secciones del wizard)
7. Implementar **expansión de fila** · click en cuerpo de la fila despliega detalle inline (próximos cargos · histórico de movimientos · documentos vinculados)
8. Implementar **ordenación** · click en cabecera de columna Importe o Próximo cargo · alterna asc/desc

NADA más.

### 2.2 · CC tiene PROHIBIDO

❌ Modificar el schema de `compromisosRecurrentes` o cualquier otro store
❌ Subir DB_VERSION
❌ Modificar `compromisosRecurrentesService.ts` · `treasuryBootstrapService.ts` · ni ningún servicio
❌ Tocar wizards de alta nuevos (T34-fix · T35-fix) · NO se duplican · solo se reusan componentes
❌ Cambiar el modelo de datos · solo presentación
❌ Modificar lógica de cálculo de cargos · solo lectura
❌ Construir vista de gastos sobre movements (T36 separado)
❌ Implementar multi-asignación (T37 separado)
❌ Tocar PresupuestoPage · DetectarCompromisosPage · u otras vistas

### 2.3 · Reglas técnicas duras

- TypeScript estricto · cero `any` · cero `as any`
- Tokens v5 · cero hex hardcoded
- Lucide-react · única librería iconos
- Componente principal autocontenido · accesible (ARIA · keyboard navigation)
- Componente recibe el catálogo de familias por prop · reutilizable Personal/Inmueble
- EditDrawer reutiliza las secciones del wizard ya construidas (NO duplica formulario)
- Idempotencia en submit · si pulsa Guardar 2 veces no duplica

### 2.4 · Stop-and-wait

CC abre PR · publica · **DETIENE** · espera revisión Jose · NO mergea hasta autorización.

---

## 3 · Etapa A · auditoría inicial · OBLIGATORIA antes de codear

### A.1 · Reportar listado actual Personal y Inmueble

```bash
find src -name "*.tsx" | xargs grep -l "compromisosRecurrentes" 2>/dev/null | head -10
grep -rn "GastosPage\|GastosTab\|GastosRecurrentesTab" src/ | head -20
```

CC reporta:
- Path exacto del componente listado Personal (T34.b)
- Path exacto del componente listado Inmueble (T35.b)
- Estructura de columnas actual de cada uno

### A.2 · Reportar API del wizard de edición

```bash
grep -rn "EditarGasto\|EditGastoRecurrente" src/ | head -10
```

CC reporta:
- Path componente edición Personal
- Path componente edición Inmueble
- Si ambos pueden funcionar como sub-vista (sin layout completo) o requieren rediseño para encajar en drawer

Si los componentes de edición están demasiado acoplados al layout completo (cabecera · sidebar · etc) · CC reporta y propone alternativa · usar las **secciones individuales del wizard de alta** dentro del drawer.

### A.3 · Reportar fuentes de datos para el detalle expandido

CC investiga qué stores tienen los datos para el detalle expandido:

- **Próximos cargos** · `treasuryEvents` · filtrar por `compromisoRecurrenteId === c.id` · estado `'predicted'` · próximas N ocurrencias
- **Histórico** · `movements` · filtrar por `compromisoRecurrenteId === c.id` · ordenar fecha desc · últimas N
- **Documentos vinculados** · ¿hay un store `documents` o similar con relación al compromiso?

```bash
grep -rn "treasuryEvents.*compromiso\|movements.*compromiso\|documents.*compromiso" src/services/ | head -20
```

CC reporta · qué hay disponible · qué NO. Si algo NO está · adapta el detalle expandido (ej. si no hay documentos vinculados · esa sección no se muestra).

### A.4 · Reportar componente Drawer existente

```bash
grep -rn "Drawer\|SlideOver\|RightPanel" src/components/ src/modules/shared/ | head -10
```

CC reporta:
- Si existe componente Drawer reutilizable · usarlo
- Si NO · crear uno propio simple · animación 200ms · overlay · cerrar con esc + click fuera + botón X

CC NO empieza a codear hasta documentar A.1 · A.2 · A.3 · A.4.

---

## 4 · Etapa B · estructura archivos

### B.1 · Archivos a crear

```
src/modules/shared/components/ListadoGastos/
  - ListadoGastosRecurrentes.tsx        (componente principal)
  - ListadoGastosRecurrentes.module.css
  - ListadoGastosRecurrentes.types.ts   (interfaces · Props · GroupConfig · etc)
  - components/
    - GroupCard.tsx                     (card de grupo · header colapsable + body con filas)
    - ExpenseRow.tsx                    (fila individual)
    - RowExpandedDetail.tsx             (detalle inline al expandir · próximos cargos · histórico · docs)
    - KpiStrip.tsx                      (3 tarjetas KPI arriba)
    - FilterPills.tsx                   (pills de filtro por familia)
    - SortableHeader.tsx                (cabecera de columna ordenable)
    - EditDrawer.tsx                    (panel lateral derecho · drawer)
  - utils/
    - iconMapping.ts                    (catálogo iconos · §1.2)
    - patternFormatter.ts               (humanización patrón · §1.3)
    - groupingHelpers.ts                (agrupar por tipoFamilia + cálculo totales)
    - sortingHelpers.ts                 (ordenar por columna)
    - amountFormatter.ts                (formatear importes con signo)
  - index.ts                            (re-export)
```

### B.2 · Archivos a modificar

```
src/modules/personal/pages/GastosPage.tsx (o equivalente · T34.b)
  · sustituir tabla actual por <ListadoGastosRecurrentes
      catalog={CATALOGO_PERSONAL}
      compromisos={compromisosPersonales}
      onEdit={(c) => abrirDrawerEdicion(c)}
      onDelete={(c) => confirmarBorrado(c)}
      mode="personal"
    />

src/modules/inmuebles/pages/DetallePage.tsx (o equivalente · pestaña Gastos del inmueble · T35.b)
  · sustituir tabla actual por <ListadoGastosRecurrentes
      catalog={CATALOGO_INMUEBLE}
      compromisos={compromisosDelInmueble}
      onEdit={(c) => abrirDrawerEdicion(c)}
      onDelete={(c) => confirmarBorrado(c)}
      mode="inmueble"
    />
```

### B.3 · Archivos que NO se tocan

❌ `compromisosRecurrentesService.ts`
❌ `treasuryBootstrapService.ts`
❌ Otros stores
❌ Wizards de alta (T34-fix · T35-fix · ya construidos · solo se reusan sus secciones dentro del EditDrawer)
❌ DetectarCompromisosPage
❌ PresupuestoPage
❌ Otros listados que NO sean los de Gastos

---

## 5 · Etapa C · UI y comportamiento detallado

### 5.1 · API del componente principal

```typescript
interface ListadoGastosRecurrentesProps {
  catalog: TipoGasto[];                              // catálogo familias del modo
  compromisos: CompromisoRecurrente[];                // datos a mostrar
  mode: 'personal' | 'inmueble';                      // determina iconos · KPIs · columnas
  onEdit: (c: CompromisoRecurrente) => void;          // abre drawer
  onDelete: (c: CompromisoRecurrente) => Promise<void>; // confirma + borra
  inmuebleId?: number;                                 // si mode='inmueble' · contexto
}
```

### 5.2 · KPI Strip · arriba

3 tarjetas en grid 1fr 1fr 1fr · margen abajo 22px:

**Personal:**
- KPI 1 · "Coste mensual estimado" · suma de todos los `mensualEstimado` · valor en mono grande negativo · subtítulo "X patrones activos"
- KPI 2 · "Coste anual previsto" · suma × 12 · subtítulo "proyectado a 12 meses"
- KPI 3 · "Próximo cargo" · fecha + nombre del compromiso con `próximo evento más cercano` · subtítulo "X €"

**Inmueble:**
- KPI 1 · "Gastos mensuales" · idem
- KPI 2 · "Coste anual previsto" · subtítulo "deducibles según contrato"
- KPI 3 · "Próximo cargo" · idem

**Estilos:**
- Card blanca · `border: 1px solid var(--line)` · `border-radius: 10px` · `padding: 14px 18px`
- KPI 1 · `border-top: 3px solid var(--neg)` · valor en `var(--neg)`
- KPI 2 · `border-top: 3px solid var(--brand)` · valor en `var(--ink)`
- KPI 3 · `border-top: 3px solid var(--gold)` · valor en `var(--ink)`
- Label · `text-transform: uppercase` · `letter-spacing: 0.12em` · `color: var(--ink-4)` · 10.5px
- Valor · `JetBrains Mono` · 22px bold

### 5.3 · Toolbar · search + acciones

Fila por encima de pills:

- **Search** · input con icono lupa · placeholder "Buscar gasto · proveedor · subtipo..." · filtra en tiempo real (alias · proveedor · nombrePersonalizado · subtipo label)
- **Acciones a la derecha:**
  - "Importar" (Personal solo)
  - "Detectar" (Personal solo)
  - "Nuevo gasto recurrente" · botón dorado primario · navega al wizard de alta

### 5.4 · Filter Pills · familias

Fila debajo del toolbar:

- Primer pill · "Todos · N" · activo por defecto
- Pills siguientes · una por familia · "Vivienda · 1" · "Suministros · 2" · etc · solo se muestran las familias que tienen al menos 1 compromiso (no muestra Vivienda si no hay ningún compromiso de Vivienda)
- **Activo** · fondo `var(--brand-ink)` · texto blanco
- Inactivo · borde `var(--line)` · fondo `var(--card)` · texto `var(--ink-3)`
- Contador con fondo distinto según activo/inactivo
- Click · filtra el listado · oculta otras familias

### 5.5 · Group Card · una por familia

Card colapsable por familia:

**Header:**
- Icono familia · 36×36 · fondo `var(--gold-wash)` · color `var(--gold-ink)`
- Título · "Vivienda" · 15px bold
- Meta · "· N patrones" · pequeño gris
- Spacer
- Total · "−1.350 €" · mono bold negativo
- Total sub · "mensual estimado" · pequeño gris
- Toggle · flecha abajo · gira al colapsar
- **Click en header · colapsa/expande el grupo**

**Body:**
- Lista de filas · ver §5.6
- Sin padding extra · filas se pegan al header

**Comportamiento:**
- Por defecto · grupos expandidos
- Estado de expansión persiste en localStorage por usuario (key `listadoGastos.expandedGroups.{mode}`)
- Si hay filtro de pill activa · solo se muestra la familia coincidente · resto ocultas

### 5.6 · ExpenseRow · una fila por compromiso

Grid de 7 columnas:

```css
grid-template-columns: 36px 1fr 200px 200px 130px 80px 70px;
gap: 16px;
padding: 14px 20px;
border-bottom: 1px solid var(--line-2);
```

**Columna 1 · Icono subtipo (36px)**
- Lucide icon del subtipo · 28×28 · fondo `var(--bg)` · color `var(--ink-3)`
- En hover de fila · fondo `var(--gold-wash)` · color `var(--gold-ink)`

**Columna 2 · Nombre + sub (1fr)**
- `row-name` · 13.5px bold `var(--ink)` · valor:
  - Si `nombrePersonalizado` · usar ese
  - Si no · usar `alias` o construir desde proveedor + subtipo
- `row-sub` · 11.5px `var(--ink-4)` · valor:
  - Referencia / contrato si existe
  - Si no · CIF
  - Si no · vacío

**Columna 3 · Patrón (200px)**
- `row-pattern` · 12.5px `var(--ink-3)`
  - Primary · "**Mensual** · día 18" (con palabra clave bold)
- `row-pattern-sub` · 11px `var(--ink-4)` · "próximo · 18 may 2026"

**Columna 4 · Cuenta (200px)**
- Dot dorado pequeño · 8×8
- Texto · "Sabadell ···· 9635" · 12.5px `var(--ink-3)`

**Columna 5 · Importe (130px · alineado derecha)**
- `row-amount` · mono 13.5px bold · color `var(--neg)` · ej "−40 €"
- `row-amount-sub` · 10.5px `var(--ink-4)` mono · ej "media mensual" o "12 cargos/año"

**Columna 6 · Estado (80px)**
- Pill `Activo` · fondo `var(--pos-wash)` · color `var(--pos)` · 10.5px uppercase bold
- Pill `Pausado` · fondo `var(--warn-wash)` · color `var(--warn)` (si existe ese estado)

**Columna 7 · Acciones (70px · alineado derecha)**
- Icon-btn lápiz · 28×28 · neutro · hover gris
- Icon-btn papelera · 28×28 · neutro · hover rojo (`var(--neg-wash)` fondo · color `var(--neg)`)

**Comportamiento de la fila:**
- Hover de fila (cualquier zona) · fondo `var(--gold-wash-2)`
- **Click en cuerpo de la fila (NO en lápiz ni papelera)** · expande detalle inline · ver §5.7
- **Click en lápiz** · llama `onEdit(c)` → abre drawer
- **Click en papelera** · confirmación modal "¿Eliminar este gasto recurrente?" · si confirma · llama `onDelete(c)` · toast éxito

### 5.7 · RowExpandedDetail · detalle inline al expandir

Al hacer click en una fila · se despliega un sub-panel debajo de esa fila · con animación slide-down 200ms.

**Contenido · 3 secciones lado a lado:**

**Sección 1 · Próximos cargos** (40% ancho)
- Título "Próximos cargos" pequeño en uppercase
- Lista de las próximas 6 ocurrencias:
  - Fecha · ej "06 may 2026" mono pequeño
  - Importe · mono bold negativo
  - Estado · pill pequeño · "previsto" gris · "confirmado" verde · "pagado" verde

Datos · de `treasuryEvents` filtrados por `compromisoRecurrenteId === c.id` · estado `predicted` o `confirmed` · ordenados ascending · primeros 6.

**Sección 2 · Últimos cargos reales** (40% ancho)
- Título "Histórico" pequeño en uppercase
- Lista de los últimos 6 movimientos:
  - Fecha · mono pequeño
  - Concepto bancario · pequeño
  - Importe · mono bold negativo

Datos · de `movements` filtrados por `compromisoRecurrenteId === c.id` · ordenados descending · últimos 6.

**Sección 3 · Documentos** (20% ancho · si aplica)
- Título "Documentos" pequeño
- Lista de docs vinculados (si existen) · facturas · contratos · etc

Si A.3 detectó que NO hay relación documents-compromiso · esta sección se omite y las otras dos son 50%/50%.

**Acciones rápidas debajo:**
- Botón pequeño "Ver todos los cargos →" · navega a Tesorería filtrada por este compromiso

**Estilos:**
- Fondo · `var(--card-alt)` · sutil
- Padding · 18px 28px
- Border-top · `1px solid var(--line-2)`
- Animación · `max-height` 0 → auto · 200ms ease

**Comportamiento:**
- Solo una fila puede estar expandida a la vez · click en otra fila colapsa la anterior
- Click en la misma fila colapsa
- Estado NO persiste · al recargar todas colapsadas

### 5.8 · SortableHeader · cabeceras ordenables

Encima del primer grupo · una fila de cabeceras de columna · alineadas con las columnas de las filas:

| 36px | 1fr | 200px | 200px | 130px | 80px | 70px |
|---|---|---|---|---|---|---|
| | NOMBRE | PATRÓN | CUENTA | **IMPORTE ↕** | ESTADO | |

- "IMPORTE" · clickable · cursor pointer · al click ordena asc/desc · indicador `↑` o `↓` aparece
- "NOMBRE" · clickable también · ordena alfabéticamente
- Resto · no clickable

**Estilos cabecera:**
- 11px uppercase · letter-spacing 0.1em · color `var(--ink-4)` · font-weight 700
- Padding 10px 20px
- Border-bottom · `1px solid var(--line)`
- Hover en clickables · color `var(--ink-2)` · cursor pointer

**Comportamiento:**
- Click en NOMBRE · alterna asc/desc por alias
- Click en IMPORTE · alterna asc/desc por mensualEstimado
- Sort se aplica DENTRO de cada grupo · NO altera el orden de los grupos
- Indicador visual · "IMPORTE ↑" o "IMPORTE ↓" según dirección

### 5.9 · EditDrawer · panel lateral derecho

Drawer que se abre al pulsar el lápiz:

**Estructura:**
- Overlay oscuro semi-transparente cubriendo toda la pantalla · cierra al click
- Panel lateral derecho · ancho 480px en desktop · 100% en mobile · slide desde la derecha · animación 200ms
- Cabecera del drawer · título "Editar gasto recurrente" + botón X · borde inferior

**Contenido del drawer:**

Reusar las **4 secciones del wizard de alta** (T34-fix / T35-fix) precargadas con los datos del compromiso:

1. ¿Qué gasto es? · TipoGastoSelector + Subtipo + Proveedor + CIF + Referencia
2. ¿Cuándo se cobra? · Patrón + Día + Mes inicio + Mes fin
3. ¿Cuánto se cobra? · Modo + Importe(s)
4. ¿Dónde se carga? · Cuenta (+ Bolsa si Personal)

**Sin sección "Catálogo típico"** · solo aparece en alta · no en edición.

**Footer del drawer:**
- Botón "Cancelar" ghost
- Botón "Guardar cambios" dorado primario
- Helper text pequeño · "Los cambios se aplicarán a futuros cargos · los pasados no se modifican"

**Comportamiento:**
- Submit · idempotente · NO duplica
- Tras guardar · cierra drawer · refresca listado · toast éxito "Cambios guardados"
- Cancel · cierra sin guardar · si hay cambios · pide confirmación
- Esc cierra drawer (con confirmación si hay cambios)
- Click fuera (overlay) cierra drawer (con confirmación si hay cambios)

**Si A.2 detectó que el componente de edición existente NO se puede embedir limpiamente:**
- CC reusa las **secciones individuales del wizard de alta** (SeccionTipoGasto · SeccionCalendario · SeccionImporte · SeccionCuentaBolsa) ya creadas en T34-fix
- Las renderiza dentro del drawer con valores precargados
- Al guardar · construye el objeto compromiso y llama a `compromisosRecurrentesService.actualizar(c)` o equivalente

### 5.10 · Búsqueda · search input

Filtra en tiempo real (debounce 200ms) sobre los compromisos visibles. Match contra:

- `alias`
- `nombrePersonalizado`
- `proveedor.nombre`
- subtipo label (resolver desde catálogo)

Si hay search activo · oculta grupos vacíos · muestra solo los que tengan match.

Si search vacío · muestra todos los grupos.

### 5.11 · Estado vacío

Si NO hay compromisos:

- Card grande · centrada · borde dashed
- Icono grande Lucide gris
- Título "No hay gastos recurrentes" · 14.5px bold
- Subtítulo · "Empieza creando tu primer patrón con el botón de arriba" · 12.5px gris

Si hay compromisos pero el filtro/search no devuelve nada:

- Card más pequeña
- "No hay resultados para ese filtro"
- Botón "Limpiar filtros"

---

## 6 · Etapa D · verificación

### Build
- [ ] `tsc --noEmit` · 0 errores
- [ ] `npm run build` · pasa
- [ ] `npm test` · pasa

### Funcional · listado Personal
- [ ] KPI strip muestra · coste mensual · anual · próximo cargo
- [ ] Filtro pills · 6 familias + Todos · contadores correctos
- [ ] Solo se muestran familias con compromisos
- [ ] Click en pill filtra
- [ ] Grupos colapsables · estado persiste en localStorage
- [ ] Filas con icono Lucide del subtipo
- [ ] Patrón humanizado · "Mensual · día 18" · NO "mensualDiaFijo"
- [ ] Próximo cargo calculado correctamente
- [ ] Importe en mono rojo
- [ ] Estado pill verde "Activo"
- [ ] Search filtra alias · proveedor · subtipo
- [ ] Click NOMBRE ordena asc/desc
- [ ] Click IMPORTE ordena asc/desc
- [ ] Indicador visual ↑↓ aparece

### Funcional · listado Inmueble
- [ ] Property strip arriba con foto + tag + dirección
- [ ] KPI strip · "Gastos mensuales" "deducibles según contrato"
- [ ] Filtro pills · 7 familias inmueble + Todos
- [ ] Iconos de familia · Tributos · Comunidad · etc
- [ ] Resto idéntico a Personal

### Funcional · expansión de fila
- [ ] Click en cuerpo de fila despliega detalle inline
- [ ] Próximos cargos · 6 ocurrencias · de treasuryEvents
- [ ] Histórico · 6 movimientos · de movements
- [ ] Documentos · solo si hay datos
- [ ] Solo una fila expandida a la vez
- [ ] Click en misma fila colapsa
- [ ] Animación 200ms slide-down

### Funcional · EditDrawer
- [ ] Click en lápiz abre drawer desde la derecha
- [ ] Animación 200ms
- [ ] Overlay oscuro
- [ ] Datos precargados correctos · todos los campos
- [ ] 4 secciones renderizadas
- [ ] Submit guarda · cierra drawer · refresca listado · toast
- [ ] Cancelar con cambios pide confirmación
- [ ] Esc cierra drawer con confirmación si hay cambios
- [ ] Click fuera cierra drawer con confirmación si hay cambios
- [ ] Idempotencia · doble click NO duplica
- [ ] Sin sección "Catálogo típico"
- [ ] Footer · "Los cambios se aplicarán a futuros cargos"

### Funcional · borrado
- [ ] Click papelera · modal de confirmación
- [ ] Confirmar · borra · toast · refresca
- [ ] Cancelar · cierra modal · sin acción

### Funcional · estado vacío
- [ ] Sin compromisos · empty state grande
- [ ] Con filtro sin resultados · empty pequeño + "Limpiar filtros"

### Tipado
- [ ] Cero `any` · cero `as any`
- [ ] Props del componente principal tipadas
- [ ] Catálogos de iconos exhaustivos
- [ ] Sin warnings de TypeScript nuevos

### CSS / tokens
- [ ] Cero hex hardcoded
- [ ] Tokens v5 respetados
- [ ] Responsive · mobile mantiene legibilidad (filas pueden colapsar columnas en pantallas <768px)

### Accesibilidad
- [ ] ARIA roles correctos
- [ ] Keyboard navigation funcional
- [ ] Foco visible
- [ ] Drawer tiene focus trap (Tab no sale del drawer)
- [ ] Esc cierra drawer
- [ ] Lighthouse a11y sin regresión

### Reglas de scope
- [ ] CERO modificación de servicios · stores · DB
- [ ] CERO modificación de wizards de alta
- [ ] CERO modificación de PresupuestoPage · DetectarCompromisosPage
- [ ] DB_VERSION intacto
- [ ] Componente reutilizable · catálogo por prop
- [ ] Personal e Inmueble usan el MISMO componente con catálogos distintos

---

## 7 · PR

**Rama** · `claude/t39-listado-redesign`

**Título PR** · `feat(ux): T39 listado gastos redesign · Personal+Inmueble · agrupación · drawer edición · expand · ordenación`

**Body PR**:

```
## Resumen

Tras T34/T35/T34-fix/T35-fix/T34.b/T35.b/T38 mergeados · los datos están coherentes
pero el listado sigue siendo "cuajarón infumable de Nombre · Tipo · Categoría · Patrón ·
poco amigable · feo · sin gracia" (cita literal Jose).

T39 redesign · agrupación por familia · iconos Lucide · lenguaje humanizado · KPI strip ·
filtros pills · panel lateral edición · expansión inline · ordenación de columnas.

Aplica a AMBOS listados (Personal y Inmueble) reusando el mismo componente.

## Cambios

### Archivos nuevos
- ✨ `<ListadoGastosRecurrentes />` · componente reutilizable · catálogo por prop
- ✨ Sub-componentes · GroupCard · ExpenseRow · RowExpandedDetail · KpiStrip · FilterPills · SortableHeader · EditDrawer
- ✨ Utils · iconMapping · patternFormatter · groupingHelpers · sortingHelpers · amountFormatter

### Modificados
- ✏️ Listado Personal · usa nuevo componente con CATALOGO_PERSONAL
- ✏️ Listado Inmueble · usa nuevo componente con CATALOGO_INMUEBLE

## Comportamiento

### Antes
- Tabla plana · 7 columnas crudas
- "mensualDiaFijo" · "vivienda.suministros" · "obligaciones.multas" visibles
- Sin iconos · sin agrupación
- Filtros legacy (suministro · otros · suscripcion · impuesto)
- Lápiz → página completa
- Click fila → nada

### Después
- 6/7 cards agrupadas por familia · colapsables
- "Mensual · día 18" · "Cada 2 meses" · "Anual · jun + nov"
- Iconos Lucide por familia y subtipo
- Filtros pills con familias correctas
- Lápiz → drawer lateral con formulario embebido
- Click fila → expande detalle (próximos cargos · histórico · docs)
- KPI strip con resumen
- Ordenación por NOMBRE / IMPORTE

### Catálogos
- Personal · 6 familias (Vivienda · Suministros · Día a día · Suscripciones · Seguros y cuotas · Otros)
- Inmueble · 7 familias (Tributos · Comunidad · Suministros · Seguros · Gestión · Reparación · Otros)

## NO toca

- ❌ Schema · DB_VERSION intacto
- ❌ Servicios · stores
- ❌ Wizards de alta (solo se reusan secciones dentro del drawer)
- ❌ DetectarCompromisosPage · PresupuestoPage
- ❌ T36 (vista sobre movements) · T37 (multi-asignación)

## Cambios respecto al spec

[CC documenta · si no hay · "Cero · implementación literal"]

## Verificación

- [x] tsc · 0 errores
- [x] build · pasa
- [x] Personal · 6 familias agrupadas · iconos · KPIs · pills · ordenación
- [x] Inmueble · 7 familias agrupadas · property strip · idem
- [x] Drawer edición funciona en ambos · idempotente · esc + click fuera con confirmación
- [x] Click fila expande detalle inline · próximos cargos + histórico
- [x] Search filtra en vivo
- [x] Compromisos antiguos visibles · sin pérdida
- [x] Tokens v5 · cero hex
- [x] DB_VERSION intacto
- [x] Componente reutilizable · catálogo por prop

**STOP-AND-WAIT** · Jose valida en deploy preview y mergea cuando OK.

Tras merge · siguientes (sin orden definido):
- T36 · vista gastos personales sobre movements (50/30/20 sobre cargos reales)
- T37 · compromisos multi-asignación
- T34.c / T35.c · catálogos típicos (placeholder hoy)
```

**NO mergear.** Esperar Jose.

---

## 8 · Si CC encuentra bloqueo

1. **Componente edición acoplado a layout** → CC reusa secciones del wizard de alta · documenta
2. **No hay relación documents-compromiso** → omite sección Documentos del expand · documenta
3. **`treasuryEvents` no tiene `compromisoRecurrenteId`** → reportar y simular con próximas N proyecciones calculadas · documentar como deuda
4. **`movements` no tiene `compromisoRecurrenteId`** → idem
5. **No hay componente Drawer reutilizable** → crear uno simple · documentar
6. **Mockup HTML no llega** → CC pide a Jose el path · NO improvisa diseño

**En ningún caso CC modifica schema · servicios o stores · NO mergea sin autorización.**

---

## 9 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`
- DB_VERSION 68 · estable post-T38
- T34/T35/T34-fix/T35-fix/T34.b/T35.b/T38 mergeados
- Mockup HTML · `atlas-listado-gastos-recurrentes-v1.html` (Jose lo facilita)
- Componente `<TipoGastoSelector />` ya construido · reusable
- Catálogos `tiposDeGastoPersonal.ts` y `tiposDeGastoInmueble.ts` ya construidos

---

## 10 · Resumen ejecutivo

> Sustituye el listado feo de Personal e Inmueble por componente `<ListadoGastosRecurrentes />` reutilizable. Agrupación por familia · iconos Lucide · KPI strip · filtros pills · ordenación · click despliega detalle · lápiz abre drawer lateral con formulario embebido reutilizando secciones del wizard. NO toca schema · NO toca servicios · NO modifica DB. 1 PR único · stop-and-wait · 10-12h CC.

---

**Fin spec T39 · listado bonito sobre datos coherentes · cierra módulo Gastos.**
