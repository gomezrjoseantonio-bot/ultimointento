# Gestión delegada por agencias · Diseño V1.2

> Estado: **propuesta de diseño** (no implementado). Documento de referencia
> antes de tocar código. Objetivo: modelar la gestión de alquileres a través de
> una agencia/empresa —incluida la **renta garantizada**— sin reescribir el
> modelo cuando cambie la forma de cobrar de cada agencia.
>
> **V1.1 · decisiones cerradas con el propietario:**
> - **Un contrato de gestión por piso** (aunque la agencia sea la misma en varios
>   pisos). Cada contrato = un acuerdo. Se hacen tantos como pisos. → **Opción A**:
>   el acuerdo se materializa como un `Contract` con un bloque `gestion`, no como
>   store aparte.
> - **Requisito núcleo (no negociable):** los contratos de los inquilinos se
>   **anexan** a su contrato de gestión (relación padre→hijo por `id`), y **la
>   facturación fiscal ES la suma de esos subcontratos anexados**. Ver §4.4 y §5.1.
> - **El contrato de gestión (padre) NO es LAU** (duración libre, sin reducción
>   fiscal); los subcontratos de inquilinos **sí** (LAU + reducciones). Los
>   subcontratos se anexan **en cualquier momento**, no en un volcado anual. Ver §4.5.

## 1. Problema

Un piso puede gestionarse de varias formas. Además de la autogestión (yo firmo y
cobro directamente), el propietario puede **delegar la gestión en una empresa**.
La casuística real que hay que soportar:

- **Renta garantizada**: la agencia me paga un importe fijo todos los meses
  (p.ej. Fuertes Acevedo 32 = 1.350 €), **suba o baje la ocupación real**. Ellos
  subarriendan por habitaciones al precio que quieren y firman los contratos en
  mi nombre. **No conozco los subcontratos hasta fin de año**, cuando la agencia
  me pasa el detalle para declararlos.
- **Por porcentaje**: la agencia gestiona y me cobra un **% de comisión**; aquí
  **sí conozco los contratos de los inquilinos desde el primer momento** y las
  rentas reales me llegan (menos la comisión).
- La renta garantizada **también se indexa por IPC** (la agencia es una empresa;
  el importe garantizado sube cada año).
- Una misma agencia puede gestionarme **varios pisos**.
- Una agencia puede cobrar **combinaciones** de honorarios: % sobre renta, fee
  fijo por habitación, honorario de captación por inquilino nuevo, fee fijo de
  gestión, etc.

El riesgo a evitar: mezclar dos "verdades" que ocurren en tiempos distintos
(**la caja mensual cierta** vs **la facturación fiscal diferida**) e inflar los
KPIs operativos con datos que no toca (como pasó con la ocupación al 120 %).

## 2. Principio rector: dos capas que NO se mezclan

| | **Capa 1 · Operativa / Tesorería** | **Capa 2 · Fiscal** |
|---|---|---|
| Qué es | Lo que cobras/pagas mes a mes | Lo que declaras a Hacienda |
| Cuándo se conoce | Ya (cierto y recurrente) | Diferido (fin de año, en garantizada) |
| Alimenta | Tesorería, ocupación, KPIs banda navy | Módulo Fiscal (IRPF) |
| Fuente de verdad | `treasuryEvents` (contrato de gestión) | subcontratos anexados (`gestionPadreId`) + gastos `'gestion'` |

Regla de oro: **el operativo del día a día nunca depende de información que no
tienes hasta enero**. En renta garantizada, el operativo es el importe fijo; los
subcontratos son Capa 2 y solo afectan al módulo Fiscal.

## 3. Arquitectura de entidades (fijada)

Revisado el esquema real de IndexedDB para no duplicar ni confundir stores:

