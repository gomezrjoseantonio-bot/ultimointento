# E2.4.2-fix2b · cuota de préstamo concedido (Unihouser) · PREFLIGHT

Estado: **cerrado con Jose el 12 sep** (chat) · PR propio tras el merge de #1869 (`06dc38c`).

## 1 · Lo que Jose ha decidido (11 sep)

- **D0** · Las 5 líneas UNIHOUSER que no son cuota (1.168,65 · 1.391,25 · 2.109,28 · 1.391,95 · 1.391,25) son **facturas por servicios** → `ingreso · autonomo` («Autónomo», familia que ya existe en el catálogo).
- **D1** · El préstamo es una inversión: 30.000 € que vuelven con intereses. Vale la propuesta de un solo movimiento con desglose, **pero a nivel de tesorería es un ingreso**.
- **D2** · Un movimiento por línea, con el desglose (capital / interés / retención) anotado en el origen. Ninguna línea se parte en dos.

## 2 · Lo que he comprobado contra el código (Regla C)

| Comprobación | Resultado |
|---|---|
| Cuadro recalculado con tus parámetros (30.000 · 3,25 % · 60 m · francesa · mensual · 19 % · 1.er cobro 01-03-2025) | Cuota 5 (01-07-2025) neto **527,92** · cuota 6 (01-08-2025) neto **528,16**. Casan céntimo a céntimo con el fichero. |
| Fórmula que casa | `capital devuelto + interés × (1 − 0,19)` · es la misma que ya usa la previsión (`cobroPrevistoDelMes`). |
| Cómo trata hoy la previsión esa cuota | `treasurySyncService` ya crea el previsto «Cuota préstamo – Préstamo Socio» por el neto entero como **ingreso · rendimiento · rendimiento_inversion**. Solo para meses futuros/en curso: un extracto de 2025 no tiene previstos. |
| Qué pasa hoy con esas dos líneas al importar | Si al dar de alta el préstamo marcaste «dar por cobradas» las cuotas vencidas, la posición guarda pagos `pagado` con `importe_neto` = cuota neta y la fuente `rendimientosQueCuadran` ya las reconoce **el mismo día**. Pero cierra el movimiento **sin familia** (los orígenes de cuadro no la ponen) y no cubre periodos que no estén en esos pagos. |
| Tesorería y los internos | «Ingresos del mes» excluye todo `movimiento_interno` (`esTraspasoInterno`). Una familia interna nueva habría escondido la cuota de los ingresos, justo lo contrario de tu D1. |
| IRPF | Lee `importe_bruto` y `retencion_fiscal` de cada pago de la posición. Si el pago lleva bruto = interés (76,23) y retención (14,48), la declaración solo ve el interés. Correcto sin tocarlo. |
| Catálogo | No hace falta familia nueva. `rendimiento · rendimiento_inversion` ya existe. |

## 3 · Diseño (cerrado con Jose · 12 sep)

Jose, literal: «Yo dejé un dinero a mi empresa en formato de préstamo. Y eso está en Inversión. Cada mes me devuelve del dinero en cuotas (ahí está el dinero del capital más los intereses − IRPF retenido). Estamos en Tesorería.» Y: «¿Por qué le llamas préstamo concedido, cuando está en un store que se llama Inversiones, que se han clasificado según un tipo y a su vez tiene nombre? ¿Cuál es la familia?»

**La familia es la que dice el store.** La cuota es UN ingreso:

| Eje | Valor | De dónde sale |
|---|---|---|
| Naturaleza | `ingreso` | el dinero entra y suma en «Ingresos del mes» (D1) |
| Familia | **`inversion`** · «Inversión» (nueva en el catálogo de ingresos) | el store `inversiones` |
| Subtipo | el `tipo` de la posición · `prestamo_p2p` «Préstamo P2P», `deposito_plazo`, `cuenta_remunerada`, … | `TipoPosicion` del store, misma lista, sin inventar otra |
| Nombre | «Préstamo Socio · Unihouser» | la posición, enganchada por `origenId` (como un gasto a su inmueble) |

En pantalla: **Ingreso · Inversión · Préstamo P2P · Préstamo Socio · Unihouser · 527,92 €**.

Convivencia, para que no se solape:
- **Inversión** = lo que una posición devuelve a la cuenta como un todo (cuota con capital, depósito que vence).
- **Rendimiento · Interés** = un interés solo, sin capital (P2 · Jose: «si es un interés, un rendimiento»).
- **Venta** = vender acciones, fondos, cripto. Ya existía.
- **Disposición de préstamo** (interna) se queda para lo que era: te entra el capital de un préstamo que RECIBES (§32 punto 3).

