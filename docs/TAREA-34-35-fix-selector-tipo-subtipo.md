# TAREA CC · T34-fix + T35-fix · Selector custom Tipo+Subtipo · Personal + Inmueble · 1 PR único

> **Tipo** · feature UI · fix sobre T34 + T35 mergeadas · 1 PR único · stop-and-wait
> **Repo** · `gomezrjoseantonio-bot/ultimointento` · rama madre `main`
> **Predecesores** · T34 mergeado · T35 mergeado · ambos wizards funcionales pero con UX inferno en el select de Tipo
> **Tiempo estimado** · 7-9h CC · 1h revisión Jose
> **DB** · NO se sube DB_VERSION · solo cambio de UI · datos guardados son compatibles
> **Riesgo** · medio-bajo · feature de presentación · sin migración de datos
> **Output** · 1 PR contra `main` con componente `<TipoGastoSelector />` reutilizable + 2 catálogos + integración en wizards T34 y T35

---

## 0 · Contexto · qué problema resuelve

Tras mergear T34 y T35 · validación visual de Jose en producción detectó **3 problemas críticos** que invalidan los wizards tal como están:

### Problema 1 · UX horripilante del select en ambos wizards

El `<select>` HTML con `<optgroup>` que renderizó CC presenta:
- Headers de optgroup indistinguibles visualmente de las opciones · usuario los confunde con seleccionables
- Lista plana sin iconos · sin jerarquía visual
- Sin búsqueda · sin filtrado · sin atajos teclado
- Cita literal Jose · "horripilante · funciona y se propaga pero un listado infernal · ni iconos ni algo agradable e intuitivo de ver · fatal"

### Problema 2 · Catálogos incompletos

**Personal (T34)** · faltan los gastos cotidianos del día a día:
- Supermercado · Transporte · Restaurantes · Ocio · Salud · Ropa · Cuidado personal

**Inmueble (T35)** · estructura plana sin jerarquía · subtipos limitados.

### Problema 3 · "Otros · personalizado" NO funcional

Spec original decía · "Si tu seguro no está · eliges Otros y escribes el nombre". CC implementó **solo el "Otros"** sin el campo de nombre libre. Resultado · Jose intentó dar de alta "Alquiler vivienda" y se vio forzado a elegir "Otros" sin poder personalizar · el compromiso quedó como "Otros · sin nombre".

**Bug adicional T34** · "Alquiler vivienda" no aparecía en producción · spec original lo incluía. CC pudo haberlo eliminado o ocultado por bug de render. Hay que verificar.

---

## 1 · Solución · 2 niveles · Tipo + Subtipo · componente custom reutilizable

### 1.1 · Modelo conceptual · idéntico para Personal e Inmueble

**Antes** (T34/T35 mergeados · UX inferno):
- 1 select gigante con N opciones planas en optgroups indistinguibles

**Después** (T34-fix + T35-fix):
- **Tipo de gasto** · selector custom con iconos · 6-7 familias visibles
- **Subtipo** · select HTML dinámico · cambia según el Tipo elegido
- **Campo "Nombre del gasto"** · aparece **solo** cuando Subtipo = "Personalizado" · obligatorio si visible
- **Mismo componente reutilizable** en ambos wizards · solo cambia el catálogo

### 1.2 · Catálogo Personal · 6 tipos · 39 subtipos

CC codifica en `src/modules/personal/wizards/utils/tiposDeGastoPersonal.ts`:

```typescript
export const TIPOS_GASTO_PERSONAL: TipoGasto[] = [
  {
    id: 'vivienda',
    label: 'Vivienda',
    description: 'Alquiler · IBI · comunidad · seguro hogar',
    icon: 'Home',
    subtipos: [
      { id: 'alquiler',     label: 'Alquiler' },
      { id: 'ibi',          label: 'IBI' },
      { id: 'comunidad',    label: 'Comunidad' },
      { id: 'seguro_hogar', label: 'Seguro hogar' },
    ],
  },
  {
    id: 'suministros',
    label: 'Suministros',
    description: 'Luz · gas · agua · internet · móvil',
    icon: 'Zap',
    subtipos: [
      { id: 'luz',      label: 'Luz' },
      { id: 'gas',      label: 'Gas' },
      { id: 'agua',     label: 'Agua' },
      { id: 'internet', label: 'Internet' },
      { id: 'movil',    label: 'Móvil' },
      { id: 'otros',    label: 'Otros' },
    ],
  },
  {
    id: 'dia_a_dia',
    label: 'Día a día',
    description: 'Supermercado · transporte · ocio · salud · ropa',
    icon: 'ShoppingCart',
    subtipos: [
      { id: 'supermercado',     label: 'Supermercado · alimentación' },
      { id: 'transporte',       label: 'Transporte · gasolina' },
      { id: 'restaurantes',     label: 'Restaurantes · cafeterías' },
      { id: 'ocio',             label: 'Ocio · cine · planes' },
      { id: 'salud',            label: 'Salud · farmacia · médicos' },
      { id: 'ropa',             label: 'Ropa · calzado' },
      { id: 'cuidado_personal', label: 'Cuidado personal · peluquería' },
      { id: 'otros',            label: 'Otros' },
    ],
  },
  {
    id: 'suscripciones',
    label: 'Suscripciones',
    description: 'Streaming · música · software · cloud · prensa',
    icon: 'Tv',
    subtipos: [
      { id: 'streaming', label: 'Streaming' },
      { id: 'musica',    label: 'Música' },
      { id: 'software',  label: 'Software' },
      { id: 'cloud',     label: 'Cloud' },
      { id: 'prensa',    label: 'Prensa' },
      { id: 'otros',     label: 'Otros' },
    ],
  },
  {
    id: 'seguros_cuotas',
    label: 'Seguros y cuotas',
    description: 'Seguros · gimnasio · educación · ONG',
    icon: 'Shield',
    subtipos: [
      { id: 'seguro_salud',  label: 'Seguro salud' },
      { id: 'seguro_coche',  label: 'Seguro coche' },
      { id: 'seguro_vida',   label: 'Seguro vida' },
      { id: 'seguro_otros',  label: 'Seguro · otros' },
      { id: 'gimnasio',      label: 'Gimnasio' },
      { id: 'educacion',     label: 'Educación · colegio · universidad' },
      { id: 'profesional',   label: 'Profesional · colegio · sindicato' },
      { id: 'ong',           label: 'ONG · donaciones recurrentes' },
      { id: 'otros',         label: 'Otros' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    description: 'Impuestos · multas · coche · personalizado',
    icon: 'CirclePlus',
    subtipos: [
      { id: 'impuestos',           label: 'Impuestos · tasas' },
      { id: 'multas',              label: 'Multas' },
      { id: 'mantenimiento_coche', label: 'Mantenimiento coche' },
      { id: 'personalizado',       label: 'Personalizado',  isCustom: true },
    ],
  },
];
```

### 1.3 · Catálogo Inmueble · 7 tipos · 23 subtipos

CC codifica en `src/modules/inmuebles/wizards/utils/tiposDeGastoInmueble.ts`:

