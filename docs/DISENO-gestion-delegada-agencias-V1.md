# Gestión delegada por agencias · Diseño V1

> Estado: **propuesta de diseño** (no implementado). Documento de referencia
> antes de tocar código. Objetivo: modelar la gestión de alquileres a través de
> una agencia/empresa —incluida la **renta garantizada**— sin reescribir el
> modelo cuando cambie la forma de cobrar de cada agencia.

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
| Fuente de verdad | `treasuryEvents` | `botesAnualesSinIdentificar` + gastos `'gestion'` |

Regla de oro: **el operativo del día a día nunca depende de información que no
tienes hasta enero**. En renta garantizada, el operativo es el importe fijo; los
subcontratos son Capa 2 y solo afectan al módulo Fiscal.

## 3. Arquitectura de entidades (fijada)

Revisado el esquema real de IndexedDB para no duplicar ni confundir stores:

| Concepto | Store | ¿Nuevo? |
|---|---|---|
| **Agencia gestora** | `proveedores` (`Proveedor`, clave `nif`, `tipos` incluye `'gestion'`) | **No** |
| **Acuerdo de gestión + honorarios[]** | nuevo — referencia al proveedor por `nif` | **Sí (única pieza nueva)** |
| Renta garantizada / rentas de inquilinos | `contracts` + `treasuryEvents` | No |
| Comisión / fees (gastos) | gasto `'gestion'` (`OperacionProveedor` / opex) | No |
| Suma fiscal anual (garantizada) | `botesAnualesSinIdentificar` | No |
| Atribución de rentas en copropiedad | `entidadesAtribucion` — **NO se toca** | No |

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

/** Acuerdo de gestión entre el propietario y una agencia para un inmueble.
 *  Única entidad nueva. Referencia al proveedor por su NIF. */
export interface AcuerdoGestion {
  id?: number;
  inmuebleId: number;
  /** NIF/CIF del `Proveedor` (agencia). */
  agenciaNif: string;
  modeloIngreso: 'garantizada' | 'traspaso';

  // Solo si modeloIngreso === 'garantizada':
  rentaGarantizada?: number;              // importe fijo mensual (€)
  indexacion?: 'none' | 'ipc' | 'irav' | 'otros';
  diaPago?: number;                        // día de cobro de la garantizada
  cuentaCobroId?: number;                  // cuenta donde entra la garantizada

  honorarios: HonorarioAgencia[];          // default []
  fechaInicio: string;                     // ISO
  fechaFin?: string;                       // ISO · vacío = indefinido
  estado: 'activo' | 'finalizado';
  createdAt: string;
  updatedAt: string;
}
```

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

## 5. Flujos por modo

### 5.1. Renta garantizada

- **Operativo (Capa 1)**: se crea/gestiona el ingreso garantizado como un cobro
  recurrente en `treasuryEvents` (importe = `rentaGarantizada`, día = `diaPago`,
  cuenta = `cuentaCobroId`, contraparte = agencia). Sube por IPC cada año igual
  que la indexación de un contrato normal.
  - **Ocupación**: la unidad cuenta como **ocupada al 100 %** mientras el acuerdo
    esté `activo`, aunque una habitación esté vacía (cobras igual). La vacancia
    real es riesgo de la agencia, no ensucia tus KPIs.
  - Los **subcontratos NO existen en Capa 1** → no se crean como `contracts`
    operativos ni cuentan en la banda navy.
- **Fiscal (Capa 2)**: a fin de año se registra/importa la **suma anual por
  inmueble** en `botesAnualesSinIdentificar` (importe declarado a Hacienda). De
  ahí se deriva la comisión:

  ```
  Comisión agencia (gasto deducible 'gestion') = Σ subcontratos − (rentaGarantizada × meses cobrados)
  Ingresos íntegros (IRPF)                      = Σ subcontratos
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
  garantizada/IPC u honorarios vigentes, y (en garantizada) el estado del bote
  anual + comisión estimada.
- **Fiscal**: la comisión derivada aparece como gasto deducible `'gestion'`; los
  ingresos íntegros salen del bote (garantizada) o de los contratos (%).

## 7. Plan de implementación (PRs pequeñas, en orden)

1. **Capa 1 · renta garantizada (MVP)** — tipo `AcuerdoGestion` (solo
   `garantizada`), alta de agencia como `Proveedor`, cobro recurrente de la
   garantizada en Tesorería con IPC, y ocupación contando la unidad. *Valor
   inmediato: cuadra Fuertes Acevedo 32.*
2. **Modo por %** — `modeloIngreso:'traspaso'` + `honorarios[]` recurrentes como
   gasto `'gestion'`; se apoya casi todo en lo existente.
3. **Honorarios puntuales** — `periodicidad:'por_inquilino_nuevo'` (captación),
   disparados al firmar contrato de inquilino.
4. **Capa 2 · fiscal (garantizada)** — registro/importación de la suma anual en
   el bote + cálculo derivado de la comisión + integración en el módulo Fiscal.

## 8. Invariantes / no-objetivos

- No se toca `DB_VERSION` salvo para crear el store del acuerdo (evaluar si se
  puede embeber en `contracts`/`properties` como bloque opcional para evitar el
  bump; decisión de la fase 1).
- No se crea un segundo Tesorería ni un segundo store de proveedores.
- `entidadesAtribucion` no se modifica.
- Sin `any`/`as any` nuevos; tokens ATLAS v5; CSS Modules; tests por fase; sin
  auto-merge.
