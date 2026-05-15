# ARQUITECTURA UI FISCAL v2 · 5 pantallas canónicas

> **Propósito** · estructura (no diseño visual) de las 5 pantallas que reemplazan toda la sección Fiscal actual. Cada bloque indica · qué muestra · qué dato · qué store · qué servicio lo provee.
>
> **Base** · mockup `atlas-fiscal.html` existente · extendido con mapa v3+v4 + validaciones caso Jose IRPF 2024.
>
> **Principio** · todas las pantallas leen SOLO de `fiscalResolverService` (puerta única) · que orquesta el resto de servicios. Las UIs nunca leen directamente de stores.

---

## §0 · Mapa global de navegación

```
/fiscal                                  ← F1 · Dashboard
├─ /fiscal/ejercicio/2024                ← F2 · Ejercicio (declarado)
│  ├─ /fiscal/ejercicio/2024/inmueble/12 ← F3 · Inmueble fiscal del año
│  ├─ /fiscal/ejercicio/2024/venta/3     ← F4 · Venta inmueble
│  └─ /fiscal/ejercicio/2024/borrador    ← B2 · Borrador (si año pendiente)
├─ /fiscal/calendario                    ← F5 · Calendario obligaciones
└─ /fiscal/configuracion                 ← F6 · Configuración fiscal
```

Estados de ejercicio según `aeatClassificationService` · determinan qué pantalla muestra cada año ·

| Estado | Año | Pantalla destino |
|---|---|---|
| `prescrito` | 2020 | F2 · solo lectura · sello prescrito |
| `declarado` | 2021-2024 | F2 · solo lectura · sello declarado v1/v2 |
| `pendiente` | 2025 | F2 + acceso a borrador F2b |
| `en_curso` | 2026 | F2 · estimación + desglose B+C |

---

## §1 · F1 · Dashboard fiscal `/fiscal`

> **Cliente entra aquí**. Vista 360 de su situación fiscal · 4 KPIs + timeline + acciones urgentes.

### Header

| Bloque | Dato | Fuente |
|---|---|---|
| Título "Fiscal" + subtítulo "X ejercicios · Y en curso · Z declarados · W prescritos" | counts por estado | `fiscalResolverService.getResumenGlobal` |
| Subtítulo · "Campaña IRPF 2025 · 2 abr – 30 jun" | fecha campaña actual | calendario fiscal hardcoded por año (datos AEAT públicos) |
| Botón "Calendario fiscal" | navegación | → F5 |
| Botón "Configuración" | navegación | → F6 |

### KPI strip · 5 tarjetas grandes

| KPI | Valor | Hint | Click | Datos |
|---|---|---|---|---|
| **1 · 2026 · Proyección IRPF** | a pagar/devolver estimado · ej "−14.200 €" | "a pagar est." | → F2 año 2026 | `estimacionFiscalEnCursoService.calcular(2026)` · campo `resultadoEstimado` |
| **2 · 2025 · Borrador** | resultado calculado · ej "+4.180 €" | "a devolver · presentar" + fecha límite | → F2/borrador 2025 | `fiscalResolverService.getDatosEjercicio(2025)` · resultado |
| **3 · Deuda abierta** | suma deudas pendientes | "tipo deuda · estado ejecutivo/voluntario" | → drawer deuda · F5 tab deudas | nuevo servicio `deudasFiscalesService.getAbiertas()` · hoy parece NO existir · pendiente crear |
| **4 · Próxima obligación** | "−2d" o "vence 22 abr" | "303 · 1T-26 · 1.260 €" | → F5 calendario | `alertasFiscalesService` + cálculo fechas |
| **5 · Arrastres vivos** | suma stock no caducado | "T64 reparaciones · crypto · etc" | → drawer arrastres | `carryForwardService.getTotalVivo()` + `compensacionAhorroService.getDisponibles()` |

### Tabs (debajo de KPIs) · 4 tabs

#### Tab 1 · Timeline (default)

Vista 6 años · una fila por año · una fila por obligación dentro del año.

| Año | Visualización |
|---|---|
| 2026 (en curso) | Barras por obligación (303 1T-4T · 130 1T-4T · 100) · estados (cumplida · pendiente · vencida · futura) · línea roja vertical = HOY |
| 2025 (pendiente) | Igual + barra IRPF 100 destacada en color "pendiente declarar" · CTA "Ir al borrador" |
| 2024 (declarado) | Barras todas cumplidas + (si aplica) barra "deuda" en color rojo para Q3-2024 IVA |
| 2023 (declarado con paralela) | Barra IRPF 100 con marca "v2 paralela" |
| 2022 (declarado con paralela) | Igual |
| 2021 / 2020 (declarados / prescrito) | Compactos · solo IRPF anual |