```typescript
export const TIPOS_GASTO_INMUEBLE: TipoGasto[] = [
  {
    id: 'tributos',
    label: 'Tributos',
    description: 'IBI · tasas municipales',
    icon: 'Landmark',
    subtipos: [
      { id: 'ibi',           label: 'IBI' },
      { id: 'tasa_basuras',  label: 'Tasa basuras' },
      { id: 'otros',         label: 'Otros' },
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    description: 'Cuota ordinaria · derramas',
    icon: 'Users',
    subtipos: [
      { id: 'cuota_ordinaria', label: 'Cuota ordinaria' },
      { id: 'derrama',         label: 'Derrama' },
      { id: 'otros',           label: 'Otros' },
    ],
  },
  {
    id: 'suministros',
    label: 'Suministros',
    description: 'Luz · gas · agua · internet',
    icon: 'Zap',
    subtipos: [
      { id: 'luz',      label: 'Luz' },
      { id: 'gas',      label: 'Gas' },
      { id: 'agua',     label: 'Agua' },
      { id: 'internet', label: 'Internet' },
      { id: 'otros',    label: 'Otros' },
    ],
  },
  {
    id: 'seguros',
    label: 'Seguros',
    description: 'Hogar · impago · otros',
    icon: 'Shield',
    subtipos: [
      { id: 'hogar',   label: 'Hogar' },
      { id: 'impago',  label: 'Impago' },
      { id: 'otros',   label: 'Otros' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión',
    description: 'Agencia · gestoría · asesoría',
    icon: 'Briefcase',
    subtipos: [
      { id: 'honorarios_agencia', label: 'Honorarios agencia' },
      { id: 'gestoria',           label: 'Gestoría' },
      { id: 'asesoria',           label: 'Asesoría' },
      { id: 'otros',              label: 'Otros' },
    ],
  },
  {
    id: 'reparacion',
    label: 'Reparación y conservación',
    description: 'Caldera · integral · limpieza',
    icon: 'Wrench',
    subtipos: [
      { id: 'mantenimiento_caldera',  label: 'Mantenimiento caldera' },
      { id: 'mantenimiento_integral', label: 'Mantenimiento integral' },
      { id: 'limpieza',               label: 'Limpieza' },
      { id: 'otros',                  label: 'Otros' },
    ],
  },
  {
    id: 'otros',
    label: 'Otros',
    description: 'Gastos personalizados',
    icon: 'CirclePlus',
    subtipos: [
      { id: 'personalizado', label: 'Personalizado',  isCustom: true },
    ],
  },
];
```

**Diferencias clave Inmueble vs Personal:**

- 7 tipos en Inmueble (vs 6 en Personal)
- "Tributos" como tipo propio (en Personal IBI estaba dentro de Vivienda)
- "Comunidad" sube de subtipo a familia (en inmueble cuota vs derrama es relevante)
- Sin "Vivienda" · "Día a día" · "Suscripciones" · "Seguros y cuotas" · NO aplican
- Hipoteca NO existe en inmueble (vive en Financiación)
- "Otros" solo tiene "Personalizado" · NO incluye mantenimiento coche · sin ruido

---

## 2 · INSTRUCCIONES INVIOLABLES

### 2.1 · Scope estricto

CC trabaja **solo** en:

1. Crear componente reutilizable `<TipoGastoSelector />` en `src/modules/shared/components/` (o path equivalente del repo)
2. Crear catálogo `tiposDeGastoPersonal.ts` con estructura exacta de §1.2
3. Crear catálogo `tiposDeGastoInmueble.ts` con estructura exacta de §1.3
4. Sustituir el `<select>` de Tipo en wizard T34 (Personal) por el nuevo componente
5. Sustituir el `<select>` de Tipo en wizard T35 (Inmueble) por el nuevo componente
6. Convertir los `<select>` de Subtipo en ambos wizards a select HTML dinámico
7. Implementar campo condicional "Nombre del gasto" cuando subtipo seleccionado tiene `isCustom: true` · en ambos wizards
8. Asegurar que ambos forms guardan correctamente · `tipo`, `subtipo`, y `nombrePersonalizado` cuando aplica
9. Auditar el bug de "Alquiler vivienda" no aparecía en T34 · documentar causa raíz

NADA más.

### 2.2 · CC tiene PROHIBIDO

❌ Modificar el schema de `compromisosRecurrentes` o cualquier otro store
❌ Subir DB_VERSION
❌ Modificar `compromisosRecurrentesService.ts` · `treasuryBootstrapService.ts` · ni ningún servicio
❌ Tocar las secciones 2 (Calendario) · 3 (Importe) · 4 (Cuenta + Bolsa) de los wizards
❌ Modificar la lógica de validación más allá de añadir validación de `nombrePersonalizado`
❌ Cambiar otros aspectos visuales de los wizards que no sean los selects de Tipo/Subtipo
❌ Crear migración de datos (registros antiguos siguen siendo válidos · NO se tocan)
❌ Mezclar lógica entre wizards · cada uno usa SU catálogo

