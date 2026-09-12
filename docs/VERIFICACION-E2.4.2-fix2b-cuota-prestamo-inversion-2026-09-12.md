# E2.4.2-fix2b · la cuota del préstamo de Inversiones es un ingreso «Inversión» · VERIFICACIÓN

PR #1871 · preflight: `docs/VERIFICACION-E2.4.2-fix2b-preflight-cuota-prestamo-inversion-2026-09-12.md`.

## 1 · Qué se ha hecho

| Pieza | Fichero | Qué |
|---|---|---|
| Catálogo | `src/services/catalogo/catalogoUnico.ts` | familia de ingreso nueva `inversion` («Inversión»), subtipos = `TipoPosicion` del store · 34 familias · DEFINITIVO §2 · MODELO §32.41 |
| Fuente determinista | `src/services/deterministas/cuotasDeInversion.ts` (nuevo) | cuotas de un `prestamo_p2p` contra el cuadro recalculado: neto exacto, fecha ±5 días, un periodo explica una línea, empate no se elige, periodo ya casado no se repite · origen con `familia: 'inversion'`, `subtipo: pos.tipo`, «Cuota 5/60 · Préstamo Socio · Unihouser» y desglose `cuota_inversion` |
| Aritmética única | `src/services/prestamoInversionCuadro.ts` | `cobrosDelCuadro` (la misma que `cobroPrevistoDelMes`), `retencionDePosicion`, `idDePagoDeCuota` (compartido con el alta) |
| Cierre | `src/services/deterministas/cierreDeterminista.ts` | el pago queda anotado en la posición con bruto = interés, retención, neto y movimiento · nuevo o el del alta («dar por cobradas»), por fecha |
| Motor | `src/services/clasificacion/clasificarLinea.ts` | el origen de inversión dice su familia (`inversion` o `rendimiento`) |
| P2 | `src/services/deterministas/rendimientosDeInversion.ts` | los intereses solos traen `rendimiento · interes` (antes cerraban sin familia) |
| Previsión | `src/modules/horizon/tesoreria/services/treasurySyncService.ts` | «Cuota préstamo – …» es `inversion · prestamo_p2p` cuando devuelve capital · previsto y confirmado dicen lo mismo |
| Cableado | `src/services/deterministas/matcheoDeterminista.ts` | la fuente nueva va detrás de las cuotas de préstamo recibido y delante de los pagos apuntados |

Sin `DB_VERSION` (94), sin migración, sin regla dura con nombres de Jose.

## 2 · Comprobación contra el fichero real de Abanca

Préstamo de Jose tal y como está en Inversiones: 30.000 € · TIN 3,25 % · 60 meses · cuota francesa · mensual · retención 19 % · primer cobro 01-03-2025.

| Cuota | Fecha cuadro | Bruta | Interés | Retención | Capital | Neto | Fichero |
|---|---|---|---|---|---|---|---|
| 5 | 01-07-2025 | 542,40 | 76,23 | 14,48 | 466,17 | **527,92** | 527,92 · 01-07-2025 ✔ |
| 6 | 01-08-2025 | 542,40 | 74,97 | 14,24 | 467,43 | **528,16** | 528,16 · 01-08-2025 ✔ |

En pantalla: **Ingreso · Inversión · Préstamo P2P · Préstamo Socio · Unihouser**.

| Fixture Abanca (49 líneas) | #1869 | fix2b |
|---|---|---|
| Con sus ejes | 38 | **40** |
| Sin clasificar, honestas | 11 | **9** · 5 facturas UNIHOUSER (D0 · regla aprendida) · 3 IVA (D4) · 1 «JUNIO 2025» |

Las 5 facturas de Unihouser (1.168,65 · 1.391,25 · 2.109,28 · 1.391,95 · 1.391,25) no casan con ninguna cuota y no entran por concepto: «UNIHOUSER» es un nombre de Jose, no una señal general. Con un clic suyo (Autónomo) el arrastre de #1867 se lleva las otras cuatro → 45/49.

## 3 · Verificación

| Qué | Resultado |
|---|---|
| `npx tsc --noEmit` | limpio |
| `npx eslint` sobre los ficheros tocados | limpio |
| `CI=true npx react-scripts build` | `Compiled successfully` · 0 avisos |
| Suite completa | **24 suites / 100 tests rojos · el mismo conjunto que `main`** · 6.524 en verde (+42 nuevos: fuente, cierre, cuadro, catálogo, fixture) |
| Caracterización del matcheo | la salida exacta del lote de agosto actualizada: el origen de inversión trae `rendimiento · interes` (P2) |
| Trinquete `node scripts/health.mjs --base-main` | OK · `todos_totales` 230 · `archivos_800` 37 · `ficheros_no_v5` 106 |
| `DB_VERSION` | 94 · sin cambios |

## 4 · Hallazgos que quedan fuera (no tocados)

- **Ficha de la inversión · «Ya has cobrado»**: suma `importe_neto` de los pagos `pagado`. Con la cuota anotada entera (527,92) el total es lo que entró en la cuenta, coherente con lo que ya enseña (9.522 € · 18 cobros). Pero «te quedan X por cobrar» resta ese total de los **intereses** proyectados, mezclando capital con interés: es un cálculo previo a este PR y sale «0 €» en la captura de Jose. Queda para su propia tarea.
- **Intereses solos apuntados por `rendimientosService.generarPago`** para un `prestamo_p2p` (capital × TIN / periodos) no coinciden con el cuadro. La fuente nueva va delante y casa por el cuadro; los pagos apuntados de esa generación quedan como estaban.