**Fuente** · `fiscalResolverService.getTimelineMultiAño(2020, 2026)` · nuevo método a crear que devuelve estructura por año + obligaciones.

#### Tab 2 · Ejercicios

Lista limpia de los 7 ejercicios · una fila cada uno ·

| Columna | Dato |
|---|---|
| Año | 2020-2026 |
| Estado | pill (prescrito · declarado · pendiente · en_curso) |
| Resultado IRPF | importe a pagar/devolver |
| Última actualización | fecha · si tiene paralela "corregido dd/mm/yyyy" |
| Prescribe | fecha cuando prescribe · o "—" si prescrito o en curso |
| Acción | "Ver →" abre F2 |

**Fuente** · `fiscalResolverService.getTodosLosEjercicios()` · ya existe.

#### Tab 3 · Deudas

Lista deudas fiscales abiertas + histórico ·

| Columna | Dato |
|---|---|
| Modelo | 100 · 303 · 130 · 184 |
| Periodo | 3T-2024 · año 2023 · etc |
| Principal | importe |
| Recargo | 5% / 10% / 15% / 20% / interés demora |
| Total a pagar | suma |
| Estado | voluntario · ejecutivo · apremio · embargo · pagada |
| Notificada | fecha |
| Plazo | fecha límite pago / acción |

**Caso real Jose** · IVA Q3-2024 · 931,14 + 46,56 ejecutivo 5% = 977,70 € · notificada 23/11/2024.

**Fuente** · nuevo store o servicio `deudasFiscales` · si no existe crear.

#### Tab 4 · Configuración (resumen · link a F6)

Mini-vista del perfil fiscal con CTA "Abrir ajustes fiscales completos →" · navega a F6.

---

## §2 · F2 · Ejercicio detalle `/fiscal/ejercicio/{año}`

> **Pantalla central**. El cliente abre un año para verificar su declaración · ver casillas · acciones.

### Header

| Bloque | Dato | Fuente |
|---|---|---|
| Breadcrumb · Fiscal > Ejercicios > 2024 | navegación | router |
| Título "Ejercicio 2024" + pill estado (DECLARADO / EN_CURSO / etc) | estado | `fiscalResolverService.getDatosEjercicio(2024).estado` |
| Subtítulo · "presentado 24/06/2025 · justificante 1005624311754 · fuente XML AEAT" | fecha · n° justificante · sub-estado A | `ejerciciosFiscalesCoord.aeat.fechaImportacion` + `.fuenteImportacion` |
| Si declarado v2 (paralela) · pill adicional "corregido por paralela 15/10/2024 · resultado actualizado +5.268,20 €" | datos paralela | `ejerciciosFiscalesCoord.aeat` · versión |
| Botones acción (varían según estado) | | |

### Botones acción · según estado

| Estado | Botones visibles |
|---|---|
| `declarado` | "Importar declaración" (re-importar) · "Aplicar paralela" · "Ver versiones" · "Exportar PDF" |
| `pendiente` | "Importar declaración" · "Ver borrador →" · "Marcar como declarado" · "Aplicar paralela" |
| `en_curso` | "Ver estimación actualizada" (refresca proyección) · "Exportar estimación" |
| `prescrito` | "Ver" (solo lectura) · sin botones acción |

### KPI strip · 4 tarjetas

| KPI | Valor | Hint |
|---|---|---|
| **1 · Resultado autoliquidación (casilla 0670)** | "+2.899,75 €" | "a pagar" · navy · o teal si devolución |
| **2 · Cuota líquida (casilla 0587)** | "53.881,09 €" | "antes de retenciones" |
| **3 · Retenciones aplicadas (casilla 0609)** | "50.981,34 €" | "trabajo + capital mob + actividades" |
| **4 · Tipo medio** | "31,3%" | "sobre base liquidable" · si prescribe muy pronto · alerta amber |

### Tabs · 5 tabs

#### Tab 1 · Modelo 100 (default)

Vista jerárquica de casillas · agrupadas por sección Modelo 100. Cada casilla muestra · número · concepto · importe · indicador A/B/C · click para detalle ·