### 2.3 · Reglas técnicas duras

- TypeScript estricto · cero `any` · cero `as any`
- Tokens v5 · cero hex hardcoded
- Lucide-react · única librería iconos
- Componente `<TipoGastoSelector />` autocontenido · accesible (ARIA · keyboard navigation)
- Idempotencia · si CC modifica un fichero existente · solo cambia lo necesario · respeta el resto

### 2.4 · Stop-and-wait

CC abre PR · publica · **DETIENE** · espera revisión Jose · NO mergea hasta autorización.

---

## 3 · Etapa A · auditoría inicial · OBLIGATORIA antes de codear

### A.1 · Reportar contenido actual de los catálogos en producción

```bash
grep -rn "TIPOS_GASTO\|tiposDeGasto" src/modules/personal/ src/modules/inmuebles/ | head -30
```

CC reporta:
- Path exacto de cada catálogo (Personal e Inmueble)
- Listado completo de tipos · subtipos · IDs · labels para ambos
- Confirmar si "Alquiler vivienda" está · o NO está · en T34
- Confirmar si los subtipos de Reparación y conservación están en T35

### A.2 · Reportar render de los selects en los wizards

```bash
grep -rn "<optgroup\|<select" src/modules/personal/wizards/ src/modules/inmuebles/wizards/ | head -30
```

CC reporta:
- Cómo está renderizado actualmente cada select
- Si hay lógica condicional que oculta opciones
- Si hay valores hardcoded en JSX que no vienen del catálogo

### A.3 · Conclusión auditoría

CC documenta en el PR · "**Causa raíz del bug de Alquiler en T34**" · una de:
- A) "Alquiler vivienda" NO estaba en el catálogo (CC olvidó incluirlo)
- B) "Alquiler vivienda" sí estaba pero un bug de render lo oculta
- C) "Alquiler vivienda" está visible · Jose no lo encontró por ruido visual

CC NO empieza a codear hasta documentar A.1 · A.2 · A.3.

---

## 4 · Etapa B · estructura archivos

### B.1 · Archivos a crear

```
src/modules/shared/components/TipoGastoSelector/
  - TipoGastoSelector.tsx           (componente principal · reutilizable)
  - TipoGastoSelector.module.css    (estilos)
  - TipoGastoSelector.types.ts      (interfaces · TipoGasto · SubtipoGasto · Props)
  - useTipoGastoKeyboard.ts         (hook · navegación con teclado)
  - index.ts                        (re-export)

src/modules/personal/wizards/utils/
  - tiposDeGastoPersonal.ts         (catálogo Personal · estructura §1.2)

src/modules/inmuebles/wizards/utils/
  - tiposDeGastoInmueble.ts         (catálogo Inmueble · estructura §1.3)
```

### B.2 · Archivos a modificar

```
src/modules/personal/wizards/NuevoGastoRecurrentePage.tsx
  · sustituir <select> de Tipo por <TipoGastoSelector catalog={TIPOS_GASTO_PERSONAL} />
  · convertir <select> de Subtipo a select dinámico
  · añadir input condicional "Nombre del gasto" cuando subtipo.isCustom
  · ajustar validación + submit

src/modules/inmuebles/wizards/NuevoGastoRecurrenteInmueblePage.tsx
  · sustituir <select> de Tipo por <TipoGastoSelector catalog={TIPOS_GASTO_INMUEBLE} />
  · convertir <select> de Subtipo a select dinámico
  · añadir input condicional "Nombre del gasto" cuando subtipo.isCustom
  · ajustar validación + submit
```

### B.3 · Archivos que NO se tocan

❌ `src/services/personal/compromisosRecurrentesService.ts`
❌ `src/services/treasuryBootstrapService.ts`
❌ `src/services/db.ts`
❌ Tipos del store
❌ Otras secciones de ambos wizards (Calendario · Importe · Cuenta · Bolsa)

---

## 5 · Etapa C · UI y comportamiento del componente