| Concepto | Store | ¿Nuevo? |
|---|---|---|
| **Agencia gestora** | `proveedores` (`Proveedor`, clave `nif`, `tipos` incluye `'gestion'`) | **No** |
| **Contrato de gestión** (acuerdo, 1 por piso) | `contracts` + bloque `gestion` opcional | Campo opcional |
| **Subcontratos de inquilinos anexados** | `contracts` + campo `gestionPadreId` | Campo opcional |
| Honorarios de la agencia | bloque `gestion.honorarios[]` | Campo opcional |
| Renta garantizada / rentas de inquilinos | `contracts` + `treasuryEvents` | No |
| Comisión / fees (gastos) | gasto `'gestion'` (`OperacionProveedor` / opex) | No |
| Atribución de rentas en copropiedad | `entidadesAtribucion` — **NO se toca** | No |

> **Opción A (decidida)**: no se crea store nuevo. El acuerdo es un `Contract` con
> un bloque `gestion` opcional (sin bump de `DB_VERSION`, backfill suave como los
> campos opcionales previos). Si en el futuro un acuerdo multi-piso necesita
> lifecycle propio, se promueve a store sin perder datos.

Aclaraciones críticas:

- **`proveedores` ≠ `entidadesAtribucion`.** `Proveedor` es a quien pagas un
  servicio. `EntidadAtribucionRentas` (`CB`/`SC`/`HY`) es un vehículo **fiscal**
  de copropiedad por el que *tú* recibes rentas en IRPF. La agencia va en
  `proveedores`; `entidadesAtribucion` no se mezcla en esto.
- La agencia guarda solo **identidad** (NIF/CIF, nombre, `tipos`). La **dirección
  del dinero** (te ingresa la garantizada / te cobra honorarios) la decide el
  acuerdo, no el `Proveedor`. Por eso un único `Proveedor` sirve para ambas
  direcciones.

## 4. Modelo de datos

### 4.1. Dos ejes independientes

**Eje A · `modeloIngreso`** — cómo me llega el ingreso:

- `garantizada` — la agencia me paga una renta fija (+ IPC). No conozco los
  subcontratos hasta fin de año.
- `traspaso` — me llega la renta real de los inquilinos; conozco los contratos
  desde el inicio.

**Eje B · `honorarios[]`** — qué me cobra la agencia. Es una **lista componible**
(no un valor único), de modo que cualquier combinación = suma de líneas.

### 4.2. Tipos propuestos

```ts
/** Una línea del esquema de honorarios de una agencia. Componible: la
 *  factura de la agencia = suma de las líneas aplicables. */
export interface HonorarioAgencia {
  concepto:
    | 'comision_renta'   // % sobre la renta cobrada
    | 'fee_habitacion'   // importe por habitación
    | 'fee_fijo'         // importe fijo por periodo
    | 'captacion'        // honorario por encontrar inquilino (one-off)
    | 'otro';
  calculo: 'porcentaje' | 'importe';
  /** Sobre qué se aplica `valor`. */
  base: 'renta_mensual' | 'habitacion' | 'mensualidad' | 'fijo';
  /** % (si calculo='porcentaje') o € (si calculo='importe'). */
  valor: number;
  /** Recurrente (mensual/anual) o puntual por evento. */
  periodicidad: 'mensual' | 'anual' | 'por_inquilino_nuevo';
  nota?: string;
}

/** Bloque de gestión delegada · va DENTRO de `Contract` (Opción A). Presente
 *  solo en el contrato de gestión (padre), 1 por piso. Su ausencia = contrato
 *  normal (autogestión).
 *
 *  El padre es NO-LAU: duración libre (fechaFin = plazo pactado, sin +5 auto),
 *  sin modalidad LAU efectiva y sin reducción fiscal (§4.5). La reducción LAU
 *  vive en los subcontratos hijos. */
export interface GestionDelegada {
  /** NIF/CIF del `Proveedor` (agencia). */
  agenciaNif: string;
  modeloIngreso: 'garantizada' | 'traspaso';
  /** Solo si modeloIngreso === 'garantizada'. La renta fija va en
   *  `Contract.rentaMensual` + `indexacion` (reusa el motor existente). */
  rentaGarantizada?: number;
  honorarios: HonorarioAgencia[];          // default []
}

// Campos que se AÑADEN a la interfaz `Contract` existente (todos opcionales):
//
//   gestion?: GestionDelegada;
//       · Presente → este Contract es el CONTRATO DE GESTIÓN (padre) del piso.
//         Contraparte = agencia. En 'garantizada', rentaMensual = renta fija.
//         Es el operativo (Tesorería + ocupación).
//
//   gestionPadreId?: number;
//       · Presente → este Contract es un SUBCONTRATO de inquilino ANEXADO al
//         contrato de gestión cuyo `id` es `gestionPadreId`. Es fiscal:
//         NO cuenta en operativo ni ocupación. Su renta suma a la facturación
//         del padre. Ver §4.4.
```