```
▼ A · Rendimientos del trabajo
   0003  Retribuciones dinerarias                       133.350,85 €  [A.xml]
   0005  Retribuciones en especie                         3.457,32 €  [A.xml]
   0007  Contribuciones empresa PP                        1.862,16 €  [A.xml]
   0012  Total ingresos íntegros                        138.670,33 €  [calculado]
   0013  Cotizaciones SS                                  3.664,96 €  [A.xml]
   0019  Otros gastos deducibles                          2.000,00 €  [A.xml]
   0022  Rendimiento neto                               133.005,37 €  [calculado]
   0025  Rendimiento neto reducido                      133.005,37 €  [calculado]

▼ B · Capital inmobiliario · por inmueble
   ┌─ FA32 (CL FUERTES ACEVEDO 32 1 02)  →  ver detalle F3
   │  0102  Ingresos íntegros                            19.675,00 €  [A.xml]
   │  0103  Arrastres entrantes disponibles                6.157,99 €  [A.xml]
   │  0104  Arrastres aplicados                            6.157,99 €  [A.xml]
   │  ...   (todas las casillas resumidas · expandir abre F3)
   │  0149  Rendimiento neto                               5.334,69 €  [A.xml]
   │  0150  Reducción Ley Vivienda 26,07%                  1.390,94 €  [A.xml]
   │  0154  Rendimiento neto reducido                      3.943,75 €  [A.xml]
   ├─ Carles Buigas  →  ver detalle F3
   ├─ Tenderina 48  →  ver detalle F3
   ├─ T64 4D  →  ver detalle F3
   ├─ T64 4IZ  →  ver detalle F3
   ├─ Sant Joan Manresa  →  ver detalle F3
   └─ Trasteros accesorios (2)
      0156  Suma rendimientos netos reducidos             5.442,17 €  [calculado]
      0155  Suma imputaciones renta a disposición           562,89 €  [calculado]

▼ C · Capital mobiliario · ahorro
   0027  Intereses cuentas                                  476,84 €  [A.xml]
   0036  Total ingresos íntegros                            476,84 €  [calculado]
   0040  Rendimiento neto reducido                          476,84 €  [calculado]
   0041  Suma a integrar BI ahorro                          476,84 €  [calculado]

▼ D · Actividad económica Unihouser
   0167  IAE 724
   0168  Modalidad simplificada
   0171  Ingresos explotación                            16.259,71 €  [A.xml]
   0186  SS titular                                       3.529,66 €  [A.xml]
   0199  Servicios profesionales                            198,00 €  [A.xml]
   0218  Σ gastos                                         3.727,66 €  [calculado]
   0221  Diferencia                                      12.532,05 €  [calculado]
   0222  Provisión 5% difícil justificación                 626,60 €  [calculado · R10]
   0223  Total gastos simplificada                        4.354,26 €  [calculado]
   0224  Rendimiento neto                                11.905,45 €  [calculado]
   0226  Rendimiento neto reducido                       11.905,45 €  [calculado]

▼ E · Ganancias y pérdidas patrimoniales (cuando aplica · caso T48 en 2025)
   0303  Tipo elemento transmitido                      Urbano        [si hay venta]
   0316  Valor transmisión
   0317  Valor adquisición actualizado
   0320  Ganancia bruta
   0325  Ganancia reducida → integra BI ahorro

▼ F · Reducción base imponible · planes pensiones
   0426  Aportación trabajador PP empresa                 1.396,68 €  [A.xml]
   0427  Contribución empresarial                         1.862,16 €  [A.xml]
   0467  Con derecho reducción (límite art 52)            3.258,84 €  [calculado · R10]
   0492  Reducción aplicada base general                  3.258,84 €  [calculado]

▼ G · Base imponible · liquidable
   0435  Base imponible general                         150.924,07 €
   0460  Base imponible ahorro                              357,63 €
   0500  Base liquidable general                        147.665,23 €
   0510  Base liquidable ahorro                             357,63 €

▼ H · Cuotas y resultado
   0545  Cuota íntegra estatal                           28.182,15 €
   0546  Cuota íntegra autonómica (Madrid)               25.699,44 €
   0570  Cuota líquida estatal                           28.181,90 €
   0571  Cuota líquida autonómica                        25.699,19 €
   0587  Cuota líquida total                             53.881,09 €
   0595  Cuota autoliquidación                           53.881,09 €
   0609  Σ retenciones e ingresos a cuenta               50.981,34 €
   0610  Cuota diferencial                                2.899,75 €
   0670  Resultado de la declaración                      2.899,75 €  a pagar
```