### 5.1 · API del componente `<TipoGastoSelector />`

```typescript
interface TipoGastoSelectorProps {
  value: string | null;                   // ID del tipo seleccionado
  onChange: (tipoId: string) => void;     // callback al elegir tipo
  catalog: TipoGasto[];                   // catálogo · permite reuso entre Personal e Inmueble
  placeholder?: string;                   // default '— Selecciona —'
  disabled?: boolean;
  error?: string;
}
```

**Reusable** · al pasar el catálogo por prop · ambos wizards usan el mismo componente con catálogos distintos.

### 5.2 · Comportamiento visual

**Estado · cerrado · sin selección:**
- Trigger · icono info gris en cuadrado pequeño · placeholder "— Selecciona —" · flecha abajo
- Padding · 11px vertical · 14px horizontal

**Estado · cerrado · con selección:**
- Trigger · icono dorado lleno (Lucide del tipo) · label del tipo en bold

**Estado · abierto:**
- Panel desplegado · 380px max-height · scroll si excede
- 6-7 items según catálogo · cada uno con · cuadrado con icono Lucide gris · label bold · descripción pequeña gris debajo
- Hover · fondo dorado claro (`var(--gold-wash-2)`) · icono pasa a oro
- Selected · fondo `var(--gold-wash)` · icono cuadrado oro pleno · check oro a la derecha

**Animación · simple · 150ms**

### 5.3 · Navegación con teclado

- `↑` `↓` · navegar entre items · highlight visual del item activo
- `↵` · seleccionar item activo · cerrar panel
- `esc` · cerrar panel sin seleccionar
- `Tab` · cerrar panel · pasar al siguiente input
- `Space` con trigger enfocado · abrir panel

### 5.4 · Accesibilidad

- `role="combobox"` en trigger
- `aria-expanded` true/false
- `aria-haspopup="listbox"`
- `aria-controls` apuntando al panel
- Items con `role="option"` · `aria-selected`
- Foco visible · NO solo color · usar `outline`

### 5.5 · Iconos por tipo · Lucide

**Personal:**

| Tipo | Icono Lucide |
|---|---|
| Vivienda | `Home` |
| Suministros | `Zap` |
| Día a día | `ShoppingCart` |
| Suscripciones | `Tv` |
| Seguros y cuotas | `Shield` |
| Otros | `CirclePlus` |

**Inmueble:**

| Tipo | Icono Lucide |
|---|---|
| Tributos | `Landmark` |
| Comunidad | `Users` |
| Suministros | `Zap` |
| Seguros | `Shield` |
| Gestión | `Briefcase` |
| Reparación y conservación | `Wrench` |
| Otros | `CirclePlus` |

### 5.6 · Sin búsqueda en v1

Solo 6-7 items en el primer nivel · no hace falta search input. Si en futuro se añaden tipos · se reactiva.

### 5.7 · Subtipo · select HTML dinámico

NO se usa el componente custom para el subtipo. Es un `<select>` HTML estándar que cumple:

- **Disabled** cuando `tipo === null` · placeholder "— Elige primero un tipo —"
- **Habilitado** cuando hay tipo · primer option = "— Selecciona —" · luego los subtipos del tipo elegido
- Al cambiar de tipo · el subtipo se RESETEA a null
- Si subtipo seleccionado tiene `isCustom: true` · debajo aparece el bloque "Nombre del gasto"

### 5.8 · Bloque "Nombre del gasto" · condicional

**Visible solo cuando** · `subtipo` está seleccionado Y `subtipo.isCustom === true`

**Estructura:**
- Bloque dorado claro · fondo `var(--gold-wash-2)` · borde `var(--gold-wash)` · padding 12-14px
- Label "Nombre del gasto" en color `var(--gold-ink)` · pill rojo `●` (obligatorio)
- Input texto · placeholder "ej. Cuota de mi club deportivo" (Personal) / "ej. Limpieza de canalones" (Inmueble)
- Helper text · "Aparecerá así en tu listado de gastos"