**Un contrato es de gestión, o es un subcontrato anexado, o es normal — nunca
dos a la vez.** `gestion` y `gestionPadreId` son mutuamente excluyentes.

### 4.3. Cobertura de la casuística (sin reescribir)

| Lo que cobra/paga la agencia | Representación |
|---|---|
| **% sobre la renta** | `{concepto:'comision_renta', calculo:'porcentaje', base:'renta_mensual', valor:10, periodicidad:'mensual'}` |
| **Fee por habitación** | `{concepto:'fee_habitacion', calculo:'importe', base:'habitacion', valor:50, periodicidad:'mensual'}` |
| **Captación (búsqueda de inquilino)** | `{concepto:'captacion', calculo:'importe', base:'fijo', valor:300, periodicidad:'por_inquilino_nuevo'}` — o `calculo:'porcentaje', base:'mensualidad', valor:100` = "una mensualidad" |
| **Fee fijo de gestión** | `{concepto:'fee_fijo', calculo:'importe', base:'fijo', valor:80, periodicidad:'mensual'}` |
| **Renta garantizada pura** | `modeloIngreso:'garantizada'`, `honorarios:[]` — la comisión es implícita (Σ subcontratos − garantizado, se deriva a fin de año) |
| **Garantizada + captación** | `modeloIngreso:'garantizada'` + una línea `captacion` |
| **Traspaso + % + fee/habitación** | `modeloIngreso:'traspaso'` + líneas `comision_renta` y `fee_habitacion` |

### 4.4. Anexado de subcontratos y facturación (requisito núcleo)

Esta es la parte que debe quedar **meridianamente clara**, sin excusas después:

- **Cada contrato de inquilino se ANEXA a su contrato de gestión** por `id`:
  el subcontrato lleva `gestionPadreId = <id del contrato de gestión del piso>`.
  Un piso → un contrato de gestión (padre) → N subcontratos de inquilinos (hijos).
- **La facturación es, por definición, la suma de los subcontratos anexados**
  a ese padre, por ejercicio:

  ```
  facturación(padre, año) = Σ rentaAnual(hijo)  para todo hijo con
                              gestionPadreId === padre.id  y solape con `año`
  ```

- De la facturación se deriva todo lo fiscal, sin números sueltos:

  ```
  Ingresos íntegros (IRPF, por piso·año) = facturación(padre, año)
  Comisión agencia (gasto deducible)     = facturación(padre, año)
                                            − (rentaGarantizada × meses cobrados)
  ```

- **Trazabilidad garantizada por construcción**: no existe "facturación" que no
  sea la suma de subcontratos anexados a un padre. No hay cifra fiscal anónima:
  si hay ingreso declarado, hay subcontratos anexados que lo justifican, y si
  falta anexar, la facturación de ese piso está incompleta y se marca como tal.