**Cada sección expandible/colapsable** · click en cada inmueble navega a F3. Indicador de estado de cada dato a la derecha (`A.xml` · `A.pdf` · `A.manual` · `A.sin_detalle` · `calculado` · `proyectado` · `B+C`).

**Si año en curso** · cada casilla muestra desglose B + C ·
```
0102  Ingresos íntegros FA32
        Real ocurrido (B) · 5 cobros confirmados ene-may    2.500 €
        Proyección (C) · 7 cobros previstos jun-dic         3.500 €
        ────────────────────────────────────────────────────────────
        Total previsto fin año                              6.000 €
```

**Fuente principal** · `fiscalResolverService.getDatosEjercicio(año)` · que internamente orquesta `fiscalSummaryService` + `aeatAmortizationService` + `gananciaPatrimonialService` + etc.

#### Tab 2 · Versiones (paralelas)

Histórico de versiones de la declaración ·

| v1 (original) | v2 (paralela 15/10/2024) | Diff |
|---|---|---|
| Presentada 22/06/2023 | Liquidación firmada Hacienda | + 5.268,20 € a ingresar |
| Resultado: −2.700,52 a devolver | Resultado: −2.567,68 a devolver | desfase 5.268,20 |
| Base amortizable Carles Buigas: 116.150 | Base amortizable Carles Buigas: 98.831 | corregido |

Click en una versión muestra el detalle. Si no hay paralela · solo v1 visible.

#### Tab 3 · Deudas y pagos

Lista deudas asociadas a este ejercicio · y pagos realizados ·

| Concepto | Importe | Fecha | Estado |
|---|---|---|---|
| Cuota diferencial pagada 30/06/2025 | 2.899,75 € | 30/06/2025 | Pagada |
| Si hay deuda Q3-2024 vinculada | ... | ... | ... |

#### Tab 4 · Documentos

Documentos fuente que alimentaron la declaración ·

| Documento | Concepto | Procesado |
|---|---|---|
| XML AEAT 2024 | Datos fiscales · contraste | 18/03/2026 |
| PDF Modelo 100 declaración 2024 | Declaración presentada | 24/06/2025 |
| 190 Orange · certificado retenciones | Trabajo · retenciones | feb 2026 |
| 193 Unihouser · certificado | Intereses préstamo socio | feb 2026 |
| 193 Santander · certificado | Capital mobiliario | feb 2026 |
| Facturas reparaciones inmuebles · 5 docs | Gastos 0106 | varios |
| Recibos comunidad · 6 docs | Gastos 0109 | varios |

#### Tab 5 · Borrador (solo si estado pendiente o en_curso)

Versión editable de la declaración antes de presentar. Solo aparece si el cliente puede tocar números. Idéntico a Tab 1 pero campos editables · con alertas R10 visibles · CTA "Generar PDF para presentar".

---

## §3 · F3 · Inmueble fiscal del año `/fiscal/ejercicio/{año}/inmueble/{id}`

> **Pantalla más densa**. Todas las casillas del mapa v3 §1 para un inmueble · un año.

### Header

| Bloque | Dato |
|---|---|
| Breadcrumb · Fiscal > 2024 > FA32 | navegación |
| Título "FA32 · 2024" + pill estado año + pill modo declaración (Modo I/II/III) | `properties.address` + `fiscalResolverService` |
| Subtítulo · "RC 7949807TP6074N0006YM · 366 días arrendado · contrato larga estancia desde 01/05/2023" | datos del inmueble |
| Botón "Ver ficha inmueble completa" | navegación a `/inmuebles/{id}` |
| Botón "Comparar con 2023" | navegación side-by-side |

### KPI strip · 3 tarjetas

| KPI | Valor | Hint |
|---|---|---|
| **1 · Ingresos íntegros (0102)** | 19.675,00 € | "366 días arrendado · 2 contratos" |
| **2 · Total gastos deducibles** | suma 0103+0107+0109+0110+0112-0117 | "incluye amortizaciones + arrastres" |
| **3 · Rendimiento neto reducido (0154)** | 3.943,75 € | "tras reducción Ley Vivienda" |

### Bloque · Modo de declaración

Indicador visual del modo (I · II · III · IV · V) con justificación ·

```
Modo III · Casos especiales · alquiler por habitaciones mixto
   3 habitaciones corta estancia + 2 habitaciones larga estancia
   Método de prorrateo · días-habitación
   ATLAS calculó 4 métodos · escogió el más beneficioso (R10)
   → ver detalle del prorrateo
```