**Validación · si visible · obligatorio · NO submit si vacío.**

### 5.9 · Persistencia · qué se guarda

CC verifica el schema real del store en A.1 y adapta. Esquema esperado:

```typescript
{
  // ... campos existentes
  tipo: 'otros',                    // ID del tipo · ej. 'otros'
  subtipo: 'personalizado',         // ID del subtipo · ej. 'personalizado'
  nombrePersonalizado?: 'Alquiler vivienda',  // solo si subtipo.isCustom · NO requerido si no
}
```

**IMPORTANTE** · si el schema actual NO tiene `nombrePersonalizado` · CC reporta y propone solución (probablemente reusar campo `alias` · `descripcion` · o similar existente · NO crear campo nuevo · NO subir DB_VERSION).

---

## 6 · Etapa D · verificación

### Build
- [ ] `tsc --noEmit` · 0 errores nuevos
- [ ] `npm run build` · pasa
- [ ] `npm test` · pasa

### Funcional · selector Tipo · ambos wizards
- [ ] Trigger cerrado muestra placeholder si null
- [ ] Click abre panel con items del catálogo correspondiente
- [ ] Cada item tiene · icono Lucide · label · descripción
- [ ] Hover dorado claro
- [ ] Click en item · selecciona · cierra panel · trigger muestra el tipo
- [ ] Esc cierra · ↑↓↵ funcionan
- [ ] Foco visible al tabbing

### Funcional · subtipo dinámico Personal
- [ ] Disabled si tipo === null
- [ ] Habilitado al elegir tipo
- [ ] Vivienda · 4 subtipos
- [ ] Suministros · 6 subtipos
- [ ] Día a día · 8 subtipos (incluye Supermercado · Transporte · Ocio · Salud · Ropa · Cuidado personal)
- [ ] Suscripciones · 6 subtipos
- [ ] Seguros y cuotas · 9 subtipos
- [ ] Otros · 4 subtipos · incluyendo "Personalizado"

### Funcional · subtipo dinámico Inmueble
- [ ] Tributos · 3 subtipos (IBI · Tasa basuras · Otros)
- [ ] Comunidad · 3 subtipos (Cuota ordinaria · Derrama · Otros)
- [ ] Suministros · 5 subtipos (Luz · Gas · Agua · Internet · Otros)
- [ ] Seguros · 3 subtipos (Hogar · Impago · Otros)
- [ ] Gestión · 4 subtipos
- [ ] Reparación · 4 subtipos (Mantenimiento caldera · Integral · Limpieza · Otros)
- [ ] Otros · solo "Personalizado"

### Funcional · "Otros · Personalizado" en ambos wizards
- [ ] Personal · Tipo "Otros" + Subtipo "Personalizado" · aparece input "Nombre del gasto"
- [ ] Inmueble · Tipo "Otros" + Subtipo "Personalizado" · aparece input "Nombre del gasto"
- [ ] Bloque visible es dorado · obligatorio
- [ ] NO submit si nombre vacío
- [ ] Al cambiar de tipo o subtipo · bloque desaparece · campo se limpia
- [ ] Submit con "Personalizado · texto libre" guarda correctamente

### Funcional · datos guardados
- [ ] Compromiso guardado tiene `tipo` con ID correcto
- [ ] Compromiso guardado tiene `subtipo` con ID correcto
- [ ] Si subtipo era custom · `nombrePersonalizado` (o equivalente) tiene el texto
- [ ] Si subtipo NO era custom · `nombrePersonalizado` undefined / null
- [ ] Compromisos antiguos creados en T34/T35 siguen mostrándose (compatibilidad hacia atrás)

### Auditoría bug Alquiler T34
- [ ] PR documenta causa raíz · A · B · o C
- [ ] Tras fix · "Alquiler vivienda" es visible al elegir Tipo "Vivienda" · Subtipo "Alquiler"

### Tipado
- [ ] Cero `any` · cero `as any` nuevos
- [ ] Tipos `TipoGasto` · `SubtipoGasto` exportados
- [ ] Props del componente tipadas