- Los subcontratos se pueden anexar **individualmente** (cada contrato de
  habitación) o de forma **agregada** (un subcontrato-resumen anual por piso si la
  agencia solo da el total) — en ambos casos van con `gestionPadreId` y suman a la
  facturación del padre. El modelo no obliga al detalle por habitación, pero **sí
  obliga al anexado**.
- **Invariante operativo**: un subcontrato (`gestionPadreId` presente) queda
  excluido de vigentes/ocupación/renta prevista igual que hoy se excluyen
  `sin_identificar` y `sin_firmar`. El operativo del piso es SIEMPRE el contrato
  de gestión padre.
- **Anexado en cualquier momento**: los subcontratos se anexan cuando llegan
  (cada día, cada trimestre, a fin de año) — NO es un volcado anual único. La
  facturación del padre se recalcula de forma incremental y queda **"en curso"**
  hasta que se cierra el ejercicio; el dato parcial es un estado válido, no un
  error.

### 4.5. LAU y afectación fiscal · padre ≠ hijos

Distinción que debe respetarse en tipos y en lógica:

- **Contrato de gestión (padre) · NO-LAU.** Es un contrato mercantil con la
  agencia, de **duración libre** (1…N años, lo que se pacte). **No aplica** nada
  de LAU:
  - Sin cálculo automático de `fechaFin` (+5 años de habitual): `fechaFin` = plazo
    pactado con la agencia, tal cual.
  - Sin `modalidad` LAU (habitual/temporada/vacacional) con sus semánticas.
  - **Sin reducción fiscal** (`reduccion`, `zonaTensionada`, Ley 12/2023): el padre
    no genera por sí mismo rendimiento de capital inmobiliario con reducción.
  - La presencia del bloque `gestion` es lo que marca "no-LAU"; la lógica LAU
    (auto fechaFin, reducción) se salta cuando `gestion` está presente.
    *(Impl. fase 1: valorar un valor `modalidad: 'gestion'` o gating por `gestion`.)*
- **Subcontratos de inquilinos (hijos) · SÍ-LAU.** Aquí está la **afectación
  fiscal real**. Cada hijo lleva su `modalidad`, `reduccion` (Ley 12/2023),
  `zonaTensionada`, etc., y la **reducción se aplica a nivel de cada subcontrato**
  (es el arrendamiento de vivienda real). Su `rentaAnual` suma a la facturación
  del padre (§4.4), y sobre ese rendimiento operan las reducciones por hijo.

Resumen: **el padre es caja + agregador; los hijos son la sustancia fiscal (LAU +
reducciones).**

## 5. Flujos por modo

### 5.1. Renta garantizada

- **Operativo (Capa 1)**: el **contrato de gestión (padre)** genera el ingreso
  garantizado como cobro recurrente en `treasuryEvents` (importe =
  `rentaMensual` = renta garantizada, contraparte = agencia). Sube por IPC cada
  año igual que la indexación de un contrato normal.
  - **Ocupación**: la unidad cuenta como **ocupada al 100 %** mientras el contrato
    de gestión esté vigente, aunque una habitación esté vacía (cobras igual). La
    vacancia real es riesgo de la agencia, no ensucia tus KPIs.
  - Los **subcontratos de inquilinos NO cuentan en Capa 1**: aunque existan como
    `contracts` (anexados por `gestionPadreId`), quedan excluidos de la banda navy.
- **Fiscal (Capa 2)**: los subcontratos se **anexan al padre** (`gestionPadreId`),
  normalmente a fin de año cuando la agencia da el detalle. La **facturación =
  suma de los subcontratos anexados** (§4.4), y de ahí se deriva la comisión:

  ```
  Ingresos íntegros (IRPF)                      = facturación(padre, año) = Σ subcontratos anexados
  Comisión agencia (gasto deducible 'gestion')  = facturación(padre, año) − (rentaGarantizada × meses cobrados)
  Neto fiscal                                   ≈ rentaGarantizada × meses
  ```

  > Caso borde: si Σ subcontratos < garantizado×meses (la agencia asumió pérdida),
  > la "comisión" sería negativa. Se trata como **0 € de comisión** y se marca un
  > aviso para revisar con el asesor; no se inventa un ingreso extra automáticamente.