### Bloque grande · Todas las casillas del inmueble

Sección desplegable con todas las casillas relevantes · cada una con ·
- número casilla
- concepto en lenguaje natural
- importe
- indicador estado dato (A.xml · A.pdf · A.manual · A.sin_detalle · calculado · proyectado)
- click para ver "cómo se calculó" · fórmula + inputs

```
INGRESOS
0102  Ingresos íntegros computables                    19.675,00 €
        Desglose · contratos del año
          ▸ Contrato Y5617860D · ene-abr · 4 meses    4.800,00 €
          ▸ Contrato 71682787K · may-dic · 8 meses   14.875,00 €
        [A.xml] · importado de XML AEAT
        Detalle de cobros confirmados → drawer
0101  Días arrendado                                          366
        [A.xml]

ARRASTRES ENTRANTES
0103  Disponible años anteriores                         6.157,99 €
        Origen · 2020-2023
        [A.xml]
0104  Aplicado este ejercicio                            6.157,99 €
        ATLAS aplicó el máximo permitido (R10)
        Quedan 0,00 € pendientes
        [calculado · R10]

GASTOS (orden Modelo 100)
0105  Intereses préstamos del año                        1.580,34 €
        Desglose por préstamo
          ▸ Hipoteca FA32 · 366 días · 100% afect      1.580,34 €
        [A.xml]
0106  Reparación y conservación 2024                       209,33 €
        1 factura · NIF 51080608T
        [A.xml]
0107  Intereses + reparación aplicados (tope N4)         1.789,67 €
        Tope efectivo · 19.675 − 6.157,99 = 13.517,01
        Aplicado · 1.789,67 (cabe entero · sin exceso)
        [calculado · regla N4]
0108  Exceso a arrastrar 4 años                              0,00 €
        [calculado]
0109  Comunidad                                          1.008,00 €  [A.xml]
0112  Servicios personales                                 296,45 €  [A.xml]
0113  Suministros                                        1.930,41 €  [A.xml]
0114  Primas seguro                                        242,79 €  [A.xml]
0115  Tributos · IBI                                       399,22 €  [A.xml]
0117  Amortización mobiliario (10%)                      1.699,66 €  [A.xml]

AMORTIZACIÓN INMUEBLE
0123  Valor catastral total                             68.371,03 €
0124  Valor catastral construcción                      37.294,08 €
0125  % construcción                                          54,55%
0126  Importe adquisición                               98.831,47 €
0127  Gastos inherentes adquisición                      7.473,50 €
0129  Mejoras realizadas en 2024                             0,00 €
0130  Base amortización                                 57.989,36 €
        Método · max((98.831+7.473)×54,55% · 37.294) + 0 mejoras
        [calculado · regla N2 · ganó por coste]
0131  Amortización inmueble del año (3% × días)              ─ €
        (En Modo III · va a 0132)
0132  Amortización casos especiales                        816,12 €
        [A.xml · Modo III · ATLAS prorratea por método días-habitación]

RENDIMIENTO Y REDUCCIÓN
0149  Rendimiento neto                                   5.334,69 €
        = 0102 − 0104 − 0107 − gastos − amort
        [calculado]
0150  Reducción Ley Vivienda                             1.390,94 €
        Aplicada · 60% sobre base reducible parcial
        Base reducible · 2.318,23 € (43,5% del rend neto)
        Justificación · obras de rehabilitación 2022-2023 (Modo III)
        ATLAS detectó automáticamente · R10
        4 métodos evaluados · escogió "días-habitación" (más beneficioso)
        [calculado · R10]
0154  Rendimiento neto reducido                          3.943,75 €
        = 0149 − 0150
        [calculado]
```

### Bloque · Amortización acumulada (vista venta futura)

Tabla acumulación año a año · que se usaría si se vende el inmueble ·

```
Año   Días arrendado   Base amort   3% × días/año   Fuente
2022    ?                ?            ?              ?
2023    ?                ?            ?              ?
2024  366               57.989,36    1.739,68 (en 0132 mixto)  A.xml
2025  estimación        ...          ...            B.calculado
─────────────────────────────────────────────────────────
Total acumulado a 31/12/{año}                       suma €
```

**Fuente** · `amortizacionAcumuladaService` (existe dentro de `gananciaPatrimonialService.calcularAmortizacionAcumulada`).

### Bloque · Alertas R10 visibles

