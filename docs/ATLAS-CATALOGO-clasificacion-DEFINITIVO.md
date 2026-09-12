# ATLAS · CATÁLOGO DE CLASIFICACIÓN · DEFINITIVO

**Fuente única del catálogo de clasificación de movimientos.** Decisión de Jose · E2.4.1 (5 de septiembre de 2026).
El código que lo implementa es `src/services/catalogo/catalogoUnico.ts`; si el código y esto no coinciden, lo que
está mal es el código.

> Nota de procedencia: este fichero se reconstruye del enunciado de E2.4.1, que traía el árbol entero. Jose confirmó
> (5 sep 2026) que coincide con su DEFINITIVO. Las referencias «MODELO §32.29-32.40» apuntan al documento del modelo,
> que no está en el repo; cuando se suba, manda el MODELO.

---

## Principios

1. **UN solo catálogo.** Crear = etiquetar = reclasificar. No hay dos árboles.
2. **Cuatro ejes independientes.** Nunca uno dentro de otro:
   - **NATURALEZA** · `ingreso | gasto | movimiento_interno`
   - **CATEGORÍA** · familia + subtipo (el árbol de abajo)
   - **MÉTODO DE PAGO** · `transferencia | bizum | domiciliacion | tarjeta | efectivo | cheque | cargo_abono_banco`
   - **ÁMBITO** · `personal | inmueble` (+ `inmuebleId`) · **minúsculas, un solo casing**. NO agrupa las familias; se
     decide por movimiento.
3. **FISCALIDAD FUERA.** El catálogo NO lleva casilla AEAT ni deducibilidad. Es una lente aparte que lee familia +
   subtipo + contexto (E2.4.1c).
4. **Subtipo OPCIONAL.** El segundo nivel nunca obliga.
5. **Lista PLANA.** Las familias no se agrupan por ámbito.
6. **Eventos** (nómina · venta · préstamo · dividendo): el catálogo tiene la etiqueta para poder reclasificar, pero esos
   movimientos los pone el evento/módulo que los origina. La cuota de préstamo se etiqueta ENTERA como
   `prestamo_hipoteca`; NO se parte interés/capital (eso lo da el cuadro del préstamo, fuera de aquí).
7. **Bolsa 50/30/20: no existe.** Se retira del árbol viejo y no se sustituye (decisión Jose · 5 sep 2026). Si algún día
   hiciera falta presupuesto, será lente derivada de la familia, no dato guardado.

---

## NATURALEZA = INGRESO · 8 familias

| familia | subtipos |
|---|---|
| `nomina` | — |
| `pension` | — |
| `autonomo` | — |
| `alquiler` | — (el tipo larga/corta/habitación/turístico vive en el CONTRATO) |
| `rendimiento` | `interes` / `dividendo` / `rendimiento_inversion` |
| `venta` | `inmueble` / `acciones` / `fondos` / `criptomonedas` (subtipo = tipos de activo de `inversiones` + inmueble) |
| `inversion` | subtipo = `TipoPosicion` del store (`prestamo_p2p` / `deposito_plazo` / `cuenta_remunerada` / …) · **añadida 12 sep 2026** (E2.4.2-fix2b): lo que una posición devuelve ENTERO (cuota de préstamo concedido = capital + interés − retención; depósito que vence). Un ingreso, uno solo; el desglose vive en el pago de la posición (§32.33 en espejo). Un interés solo sigue siendo `rendimiento · interes` |
| `otros_ingresos` | — |

## NATURALEZA = GASTO · 22 familias · lista plana

| familia | subtipos (opcionales) |
|---|---|
| `comunidad` | `cuota_mensual` / `derrama` / `otros` |
| `suministro` | `luz` / `agua` / `gas` / `internet` / `telefonia` / `otros` |
| `seguros_alarmas` | `hogar` / `vida` / `decesos` / `vehiculo` / `salud` / `impago` / `alarma` / `otros` |
| `impuestos_tasas` | `ibi` / `basuras` / `circulacion` / `licencia_turistica` / `otros_tributos` |
| `reparacion_mantenimiento` | `caldera` / `electrodomesticos` / `vehiculo` / `itv` / `otros` |
| `reforma_mejora` | — (SIN subtipo) |
| `alquiler_renting` | `vivienda` / `vehiculo` |
| `gestion` | `gestoria` / `asesoria` / `abogado` / `comision_plataformas` / `otros` |
| `limpieza` | `zonas_comunes` / `integral` / `por_estancia` / `lavanderia` / `otros` |
| `mobiliario_enseres` | `muebles` / `ropa_cama_enseres` / `electrodomesticos` / `otros` |
| `prestamo_hipoteca` | — (cargo entero; interés/capital lo da el cuadro del préstamo) |
| `supermercado` | — |
| `ocio` | `viajes` / `restaurante` / `cine_planes` / `otros` |
| `transporte` | `combustible` / `parking` / `peajes` / `transporte_publico` / `taxi_vtc` / `otros` |
| `cuidado_personal` | `ropa` / `calzado` / `peluqueria` / `farmacia` / `medico` |
| `suscripciones` | `streaming` / `musica` / `software` / `cloud` / `prensa` / `gimnasio` / `ong` / `otros` |
| `educacion_formacion` | `colegio` / `universidad` / `cursos` / `formacion_profesional` / `otros` |
| `comisiones_bancarias` | `mantenimiento` / `transferencia` / `otros` |
| `multas` | `trafico` / `otras` |
| `compra_online` | — (bazares opacos: Amazon / Shein / AliExpress) |
| `cuota_reta` | — (cuota de autónomos a la Seguridad Social · Jose · 11 sep 2026 · su regularización, la TGSS en positivo, es la devolución de esta familia: §7, resta) |
| `otros` | — (cajón) |

## NATURALEZA = MOVIMIENTO INTERNO · 4 familias

Es movimiento de caja REAL (afecta al saldo de la cuenta) pero NEUTRO en patrimonio. En la vista de cuenta cuenta para
el saldo; en «cuánto gané / cuánto gasté» NO cuenta.

| familia | subtipos |
|---|---|
| `traspaso` | `a_otra_cuenta` / `a_tarjeta` / `a_efectivo` / `a_ahorro` |
| `aportacion` | `plan_pensiones` / `inversion` / `fondo` |
| `disposicion_prestamo` | — |
| `fianza` | `entra` / `custodia` / `devuelve` |

---

## Decisiones asociadas (Jose · 5 sep 2026)

- **Préstamos (E2.4.1b):** el antiguo `TreasuryEvent.type = 'financing'` desaparece como naturaleza. La **disposición**
  del préstamo es `movimiento_interno · disposicion_prestamo`; la **cuota** es `gasto · prestamo_hipoteca` (cargo entero,
  sin partir interés/capital).
- **Casilla AEAT (E2.4.1c):** el enganche categoría→casilla se retira; el gasto de inmueble se guarda sin casilla y la
  lente fiscal se la asigna leyendo familia + contexto. Debe estar hecha antes de la primera declaración real.
- **Bolsa 50/30/20:** eliminada (ver principio 7).