### CSS / tokens
- [ ] Cero hex hardcoded
- [ ] Tokens v5 respetados

### Accesibilidad
- [ ] ARIA roles correctos
- [ ] Keyboard navigation funcional
- [ ] Foco visible

### Reglas de scope
- [ ] CERO modificación de stores · servicios · DB
- [ ] CERO modificación de otras secciones de los wizards
- [ ] CERO migración de datos
- [ ] DB_VERSION intacto
- [ ] Componente reutilizable · API limpia · catálogo por prop
- [ ] Personal e Inmueble usan el MISMO componente con catálogos distintos

---

## 7 · PR

**Rama** · `claude/t34-t35-fix-selector-tipo-subtipo`

**Título PR** · `fix(wizards): T34+T35-fix selector custom Tipo+Subtipo · 2 niveles · Otros·Personalizado funcional`

**Body PR**:

```
## Resumen

Tras mergear T34 y T35 · validación de Jose detectó UX inferno en ambos
selects de Tipo + bug crítico de "Otros · personalizado" no funcional + falta
de tipos cotidianos en Personal.

T34-fix + T35-fix sustituyen ambos selects HTML por el mismo componente
custom reutilizable · 2 niveles · catálogos diferenciados · "Personalizado"
con input nombre libre.

## Auditoría · causa raíz del bug de "Alquiler vivienda" en T34

[CC documenta · A) no estaba · B) bug de render · C) ruido visual]

## Cambios

### Archivos nuevos
- ✨ `<TipoGastoSelector />` · componente reutilizable · iconos · keyboard nav · ARIA
- ✨ `tiposDeGastoPersonal.ts` · 6 tipos · 39 subtipos
- ✨ `tiposDeGastoInmueble.ts` · 7 tipos · 23 subtipos
- ✨ `useTipoGastoKeyboard` · hook navegación con teclado

### Modificados
- ✏️ `NuevoGastoRecurrentePage.tsx` (Personal)
  - select Tipo → `<TipoGastoSelector catalog={TIPOS_GASTO_PERSONAL} />`
  - select Subtipo → select HTML dinámico
  - input condicional "Nombre del gasto" si subtipo.isCustom
  - validación + submit ajustados

- ✏️ `NuevoGastoRecurrenteInmueblePage.tsx` (Inmueble)
  - select Tipo → `<TipoGastoSelector catalog={TIPOS_GASTO_INMUEBLE} />`
  - select Subtipo → select HTML dinámico
  - input condicional "Nombre del gasto" si subtipo.isCustom
  - validación + submit ajustados

## Comportamiento

### Antes (T34/T35 mergeados)
- Select gigante con N opciones planas en optgroups
- Sin iconos · sin jerarquía visual
- "Otros" no permitía nombre libre
- Personal sin Supermercado · Transporte · Ocio · Salud · Ropa · Cuidado personal

### Después (T34-fix + T35-fix)
- 6-7 tipos visibles con iconos Lucide · descripción clara
- Subtipos cambian dinámicamente (3-9 por familia)
- "Otros · Personalizado" abre input "Nombre del gasto" obligatorio
- Personal · día a día completa con 8 subtipos cotidianos
- Inmueble · 7 familias estructuradas (Tributos · Comunidad · Suministros · Seguros · Gestión · Reparación · Otros)

### Catálogo Personal final
- Vivienda (4): Alquiler · IBI · Comunidad · Seguro hogar
- Suministros (6): Luz · Gas · Agua · Internet · Móvil · Otros
- Día a día (8): Supermercado · Transporte · Restaurantes · Ocio · Salud · Ropa · Cuidado personal · Otros
- Suscripciones (6): Streaming · Música · Software · Cloud · Prensa · Otros
- Seguros y cuotas (9): Salud · Coche · Vida · Otros · Gimnasio · Educación · Profesional · ONG · Otros
- Otros (4): Impuestos · Multas · Mantenimiento coche · Personalizado*

### Catálogo Inmueble final
- Tributos (3): IBI · Tasa basuras · Otros
- Comunidad (3): Cuota ordinaria · Derrama · Otros
- Suministros (5): Luz · Gas · Agua · Internet · Otros
- Seguros (3): Hogar · Impago · Otros
- Gestión (4): Honorarios agencia · Gestoría · Asesoría · Otros
- Reparación y conservación (4): Mantenimiento caldera · Integral · Limpieza · Otros
- Otros (1): Personalizado*

*Personalizado activa input "Nombre del gasto" obligatorio

## Reusabilidad

Componente `<TipoGastoSelector />` recibe el catálogo por prop · ambos wizards
usan el mismo componente con catálogos diferentes. Futuros wizards (contratos · 
ingresos · etc) podrán reusarlo igual.

## NO toca

- ❌ Schema · DB_VERSION intacto
- ❌ Servicios · stores
- ❌ Otras secciones de los wizards (Calendario · Importe · Cuenta · Bolsa)
- ❌ Datos existentes · compromisos creados en T34/T35 siguen funcionando

## Cambios respecto al spec

[CC documenta desviaciones · si no hay · "Cero · implementación literal"]

## Verificación

- [x] tsc · 0 errores
- [x] build · pasa
- [x] Selectores Tipo abren · navegan · seleccionan · ambos wizards
- [x] Subtipos dinámicos funcionan · ambos wizards
- [x] "Otros · Personalizado" muestra input · validación obligatoria · ambos wizards
- [x] Personal · día a día completa con 8 subtipos
- [x] Inmueble · 7 familias estructuradas · Reparación con 4 subtipos
- [x] Datos guardan tipo + subtipo + nombrePersonalizado correctamente
- [x] Compromisos antiguos siguen mostrándose
- [x] Keyboard nav funcional · ARIA correcto
- [x] Tokens v5 · cero hex
- [x] DB_VERSION intacto
- [x] Causa raíz bug Alquiler documentada

**STOP-AND-WAIT** · Jose valida en deploy preview y mergea cuando OK.

Tras merge · siguientes:
- T34.b · vista listado/edición/borrado de compromisos personales
- T35.b · vista listado/edición/borrado de compromisos inmueble
- T34.c / T35.c · catálogos típicos (precarga rápida)
```