Lista de optimizaciones aplicadas por ATLAS ·

```
✓ R10 · Prorrateo Modo III · método días-habitación
  ATLAS evaluó 4 métodos · escogió "días-habitación"
  Alternativa más cercana · por superficie · 1.280,33 € reducción
  Beneficio R10 · +110,61 € respecto a alternativa

✓ Detección automática · % reducción 60%
  ATLAS detectó obras de rehabilitación 2022-2023 en mejoras
  Aplicó 60% (no 50% por defecto)
  Beneficio · +X € respecto a aplicar 50%

✓ Aplicación máxima arrastres entrantes
  ATLAS aplicó 6.157,99 € (100% del disponible)
  Saldo restante · 0 €

i  Nada más optimizable este año
```

---

## §4 · F4 · Venta inmueble en ejercicio `/fiscal/ejercicio/{año}/venta/{ventaId}`

> **Caso T48 en 2025**. Cuando un inmueble se ha vendido · esta pantalla cierra el círculo fiscal.

### Header

| Bloque | Dato |
|---|---|
| Breadcrumb · Fiscal > 2025 > T48 (venta) | navegación |
| Título "Venta · Tenderina 48 · 18/11/2025" + pill "Confirmada" | `propertySales` |
| Subtítulo · "Comprada 23/09/2022 · vendida 3 años después" | calculado |
| Botón "Ver registro de venta completo" | navegación a `VentaWizard` modo lectura |
| Botón "Recalcular plusvalía" | recalcula con datos actualizados |

### KPI strip · 4 tarjetas

| KPI | Valor | Hint |
|---|---|---|
| **1 · Valor transmisión (0316)** | 185.000 − gastos venta | "tras gastos venta" |
| **2 · Valor adquisición actualizado (0317)** | original + mejoras − amortizaciones | "menos amort acumulada" |
| **3 · Ganancia tributable (tras compensaciones)** | ej "10.481 €" | "tras aplicar arrastres" |
| **4 · Impuesto estimado** | ej "2.081 €" | "tipo ahorro · tramos 2025" |

### Bloque · Cálculo paso a paso

```
VALOR TRANSMISIÓN (casilla 0316)
+ Precio venta escritura                           185.000,00 €
− Gastos venta deducibles
    ▸ Notaría venta                                    -X,XX €
    ▸ Plusvalía municipal                              -X,XX €
    ▸ Cancelación hipoteca                             -X,XX €
    ▸ Agencia inmobiliaria                             -X,XX €
─────────────────────────────────────────────
= Valor transmisión                                       X €

VALOR ADQUISICIÓN ACTUALIZADO (casilla 0317)
+ Precio compra                                     139.000,00 €
+ Gastos inherentes adquisición                      12.380,36 €
+ Mejoras realizadas durante tenencia                       0 €
− Amortizaciones acumuladas
    ▸ Inmueble (3% × días arrendado)
        2022 (99 días)                                 ~470 €
        2023 (365 días)                              ~1.730 €
        2024 (366 días · declarado)                   1.893 €
        2025 (322 días hasta venta)                  ~1.534 €
        ───────────────────────────────
        Subtotal inmueble                            ~5.627 €
    ▸ Mobiliario (10% × días arrendado · 10 años)
        Subtotal mobiliario                            ~XXX €
    Total amortizaciones acumuladas                  ~5.970 €
─────────────────────────────────────────────
= Valor adquisición actualizado                       145.410 €

GANANCIA BRUTA (casilla 0320)
= Valor transmisión − Valor adquisición actualizado    ~39.590 €

REDUCCIÓN ABATIMIENTO DT 9ª (casilla 0322)
NO APLICA · fecha compra 23/09/2022 (post-1995)            0 €

GANANCIA REDUCIDA (casilla 0325)
= Ganancia bruta − Abatimiento                         ~39.590 €

COMPENSACIONES (R10 · FIFO arrastres más antiguos)
− Saldo 2022 pendiente (caduca 31/12/2026)            -1.345 €
− Saldo 2023 pendiente (caduca 31/12/2027)           -27.764 €
─────────────────────────────────────────────
= Ganancia tributable                                 ~10.481 €

IMPUESTO ESTIMADO · tramos ahorro 2025
0 - 6.000 € × 19%                                     1.140,00 €
6.000 - 10.481 € × 21%                                  941,01 €
─────────────────────────────────────────────
= Impuesto estimado                                    ~2.081 €
```

### Bloque · Alertas R10

