# AUDIT-T24 · Valoraciones matching activo_id ↔ properties.id

**Tarea:** T24 – Fix valoraciones_historicas como fuente única  
**Fecha de commit:** 2026-05

---

## Método de auditoría

Se ha añadido a `valoracionesService` el método `auditMatching(tipo)` que devuelve:

```typescript
interface AuditResult {
  tipo: 'inmueble' | 'inversion' | 'plan_pensiones';
  total_valoraciones: number;    // valoraciones del tipo dado en el store
  huerfanas: number;             // valoraciones cuyo activo_id no matchea ningún activo
  ids_huerfanos: string[];       // lista de los activo_id problemáticos
  propiedades_sin_valoracion: string[]; // ids de activos activos sin ninguna valoración
}
```

Para obtener los números reales en el navegador del usuario, ejecutar en la consola del navegador:

```javascript
import('/src/services/valoracionesService.js').then(m =>
  m.valoracionesService.auditMatching('inmueble').then(r => console.table(r))
);
```

O directamente en DevTools → Application → IndexedDB → valoraciones_historicas.

---

## Causa raíz identificada

El matching fallaba por **incompatibilidad de tipos**: `activo_id` almacenado como `number` en
algunos registros de `valoraciones_historicas`, mientras que `prop.id` en `properties` puede
ser `string` dependiendo de la ruta de creación.

La comparación estricta `v.activo_id === prop.id` (number vs string) producía 0 matches.

---

## Correcciones aplicadas (T24.1)

| Fichero | Cambio |
|---------|--------|
| `valoracionesService.ts` | Todos los filtros normalizan con `String(v.activo_id) === String(id)` |
| `valoracionesService.ts` | Método `getValoracionMasReciente` con normalización String |
| `valoracionesService.ts` | Método `getAllValoraciones` para acceso bulk centralizado |
| `valoracionesService.ts` | Método `getMapValoracionesMasRecientes` para queries eficientes (1 DB read) |
| `dashboardService.ts` | Sustituido acceso directo por `valoracionesService.getMapValoracionesMasRecientes('inmueble')` |
| `InmueblesAnalisis.tsx` | Sustituido `getCachedStoreRecords('valoraciones_historicas')` por `valoracionesService.getAllValoraciones()` |
| `informesDataService.ts` | Sustituido `db.getAll('valoraciones_historicas')` por `valoracionesService.getAllValoraciones()` |
| `atlasExportService.ts` | Sustituido `db.getAll('valoraciones_historicas')` por `valoracionesService.getAllValoraciones()` (bulk export) |
| `proyeccionMensualService.ts` | Sustituido `db.getAll('valoraciones_historicas')` por `valoracionesService.getAllValoraciones()` |

**NO modificados (operaciones de escritura/DELETE — fuera del alcance T24):**
- `inversionesService.ts` línea 245 (DELETE cascada)
- `planesPensionesService.ts` línea 103 (DELETE cascada)
- `indexaCapitalImportService.ts` línea 313 (escritura)

---

## Números esperados (del pantallazo del usuario)

| Campo | Valor |
|-------|-------|
| Store `valoraciones_historicas` (tipo `inmueble`) | 8 registros |
| Valores registrados | 240.000 · 230.000 · 185.000 · 152.000 · 152.000 · 130.000 · 12.000 · 5.000 |
| Suma valoraciones reales | **1.106.000 €** |
| Valor que mostraba `/panel` (antes) | 502.831 € (incorrecto — usaba `acquisitionCosts.price`) |
| Valor que debe mostrar `/panel` (después) | suma real de valoraciones más recientes por inmueble |

> Los números exactos de huérfanas y propiedades_sin_valoracion dependen de los datos
> del usuario en su IndexedDB y solo son accesibles desde el navegador.

---

## Confirmaciones

- [x] DB_VERSION sigue en **65** — 40 stores intactos, cero migración
- [x] Normalización String aplicada en todos los métodos de filtro del servicio
- [x] Datos del usuario NO modificados — cero borrado, cero migración
- [x] `getMapValoracionesMasRecientes` usa una sola query DB (no N queries por propiedad)
