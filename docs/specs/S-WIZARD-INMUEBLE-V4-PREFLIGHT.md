# Pre-flight · S-WIZARD-INMUEBLE-V4 · sub-tarea 1

Resultado del grep duro sobre el repo real, ejecutado antes de tocar nada.
DB se mantiene en V70 (sin bump). 40 stores intactos.

## 1 · Wizard actual

Implementación real (todo el contenido del wizard de alta/edición vive en una
sola pantalla con bloques colapsables — *no* en steps):

- **Componente principal** · `src/components/inmuebles/InmuebleFormCompact.tsx` (1127 líneas)
- **Wrapper lazy-routed** · `src/modules/horizon/inmuebles/cartera/PropertyForm.tsx` (11 líneas) · simple `<InmuebleFormCompact mode={mode} />`
- **Wrapper huérfano (legacy, sin consumidores)** · `src/components/properties/PropertyForm.tsx` (134 líneas) · NO importado en ningún sitio
- **Layout/resumen huérfanos (sin consumidores)** ·
  - `src/components/inmuebles/InmuebleWizardLayout.tsx`
  - `src/components/inmuebles/InmuebleResumen.tsx`

## 2 · Rutas afectadas

`src/App.tsx` engancha `PropertyForm` en cuatro rutas:

- `inmuebles/nuevo` (modo `create`)
- `inmuebles/:id/editar` (modo `edit`)
- `gestion/inmuebles/nuevo` (modo `create`)
- `gestion/inmuebles/:id/editar` (modo `edit`)

`src/services/navigationPerformanceService.ts` también precarga el chunk del
PropertyForm cuando el usuario navega hacia esas rutas.

## 3 · Stores y servicios reusados

- **Store `properties`** (DB v70) — schema-less en campos, índice único por `id`
- **Tipo TS canónico `Property`** · `src/services/db.ts:59-160`
- **NO existe `propertiesService`** · el wizard actual habla con la DB
  directamente vía `db.get('properties', id)` / `db.add` / `db.put`
- **Servicios complementarios reusados** ·
  - `src/services/mejorasInmuebleService.ts` · APIs `crear` · `actualizar` · `getPorInmueble` · `getPorInmuebleYEjercicio` · `eliminar` (no hay `bulkUpsert`)
  - `src/services/mueblesInmuebleService.ts` · APIs equivalentes (no hay `bulkUpsert`)
  - `src/services/prestamosService.ts` · `getAllPrestamos()` + `getAllocationFactor` para préstamos vinculados (lectura)
  - `src/services/personalDataService.ts` · `getPersonalData()` devuelve `comunidadAutonoma` (campo `personalData.comunidadAutonoma`)
  - `src/services/personal/viviendaHabitualService.ts` · NO se toca desde el wizard
  - `src/services/vinculosAccesorioService.ts` · NO se toca desde el wizard

## 4 · Campos schema TS · qué falta vs spec v4

`Property` tiene ya: `acquisitionCosts.{price, itp, iva, notary, registry, management, psi, realEstate, other}`,
`fiscalData.{cadastralValue, constructionCadastralValue, constructionPercentage, cadastralRevised}`,
`tipoActivo`, `foto`, `porcentajePropiedad`, `esUrbana`, `aeatAmortization` completo.

NO existe en schema:

- `valorReferencia` (base ITP/AJD desde Ley 11/2021)
- `anexos: { tieneParking, tieneTrastero }` (sub-fila Bloque 5 sólo Piso)
- `usoTipo` (`larga_estancia` · `temporada` · `turistico` · `mixto` · `vivienda_habitual` · `disponible`)
- `alquilerPorHabitaciones: { activo, numeroHabitaciones }`

Se añaden en `Property` como campos opcionales (sin bump de DB_VERSION · IndexedDB es schema-less en campos).

## 5 · Decisión de scope sub-tarea 2

- Borrar `src/components/inmuebles/InmuebleFormCompact.tsx`
- Borrar `src/modules/horizon/inmuebles/cartera/PropertyForm.tsx` (wrapper sin contenido propio)
- Borrar `src/components/inmuebles/InmuebleWizardLayout.tsx` (huérfano)
- Borrar `src/components/inmuebles/InmuebleResumen.tsx` (huérfano)
- Borrar `src/components/properties/PropertyForm.tsx` (huérfano)
- **NO** borrar · `propertiesService` (no existe), `mejorasInmuebleService`, `mueblesInmuebleService`, `prestamosService`, `vinculosAccesorioService`, `viviendaHabitualService`, store `properties`, tipo `Property`
- Apuntar las cuatro rutas (`inmuebles/nuevo`, `inmuebles/:id/editar`, `gestion/inmuebles/nuevo`, `gestion/inmuebles/:id/editar`) al nuevo `src/pages/inmuebles/InmueblePage.tsx`
- Actualizar `navigationPerformanceService` para que precargue el nuevo chunk

## 6 · Caso STOP

No se han detectado contradicciones bloqueantes. `bulkUpsert` no existe en
`mejorasInmuebleService` ni `mueblesInmuebleService` · sub-tarea 4 los
upsertea uno-a-uno (el spec lo permite si CC documenta · este es el aviso).