```
✓ R10 · Aplicación FIFO de arrastres pendientes
  ATLAS aplicó primero saldo 2022 (caduca antes)
  Si hubieras aplicado primero saldo 2023 · perderías 1.345 € por caducidad
  Beneficio · +282 € impuesto evitado

⚠ Falta confirmar gastos de venta
  No has introducido notaría · plusvalía municipal · cancelación hipoteca
  Si tienes esas facturas · podrías reducir más impuesto
  Ejemplo · 3.000 € de gastos venta → -630 € impuesto
  → Añadir gastos de venta
```

### Bloque · Datos amortización acumulada con huecos

Vista de los años de tenencia · indicando huecos donde ATLAS asume regla mínima ·

```
2022 (parcial 23/09 - 31/12 · 99 días)   [B.calculado · sin declaración]
   ⚠ ATLAS asume días arrendado · revisa
2023 (año completo)                      [A.xml · declarado]
   ✓ Datos AEAT
2024 (año completo)                      [A.xml · declarado]
   ✓ Datos AEAT
2025 (hasta venta 18/11)                 [B.calculado · pendiente declarar]
```

**Fuente** · `gananciaPatrimonialService.calcularGananciaPatrimonial` (existe) · necesita extensión para mostrar desglose visible.

---

## §5 · F5 · Calendario obligaciones `/fiscal/calendario`

> Vista 6 años · gestión activa de obligaciones · alertas tempranas.

### Header

| Bloque | Dato |
|---|---|
| Título "Calendario fiscal" | |
| Subtítulo · "X cumplidas · Y pendientes · Z vencidas · W con deuda · 6 años" | counts |
| Filtro por modelo · "Todos · 100 · 303 · 130 · 184" | tabs |
| Filtro por estado · "Todos · Pendientes · Vencidas · Con deuda" | tabs |
| Vista (toggle) · "Timeline · Lista" | toggle |

### Tab Timeline (default)

Vista 6 años · barras por obligación · idéntica al Tab 1 de F1 pero a pantalla completa con filtros.

### Tab Lista

Tabla cronológica · una fila por obligación ·

| Fecha vencimiento | Modelo | Concepto | Año/Periodo | Importe | Estado | Acción |
|---|---|---|---|---|---|---|
| 22/04/2026 | 303 | IVA | 1T-2026 | 1.260 € (est.) | Pendiente | Pagar → |
| 22/04/2026 | 130 | IRPF fraccionado | 1T-2026 | XX € (est.) | Pendiente | Pagar → |
| 30/06/2026 | 100 | IRPF anual | 2025 | +4.180 € devolver (est.) | Pendiente | Borrador → |
| 30/06/2025 | 100 | IRPF anual | 2024 | +2.899,75 € pagado | Cumplida | Ver → |
| 23/11/2024 | 303 | IVA 3T-2024 | 977,70 € | Ejecutivo 5% | Pagar deuda → |

### Drawer deuda (al clickear "Pagar deuda")

Detalle de la deuda · principal + recargo + intereses · plazo · pasarela de pago (placeholder · futuro) · histórico notificaciones.

---

## §6 · F6 · Configuración fiscal `/fiscal/configuracion`

> Toda la configuración fiscal · acciones de importación · gestión arrastres.

### Bloques · acordeón vertical

#### Bloque 1 · Perfil fiscal

Resumen + link a Ajustes · "Tu CCAA · Madrid · Tributación individual · Modelos activos · 100 · 303 · 130 · No tienes ascendientes a cargo · Edita perfil →"

#### Bloque 2 · Importar declaración Modelo 100

```
Sube XML DeclaVisor · PDF Modelo 100 · TXT Renta Web · pantalla AEAT
ATLAS extrae casillas automáticamente · marca ejercicio como declarado
[Ejercicio destino · selector]
[Botón · Importar XML / PDF / TXT / Screenshot]

Histórico importaciones
  ▸ 2024 · XML AEAT · 18/03/2026
  ▸ 2023 · XML AEAT · 18/03/2026
  ▸ 2022 · XML AEAT v2 (paralela) · 12/01/2024
```

#### Bloque 3 · Aplicar paralela

```
Si Hacienda te ha enviado liquidación firmada · acta · etc · aplícala aquí
Wizard 5 pasos · ATLAS registra v2 + cascada años posteriores
[Ejercicio · selector]
[Botón · Aplicar paralela]

Histórico paralelas
  ▸ 2022 Carles Buigas base 116.150 → 98.831 · aplicada 12/01/2024
  ▸ 2023 Modelo 130 sanción · aplicada 15/10/2024
```