**NO mergear.** Esperar Jose.

---

## 8 · Si CC encuentra bloqueo

1. **Schema `compromisosRecurrentes` no tiene campo para nombre personalizado** → reportar · proponer reusar `alias` o `descripcion` · NO crear campo nuevo
2. **Causa raíz bug Alquiler no clara** → documentar lo que se sabe · seguir adelante (la lista nueva resuelve el problema)
3. **Lucide no tiene un icono adecuado** → usar el más cercano · documentar
4. **Componente compartido genera conflicto con código existente** → PARAR · preguntar a Jose
5. **Catálogo viejo está hardcoded en JSX y no en archivo separado** → CC limpia eso · documenta · es parte de la fix

**En ningún caso CC modifica schema · servicios · stores · NO crea migraciones · NO mergea sin autorización.**

---

## 9 · Inputs disponibles

- Repo `gomezrjoseantonio-bot/ultimointento` · branch `main`
- T34 + T35 mergeadas en `main` · base sobre la que aplicar fix
- Mockup HTML de referencia · `atlas-selector-tipo-subtipo-v2.html`
- DB_VERSION 67 · estable

---

## 10 · Resumen ejecutivo del spec

> Sustituye selects horripilantes de T34 y T35 por componente `<TipoGastoSelector />` reutilizable. Ambos wizards usan el mismo componente con catálogos diferentes (Personal · 6 tipos · 39 subtipos / Inmueble · 7 tipos · 23 subtipos). Subtipo dinámico. "Otros · Personalizado" abre input "Nombre del gasto" obligatorio. Auditar causa raíz bug Alquiler T34. NO toca schema · NO toca servicios. 1 PR único · stop-and-wait · 7-9h CC.

---

**Fin spec T34-fix + T35-fix · 1 PR único · stop-and-wait · 7-9h CC · UX humana sobre wizards existentes.**