### 5.2. Por porcentaje (traspaso)

- **Operativo (Capa 1)**: los **contratos de inquilinos son normales** (se
  conocen desde el inicio, fluyen a Tesorería y cuentan ocupación como hoy).
- **Honorarios**: las líneas de `honorarios[]` generan **gastos** en Tesorería
  (recurrentes las `mensual`/`anual`; puntuales las `por_inquilino_nuevo`,
  disparadas al firmar un contrato de inquilino nuevo), categoría `'gestion'`,
  deducibles vía `OperacionProveedor`/opex.
- No usa el bote: aquí la información fiscal ya está completa en los contratos.

## 6. Impacto en UI

- **Wizard de contrato / ficha de inmueble**: selector de **modo de gestión**
  (`autogestión` | `delegada · garantizada` | `delegada · %`). Al elegir
  delegada: seleccionar/crear agencia (`Proveedor`), y según el modo pedir
  `rentaGarantizada` + IPC + cuenta, o el esquema de `honorarios[]`.
- **Banda de KPIs (ContratosTopHero)**: sin cambios de fórmula. La renta
  garantizada entra como cobro previsto y la unidad cuenta ocupada; los
  subcontratos garantizados no entran (Capa 2). Igual que ya excluimos
  `sin_identificar` y `sin_firmar`.
- **Ficha de inmueble**: bloque "Gestión" mostrando agencia, modo, renta
  garantizada/IPC u honorarios vigentes, y (en garantizada) los **subcontratos
  anexados** + facturación acumulada + comisión estimada.
- **Anexar subcontratos**: acción desde el contrato de gestión para vincular
  contratos de inquilinos (individuales o resumen anual), fijando
  `gestionPadreId`. La facturación del padre se recalcula al anexar.
- **Fiscal**: la comisión derivada aparece como gasto deducible `'gestion'`; los
  ingresos íntegros = facturación (Σ subcontratos anexados en garantizada) o los
  contratos directos (%).

## 7. Plan de implementación (PRs pequeñas, en orden)

1. **Capa 1 · renta garantizada (MVP)** — bloque `gestion` opcional en `Contract`
   (solo `garantizada`), alta de agencia como `Proveedor`, cobro recurrente de la
   garantizada en Tesorería con IPC, y ocupación contando la unidad. *Valor
   inmediato: cuadra Fuertes Acevedo 32.*
2. **Anexado de subcontratos + facturación** — campo `gestionPadreId`, acción de
   anexar, cálculo `facturación(padre, año) = Σ subcontratos`, y exclusión de los
   hijos del operativo. *Es el requisito núcleo (§4.4).*
3. **Comisión derivada + Fiscal (garantizada)** — `facturación − garantizado×meses`
   como gasto `'gestion'`, ingresos íntegros = facturación, integración IRPF.
4. **Modo por %** — `modeloIngreso:'traspaso'` + `honorarios[]` recurrentes como
   gasto `'gestion'`; se apoya casi todo en lo existente.
5. **Honorarios puntuales** — `periodicidad:'por_inquilino_nuevo'` (captación),
   disparados al firmar contrato de inquilino.

## 8. Invariantes / no-objetivos

- No se toca `DB_VERSION` salvo para crear el store del acuerdo (evaluar si se
  puede embeber en `contracts`/`properties` como bloque opcional para evitar el
  bump; decisión de la fase 1).
- No se crea un segundo Tesorería ni un segundo store de proveedores.
- `entidadesAtribucion` no se modifica.
- Sin `any`/`as any` nuevos; tokens ATLAS v5; CSS Modules; tests por fase; sin
  auto-merge.