#### Bloque 4 · Arrastres manuales

```
Si tienes arrastres de años no importados · introdúcelos aquí
Tipo · gastos 0105/0106 · pérdidas patrimoniales · planes pensiones
[Botón · Añadir arrastre manual]

Arrastres registrados
  ▸ ...
```

#### Bloque 5 · Histórico declaraciones

Lista de todas las declaraciones presentadas (todos los modelos) ·

| Fecha | Modelo | Año/Periodo | Importe | Resultado | Acción |
|---|---|---|---|---|---|
| 24/06/2025 | 100 | 2024 | 2.899,75 | Pagado | Ver |
| 22/06/2024 | 100 | 2023 | −2.700,52 | Devuelto | Ver |
| ... | ... | ... | ... | ... | ... |

#### Bloque 6 · Exportar todo

```
Exportar configuración fiscal completa como JSON
Exportar todas las declaraciones como ZIP
[Botón · Exportar]
```

---

## §7 · Servicios consumidos · checklist

Para que las 5 pantallas funcionen · necesitan estos servicios ·

| Servicio | Existe? | Hueco a cubrir |
|---|---|---|
| `fiscalResolverService.getResumenGlobal()` | ⚠️ parcial | Crear método agregado (counts por estado · KPIs globales) |
| `fiscalResolverService.getTimelineMultiAño(min · max)` | ❌ no | Crear método nuevo · agrega obligaciones por año |
| `fiscalResolverService.getDatosEjercicio(año)` | ✅ existe | OK |
| `fiscalResolverService.getTodosLosEjercicios()` | ✅ existe | OK |
| `fiscalSummaryService.calculateFiscalSummary(inmueble · año)` | ⚠️ parcial | Falta extender · casillas 0102 · 0149 · 0150 · 0154 |
| `gananciaPatrimonialService.calcularGananciaPatrimonial` | ✅ existe | OK |
| `gananciaPatrimonialService.calcularAmortizacionAcumulada` | ✅ existe | OK |
| `estimacionFiscalEnCursoService.calcular(año)` | ✅ existe | OK |
| `carryForwardService.getTotalVivo()` | ⚠️ verificar | Si falta · crear |
| `compensacionAhorroService.getDisponibles()` | ✅ existe | OK |
| `alertasFiscalesService` próxima obligación | ⚠️ verificar | |
| `deudasFiscalesService` (nuevo) · gestiona deudas IVA · 130 · 100 con recargos | ❌ no encontrado | **Crear módulo nuevo** · caso Q3-2024 |
| `aeatClassificationService.getExerciseStatus(año)` | ✅ existe | OK |
| `propertyOccupancyService` · días arrendado por inmueble/año | ✅ existe | OK |

**Trabajo de motor pendiente** · 4 huecos · 2 fixes pequeños (extensión `fiscalSummaryService` · método timeline en resolver) + 1 servicio nuevo (`deudasFiscalesService`) + 1 verificación (alertas/carryForward).

---

## §8 · Resumen de qué decisiones necesito de ti

| # | Decisión | Opciones |
|---|---|---|
| 1 | ¿La estructura general de 5 pantallas + 1 sub-pantalla F4 te encaja? | A · sí · B · falta una · C · sobra alguna · D · diferente |
| 2 | F1 · 5 KPIs en strip · ¿correcto número o quieres más/menos? | número y cuáles |
| 3 | F2 · sección por sección (A trabajo · B inmuebles · C ahorro · D actividad · E ganancias · F pensiones · G base · H cuotas) ¿completo o falta? | confirma o añade |
| 4 | F3 · detalle por inmueble con TODAS las casillas mapa v3 · ¿demasiado denso o necesario? | denso pero necesario · simplificar |
| 5 | F4 · pantalla venta separada ¿o integrar en F2 dentro de sección E? | separada · integrada |
| 6 | F5 · calendario con timeline + tabla ¿está bien o falta vista? | bien · falta X |
| 7 | F6 · 6 bloques acordeón ¿correcto orden y contenido? | confirma |
| 8 | ¿Crear `deudasFiscalesService` desde 0 o esperar? | crear ya · esperar |
| 9 | ¿Empezar mockup F1 (dashboard) o F2 (ejercicio detalle · más crítico)? | F1 · F2 |

---

**Fin de propuesta arquitectura · espera tus marcas para iterar.**
