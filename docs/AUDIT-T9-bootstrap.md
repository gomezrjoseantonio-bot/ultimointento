# AUDIT · T9.1 · Bootstrap compromisos recurrentes

> Auditoría inicial · sub-tarea 9.1 · `compromisoDetectionService` + audit + DEV showcase.
>
> Esta auditoría documenta **qué fuentes consume el detector** y **qué se mide** en
> el run inicial sobre la DB del usuario. No incluye un volcado numérico de la
> DB de Jose porque el snapshot real solo es accesible desde su navegador
> (IndexedDB local · no se sube al repo).
>
> El canal real para observar los números actuales es la página DEV
> `/dev/compromiso-detection` desplegada en el preview. Allí se ejecuta
> `detectCompromisos()` contra la DB local del navegador y muestra el
> `DetectionReport` completo.

---

## 1 · Fuentes de datos consultadas

El servicio `compromisoDetectionService` (read-only) lee los siguientes stores:

| Store                    | Uso                                                                  |
|--------------------------|----------------------------------------------------------------------|
| `movements`              | Universo de gastos a clusterizar · filtrado por `amount<0`, `unifiedStatus !== 'ignorado'`, fecha ≥ `today - maxAntiguedadMeses`. |
| `viviendaHabitual`       | Filtro fase 5 · si hay vivienda habitual activa con su tipo (inquilino/propietario), se excluyen candidatos cuyo concepto sugiere comunidad/IBI/seguro hogar/hipoteca/alquiler de la habitual. |
| `properties`             | Filtro fase 5 · inmuebles de inversión activos · se excluyen candidatos con tokens (alias, dirección, referencia catastral) que matcheen un inmueble. |
| `compromisosRecurrentes` | Filtro fase 5 · candidatos cuyo `cuentaCargo + conceptoBancario` similar ya tenga compromiso vivo se descartan (porCompromisoExistente). |
| `personalData`           | Para asignar `personalDataId` al candidato propuesto (ámbito personal). |

**Escrituras** · ninguna. T9.1 es solo lectura.

---

## 2 · Estadísticas medidas en el `DetectionReport`

```ts
estadisticas: {
  movementsAnalizados: number;        // total tras filtro temporal + status
  movementsAgrupados: number;         // los que entraron en algún cluster
  movementsDescartados: number;       // los que no caen en ningún cluster ≥ minOcurrencias
  clustersTotales: number;            // grupos formados (concepto+cuenta) ≥ minOcurrencias
  candidatosPropuestos: number;       // clusters que pasaron las 5 fases
  candidatosFiltrados: {
    porViviendaHabitual: number;      // bloqueado por matching con `viviendaHabitual`
    porInmuebleInversion: number;     // bloqueado por matching con `properties`
    porCompromisoExistente: number;   // ya hay compromiso vivo equivalente
    porScoreInsuficiente: number;     // confidence < 60
  };
}
```

Cada candidato propuesto incluye:

- `confidence` (0-100)
- `razonesScore` (lista de motivos · ej · "8 ocurrencias", "patrón temporal estable", "importe fijo", "proveedor reconocido")
- `avisos` (lista de warnings · ej · "posible solapamiento con vivienda habitual" · "importe sube progresivamente")
- `propuesta` (`Omit<CompromisoRecurrente,'id'|'createdAt'|'updatedAt'>` listo para revisión)

---

## 3 · Stats de la DB Jose · cómo obtenerlas

Para que Jose registre los números de su DB real en este documento o en la
descripción del PR, basta con:

1. Abrir `/dev/compromiso-detection` en el deploy preview
2. Pulsar **Analizar movimientos**
3. Capturar pantalla del bloque "Estadísticas globales"
4. Pegar lista top-10 candidatos con su `confidence` y motivo

Los KPI que esa página muestra (y que conforman la auditoría observable):

- Total movements en `movements` (todos los stores)
- Movements en ventana temporal (defecto 18 meses)
- Movements gasto (`amount<0`)
- Vivienda habitual activa · tipo + referencia catastral si aplica
- Inmuebles de inversión activos · count + alias + referencia catastral
- Compromisos recurrentes activos en DB · enumerados (vacío en producción Jose pre-T9)
- Estadísticas detección · clusters · candidatos · descartados por cada motivo

---

## 4 · Restricciones del modelo respetadas

T9.1 se ciñe a §1.2 de la spec:

- **Vivienda habitual** · NUNCA se propone candidato cuyos tokens encajen con la
  ficha de `viviendaHabitual` activa · esos derivados se generan en otro flujo
  (ATLAS los deriva desde la propia ficha · regla de oro #2).
- **Inmuebles de inversión** · NUNCA se propone candidato cuyos tokens encajen
  con un inmueble del store `properties` · sus gastos viven en `gastosInmueble`
  / `opex` y se gestionan desde el módulo Inmuebles.
- **`PatronRecurrente`** · solo se proponen clusters que encajan en alguna de
  las 8 variantes existentes (`mensualDiaFijo`, `cadaNMeses`,
  `anualMesesConcretos`, etc.). Si un cluster no matchea ninguna · se descarta y
  se documenta como TODO en la descripción del PR · NO se inventa variante
  nueva.
- **`ImporteEvento`** · solo se usan los 4 modos existentes (`fijo`, `variable`,
  `diferenciadoPorMes`, `porPago`). Si el importe es altamente irregular sin
  patrón mensual · se descarta como "gasto irregular" (no compromiso).
- **DB_VERSION** · sigue en 65 · no se toca schema.

---

## 5 · Lo que NO hace T9.1

- ❌ NO escribe en `compromisosRecurrentes` · solo lee y propone
- ❌ NO toca `movementSuggestionService` · vía A sigue como está (devuelve [] mientras el store esté vacío)
- ❌ NO toca `compromisosRecurrentesService` · solo importa tipos auxiliares
- ❌ NO crea UI productiva · solo página DEV para validación
- ❌ NO infiere ámbito 'inmueble' · todos los candidatos salen como `ambito='personal'` (Jose ajusta tras aprobar en 9.3)

---

## 6 · Próximos pasos · 9.2 · 9.3 · 9.4

- **9.2** · `compromisoCreationService` · idempotente · activa vía A
- **9.3** · UI productiva · revisar/editar/aprobar candidatos · escribir en store
- **9.4** · cierre · docs · verificación end-to-end · decisión re-detección automática

---

**Fin auditoría T9.1 · servicio listo para inspección visual en `/dev/compromiso-detection`.**