Descartados por el camino: familia interna nueva (Tesorería la esconde de los ingresos), `rendimiento · rendimiento_inversion` (P1 · «los rendimientos no tienen nada que ver aquí»), «Préstamo concedido» y «Disposición préstamo» como familia de ingreso (colisiona con la interna).

El desglose capital / interés / retención vive en el pago anotado en la posición (§32.33 en espejo). El IRPF ya lo lee de ahí. No se enseña al conciliar.

## 4 · Cambios (todo reutiliza lo que hay · Regla B)

1. **Fuente determinista nueva** `cuotasDePrestamoConcedido.ts`: recorre las posiciones `prestamo_p2p`, recalcula el cuadro con `cuadroDePosicion` (el mismo que la ficha y la previsión), y casa línea positiva contra cuota por importe neto exacto y fecha a **±5 días** (el mismo margen que la cuota de un préstamo recibido). Un periodo explica una sola línea; si dos préstamos empatan, no elige. Salta los periodos que ya tienen pago con movimiento.
2. **El origen trae sus ejes**: `familia: 'inversion'`, `subtipo: <tipo de la posición>`, título «Cuota 5/60 · Préstamo Socio · Unihouser», desglose `{ bruto: interés, retención, neto, capital }` (se añade `capital` opcional al desglose de rendimiento).
2 bis. **P2** · la fuente de pagos apuntados que ya existe (`rendimientosQueCuadran` · intereses de cuenta remunerada y depósito) pasa a traer `familia: 'rendimiento', subtipo: 'interes'`. Hoy cierra sin familia.
3. **Anotar en el origen** (`cierreDeterminista.anotarEnInversion`): si el pago del periodo ya existe (los de «dar por cobradas»), se le pone el movimiento; si no existe, se crea `pagado` con bruto = interés, retención, neto = lo que entró, y el movimiento. Esto además evita que la previsión vuelva a proponer esa cuota (ya comprueba `pagado` por fecha).
4. **Orden** en `reconocerDeterministas`: detrás de las cuotas de préstamo recibido y delante de los pagos apuntados.
5. **Catálogo: una familia de ingreso nueva** `inversion` («Inversión») con los subtipos del store. Entra en el catálogo definitivo §2 y en la lista del test (34 entradas), como `cuota_reta` en #1868. La **previsión** de la cuota («Cuota préstamo – …») pasa de `rendimiento · rendimiento_inversion` a `inversion · prestamo_p2p` cuando la cuota devuelve capital, para que previsto y confirmado digan lo mismo. **Sin DB_VERSION, sin migración** (Regla A).

## 5 · Lo que NO hace

- No clasifica las 5 facturas de Unihouser por regla dura: «UNIHOUSER» es un nombre tuyo, no una señal general. Se resuelven por **regla aprendida**: clasificas una como Autónomo y el tope de 3 arrastra el resto (ya existe desde #1867).
- No toca IVA 303 (D4 · previsión) ni «JUNIO 2025».

## 6 · Resultado esperado en el fixture de Abanca

| | Hoy (#1869) | Tras fix2b | Tras 1 clic tuyo (regla aprendida) |
|---|---|---|---|
| Clasificadas con sus ejes | 38 / 49 | **40 / 49** | 45 / 49 |
| Sin clasificar, honestas | 11 | 9 | 4 (3 IVA · 1 JUNIO 2025) |

## 7 · Decisiones de Jose (11-12 sep)

- **P1** · «El ingreso es uno; los rendimientos no tienen nada que ver aquí» → familia **Inversión**, subtipo el tipo del store, nombre el de la posición (§3).
- **P2** · «Si es un interés, un rendimiento» → `rendimiento · interes` a los intereses de cuenta remunerada y depósito que ya reconoce `rendimientosQueCuadran` (hoy cierran sin familia).
- **P3** · Sin problema → el test da de alta «Préstamo Socio · Unihouser» con los parámetros reales (30.000 · 3,25 % · 60 m · francesa · mensual · 19 % · 1.er cobro 01-03-2025).
- **D0** · Las 5 líneas UNIHOUSER que no son cuota = facturas por servicios → `ingreso · autonomo` por regla aprendida, no por regla dura.
