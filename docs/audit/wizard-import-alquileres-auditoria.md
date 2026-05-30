# Auditoría · qué hace ATLAS al importar XML AEAT respecto a alquileres

> Generado por CC · 2026-05-30 · **solo lectura** · ningún archivo del repo modificado salvo este informe.
>
> Alcance: comportamiento actual del código al importar un XML de IRPF (AEAT) y cómo
> afecta a la creación de Contracts, NIFs, estado y previsiones de tesorería.
> Cada afirmación va acompañada de `archivo:línea` + snippet + explicación en lenguaje plano.

---

## Resumen ejecutivo

- **El wizard de XML NO usa la lógica "bonita" de inquilinos.** Existe una función
  `crearOActualizarContrato()` que sabe deduplicar por NIF, detectar cambio de inquilino
  y cerrar el contrato anterior. **El wizard de XML no la llama nunca.** El wizard llama a
  otra función, `crearContratoPendienteIdentificar()`, que mete **todo** en un único
  contrato `sin_identificar` por inmueble. (Hallazgo central · ver §1 y §2.)

- **Un inmueble = un contrato `sin_identificar`, sin importar años ni inquilinos.** AROA
  (2022-2023) y CONCEPCION (2024) de CB Sant Fruitós **colapsan en el mismo contrato**.
  No se crean dos contratos, no se cierra el primero, no se abre el segundo. Los importes
  de cada año se acumulan dentro del contrato (`ejerciciosFiscales[año]`). (§2)

- **El NIF del XML sí se lee y sí se guarda, pero en un sitio "escondido".** Se guarda en
  `ejerciciosFiscales[año].nifsDetectados[]`, **no** en `inquilino.dni` ni en `tenant.nif`
  (esos dos quedan en `""` a propósito). Por eso el dump de Jose los ve vacíos: el NIF
  está, pero anidado por año, no a nivel de contrato. (§3)

- **CB sale como `upcoming` (próximo) porque es `sin_identificar`, no por las fechas.** El
  estado visible (`status`) se deriva mecánicamente de `estadoContrato`: `activo→active`,
  `finalizado→terminated`, y **cualquier otra cosa (incluido `sin_identificar`) → `upcoming`**.
  La función que calcularía el estado por fechas (`getContractStatus`) existe pero **está
  muerta** (solo la usa un test). (§4)

- **Los contratos `sin_identificar` generan cobros previstos en Tesorería**, aunque no haya
  inquilino real validado. El generador vivo (`treasurySyncService`) solo excluye
  `rescindido`/`finalizado`, **no** `sin_identificar`. Con `fechaFin: 2099-12-31` el contrato
  se considera "activo" indefinidamente; no llega a 2099 solo porque el horizonte está
  capado a **24 meses**, pero seguirá generando cobros mes a mes para siempre. Hay además
  **dos motores de previsión con reglas contradictorias** sobre `sin_identificar`. (§6)

---

## 1 · Cuántos Contracts crea por XML

### Respuesta corta
El wizard de XML crea **un (1) contrato `sin_identificar` por inmueble** que tenga
arrendamientos. No crea uno por NIF, ni uno definitivo por `<Arrendamiento>`: aunque
recorre cada bloque `<Arrendamiento>`, todos los bloques de un mismo inmueble se **funden
en el mismo contrato**. Los accesorios (parking/trastero) se saltan.

### Código

El wizard (`ImportarDeclaracionWizard.tsx` / `useWizardImportState.ts`) llama a
`distribuirDeclaracion()`, y esa función es la que crea contratos:

`src/services/declaracionDistributorService.ts:226`
```ts
for (const inm of decl.inmuebles) {
    if (inm.esAccesorioDe) continue;              // ← accesorios: NO generan contrato
    const rc = normalizeRef(inm.refCatastral);
    const property = porRefCatastral.get(rc);
    if (!property?.id) continue;

    for (const arr of inm.arrendamientos) {
      // F1: Todos los arrendamientos van a sin_identificar.
      // Los NIFs del XML se guardan como metadato para sugerir al vincular.
      await crearContratoPendienteIdentificar({
        propertyId: property.id,
        ejercicio: decl.meta.ejercicio,
        importeDeclarado: arr.ingresos,
        dias: arr.diasArrendado ?? 0,
        tipoArrendamiento: arr.tipoArrendamiento === 'no_vivienda' ? 'no_vivienda' : 'vivienda',
        fechaContrato: arr.fechaContrato,
        nifsDetectados: (arr.nifArrendatarios ?? []).filter(n => n && n.trim().length > 0),
      });
    }
  }
```

Aunque el bucle llama a `crearContratoPendienteIdentificar` **una vez por cada
`<Arrendamiento>`**, dentro de esa función hay una deduplicación que reutiliza el contrato
existente del inmueble:

`src/services/declaracionOnboardingService.ts:1085`
```ts
  // Buscar si ya existe un contrato sin_identificar para este inmueble (sin importar el ejercicio)
  const existentes = await getContractsByProperty(propertyId);
  const yaExiste = existentes.find(c =>
    c.estadoContrato === 'sin_identificar'
  );

  if (yaExiste) {
    // ...se actualiza ejerciciosFiscales del contrato existente y se RETORNA.
    await updateContract(yaExiste.id!, { ejerciciosFiscales });
    return;
  }
```

La condición de reutilización es **solo** `estadoContrato === 'sin_identificar'`: no mira
el NIF, ni el año, ni la habitación. El primer arrendamiento del inmueble crea el contrato;
todos los demás (de ese inmueble, en ese XML y en XMLs posteriores) se funden en él.

### ¿Cómo decide crear vs actualizar?
- **Crear**: no existe todavía ningún contrato `sin_identificar` para ese inmueble.
- **Actualizar**: ya existe uno → se mete el importe/año/NIFs dentro de su mapa
  `ejerciciosFiscales` y se sale.

### Ejemplo de Jose · 5 XMLs (2020-2024), 6 viviendas + 2 accesorios

| Concepto | Resultado según el código actual |
|---|---|
| Contratos por los 2 accesorios | **0** (saltados por `inm.esAccesorioDe`, línea 227) |
| Contratos por cada vivienda con arrendamientos | **1 contrato `sin_identificar`** por vivienda |
| Total aproximado | **~6 contratos** (uno por vivienda), no importa que haya 5 años ni varios NIFs |
| FA32 con habitaciones H1-H4 en un mismo XML | **1 solo contrato** para FA32 (las 4 habitaciones se suman, ver §2 sobre el "mismo import < 60s") |

> En lenguaje plano: por mucho que un inmueble tenga 4 habitaciones rotando o 5 años
> declarados con inquilinos distintos, ATLAS termina con **un único contrato "pendiente de
> identificar" por inmueble**.

---

## 2 · Manejo de cambio de inquilino entre años

### Respuesta corta
Para el wizard de XML: **se crea 1 solo contrato y los años se acumulan dentro**. No se
crean dos contratos, no se cierra el primero, no se abre el segundo, no se ignora el
segundo año. Los NIFs de cada año **sí se acumulan**, pero por año dentro de
`ejerciciosFiscales[año].nifsDetectados`, no a nivel de inquilino del contrato.

### Hay DOS funciones · solo una se usa en el XML

**(A) La función que SÍ sabría manejar el cambio de inquilino — pero el XML NO la llama:**

`src/services/declaracionOnboardingService.ts:931` (`crearOActualizarContrato`)
```ts
  // 2. Deduplicación: si ya existe contrato con mismo NIF → no duplicar
  const duplicado = contractsExistentes.find(c =>
    (c.inquilino?.dni && normalizeNif(c.inquilino.dni) === normalizeNif(nifArrendatario))
    || (c.tenant?.nif && normalizeNif(c.tenant.nif) === normalizeNif(nifArrendatario))
  );
  ...
    // 3. Detectar cambio de inquilino: cerrar contrato activo con otro NIF
    const contratoActivoOtroNif = contractsExistentes.find(c =>
      c.estadoContrato === 'activo'
      && ((c.inquilino?.dni && normalizeNif(c.inquilino.dni) !== normalizeNif(nifArrendatario))
        || ...));
    if (contratoActivoOtroNif) {
      await updateContract(contratoActivoOtroNif.id!, {
        estadoContrato: 'finalizado',
        fechaFin: `${ejercicio - 1}-12-31`,
        status: 'terminated',
        endDate: `${ejercicio - 1}-12-31`,
      });
    }
```

Esta función **cierra el contrato del inquilino anterior** y abre uno nuevo. Es justo lo
que el caso CB necesitaría. **Pero su único llamador es el flujo de onboarding por PDF/análisis**
(`opciones.crearContratos`), no el wizard de XML:

`src/services/declaracionOnboardingService.ts:699`
```ts
    if (opciones.crearContratos) {
      for (const contrato of resultado.contratos) {
        ...
          await crearOActualizarContrato({ ... });
```

**(B) La función que SÍ usa el XML — y NO maneja cambio de inquilino:**

`crearContratoPendienteIdentificar` (llamada desde `distribuirDeclaracion`, ver §1) solo
busca por `estadoContrato === 'sin_identificar'` y funde todo. Cómo distingue "mismo XML"
(sumar) de "reimportación" (sobrescribir):

`src/services/declaracionOnboardingService.ts:1099`
```ts
    // F2: Diferenciar entre "mismo XML, múltiples <Arrendamiento>" (sumar)
    // y "re-importación" (sobreescribir) por timestamp < 60s.
    const mismaImportacion = fechaExistente
      && (ahora.getTime() - fechaExistente.getTime()) < 60_000;

    if (mismaImportacion && existenteAño) {
      const nifsExistentes = existenteAño.nifsDetectados ?? [];
      const nifsNuevos = (nifsDetectados ?? []).filter(n => n && !nifsExistentes.includes(n));
      ejerciciosFiscales[ejercicio] = {
        estado: 'declarado',
        importeDeclarado: (existenteAño.importeDeclarado ?? 0) + importeDeclarado,
        dias: Math.min((existenteAño.dias ?? 0) + dias, 366),
        fuente: 'xml_aeat',
        fechaImportacion: ahora.toISOString(),
        nifsDetectados: [...nifsExistentes, ...nifsNuevos],
      };
    } else {
      ejerciciosFiscales[ejercicio] = { estado: 'declarado', importeDeclarado, ... };
    }
```

### Ejemplo CB Sant Fruitós

- IRPF 2022 → NIF `53639207X` (AROA): crea **1** contrato `sin_identificar` para CB. Guarda
  `ejerciciosFiscales[2022] = { importeDeclarado: 3600, nifsDetectados: ['53639207X'] }`.
- IRPF 2023 → mismo NIF `53639207X`: encuentra el contrato existente, escribe
  `ejerciciosFiscales[2023] = { ..., nifsDetectados: ['53639207X'] }`. **Sigue siendo 1 contrato.**
- IRPF 2024 → NIF `43508951N` (CONCEPCION, cambio de inquilino): encuentra el **mismo**
  contrato `sin_identificar`, escribe `ejerciciosFiscales[2024] = { ..., nifsDetectados: ['43508951N'] }`.
  **No cierra el de AROA. No abre uno nuevo. Sigue siendo 1 contrato.**

Resultado: **1 contrato** con tres años en su mapa fiscal y NIFs distintos por año. El
cambio de inquilino entre 2023 y 2024 **no queda modelado como dos contratos**; queda
implícito en que `nifsDetectados` cambia de un año a otro.

> En lenguaje plano: ATLAS no entiende "AROA se fue y entró CONCEPCION". Para ATLAS, CB es
> un único "bote pendiente de identificar" con varios años dentro, y por dentro guarda los
> dos DNIs separados por año, pero no crea dos contratos ni marca que hubo un relevo.

---

## 3 · Persistencia del NIF

### Respuesta corta
- El NIF **sí se lee** del XML (campos `TANIFARREND1` y `TANIFARREND2`, ambos).
- Se **persiste** en `ejerciciosFiscales[año].nifsDetectados[]` del contrato.
- **NO** se rellena `inquilino.dni` ni `tenant.nif` (quedan `""` a propósito en el camino
  `sin_identificar`).
- **NO existe** un campo `nifsDetectados` a nivel de `Contract`; solo existe dentro de
  `EjercicioFiscalContrato` (anidado por año). Por eso el dump no lo muestra a primer nivel.

### Lectura del XML (los dos NIFs se leen)

`src/services/irpfXmlParserService.ts:467`
```ts
    const nifs: string[] = [];
    const nif1 = txt(bloque, 'TANIFARREND1');
    const nif2 = txt(bloque, 'TANIFARREND2');
    if (nif1) nifs.push(nif1);
    if (nif2) nifs.push(nif2);
    ...
    arrendamientos.push({
      ...
      nifArrendatarios: nifs,   // ← array con 1 o 2 NIFs
```

- **Caso simple** (solo `TANIFARREND1`): `nifArrendatarios = ['NIF1']`.
- **Caso múltiple** (`TANIFARREND1` + `TANIFARREND2`, pareja): `nifArrendatarios = ['NIF1','NIF2']`.
  **Ambos se guardan** (no se pierde el segundo).
- **Caso sin NIF**: `nifArrendatarios = []`. No se intenta inferir nada.

### Dónde se guardan (el sitio "escondido")

El distribuidor pasa los NIFs como `nifsDetectados` (§1), y la función de creación los
escribe **dentro del mapa por año**, dejando `inquilino`/`tenant` en blanco:

`src/services/declaracionOnboardingService.ts:1149` (creación del contrato `sin_identificar`)
```ts
  await saveContract({
    ...
    inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' },  // ← dni VACÍO
    ...
    ejerciciosFiscales: {
      [ejercicio]: {
        estado: 'declarado',
        importeDeclarado,
        dias: Math.min(dias, 366),
        fuente: 'xml_aeat',
        fechaImportacion: new Date().toISOString(),
        nifsDetectados: nifsDetectados ?? [],   // ← el NIF va AQUÍ, anidado por año
      },
    },
    ...
    tenant: { name: '', nif: '', email: '' },   // ← nif VACÍO
    ...
  });
```

El campo `nifsDetectados` **solo está definido en `EjercicioFiscalContrato`**, no en `Contract`:

`src/services/db.ts:648`
```ts
export interface EjercicioFiscalContrato {
  estado: 'declarado' | 'pendiente' | 'en_curso';
  importeDeclarado?: number;
  dias?: number;
  fuente?: 'xml_aeat' | 'atlas' | 'manual';
  fechaImportacion?: string;
  nifsDetectados?: string[];   // ← existe aquí (por año), NO en Contract a primer nivel
}
```

### Estado del "bug" observado

| Observación de Jose | Explicación verificada |
|---|---|
| `inquilino.dni: ""` aunque el XML traiga NIF | **Correcto/intencionado en el código.** El camino `sin_identificar` siempre escribe `dni: ''` (línea 1158). El NIF no se "pierde": está en `ejerciciosFiscales[año].nifsDetectados`. |
| `tenant.nif: ""` también | Igual: línea 1197 escribe `nif: ''`. |
| `nifsDetectados` no aparece en el dump | Porque **no es un campo de `Contract`**. Está anidado dentro de `ejerciciosFiscales[año]`. Si el dump no expandió ese sub-objeto, no se ve. |

> En lenguaje plano: el NIF **sí se está guardando**, pero en un cajón distinto (por año,
> dentro del histórico fiscal del contrato) del que mira el dump (`inquilino.dni` /
> `tenant.nif`). No es que se pierda; es que está en otro sitio y el inquilino "oficial"
> del contrato se deja en blanco hasta que alguien lo vincule a mano.

### Dónde se vuelve a leer ese NIF (prueba de que se persiste)

Al vincular el contrato `sin_identificar`, la propuesta lee precisamente ese campo:

`src/services/vinculacionFiscalService.ts:63`
```ts
  const ejercicioData = sinId.ejerciciosFiscales?.[ejercicio];
  const importeDeclarado = ejercicioData?.importeDeclarado ?? 0;
  const nifsDetectados = ejercicioData?.nifsDetectados ?? [];
```

Y la UI los muestra como sugerencia: `VinculacionDrawer.tsx:291-306` (`propuesta.nifsDetectados.join(', ')`).

---

## 4 · Cálculo de `status`

### Respuesta corta
- El `status` **no se calcula por fechas**. Se deriva mecánicamente de `estadoContrato` en
  el momento de guardar el contrato.
- Mapeo: `activo → active`, `finalizado → terminated`, **todo lo demás → `upcoming`**
  (incluido `sin_identificar` y `rescindido`).
- CB queda `upcoming` **porque es `sin_identificar`**, no por sus fechas. Las fechas
  (`fechaInicio: 2022`, `fechaFin: 2099`) son irrelevantes para `status`.
- Valores válidos de `status`: **`'active' | 'upcoming' | 'terminated'`** (3 valores).

### Código que asigna `status`

`src/services/contractService.ts:72` (`saveContract`)
```ts
  const enhancedContract: Omit<Contract, 'id'> = {
    ...contract,
    // Set defaults for backward compatibility
    status: contract.estadoContrato === 'activo' ? 'active' :
           contract.estadoContrato === 'finalizado' ? 'terminated' : 'upcoming',
    ...
  };
```

Esto **pisa** cualquier `status` que venga del llamador. Nótese que
`crearContratoPendienteIdentificar` pasa `status: 'active'` (línea 1205), pero `saveContract`
lo recalcula a partir de `estadoContrato`. Como `estadoContrato === 'sin_identificar'`, no
es `'activo'` ni `'finalizado'`, así que cae en el `else` → **`'upcoming'`**.

### La función "por fechas" existe pero está MUERTA

`src/services/contractService.ts:507` (`getContractStatus`)
```ts
export const getContractStatus = (contract: Contract): 'active' | 'upcoming' | 'terminated' => {
  const now = new Date(); now.setHours(0,0,0,0);
  const startDate = new Date(contract.fechaInicio); ...
  if (contract.estadoContrato === 'rescindido' || contract.estadoContrato === 'finalizado') return 'terminated';
  if (endDate < now) return 'terminated';
  if (startDate > now) return 'upcoming';
  return 'active';
};
```

Esta sí miraría las fechas (y para CB devolvería `active`, ya que `2022 < hoy < 2099`).
**Pero no se usa en producción**: el único consumidor es un mock de test.

`grep getContractStatus` → único resultado fuera de su definición:
```
src/__tests__/contractsListaEnhanced.test.tsx:19:  getContractStatus: jest.fn().mockReturnValue('active')
```

### Valores válidos del campo `status` (modelo Contract)

`src/services/db.ts:884`
```ts
  status: 'active' | 'upcoming' | 'terminated'; // Maps to estadoContrato
```

(Campo legacy.) El campo "canónico" de estado es `estadoContrato`, con 4 valores:

`src/services/db.ts:773`
```ts
  estadoContrato: 'activo' | 'rescindido' | 'finalizado' | 'sin_identificar';
```

> En lenguaje plano: CB no aparece como "próximo/upcoming" por un error de fechas, sino
> porque su estado interno es "pendiente de identificar", y la regla de traducción a la
> etiqueta visible manda todo lo que no sea "activo" o "finalizado" al cajón "upcoming".
> Como `sin_identificar` no tiene su propia etiqueta visible, cae en "upcoming".

---

## 5 · Arrendamiento sin DNI · qué crea

### Respuesta corta
- **Sí**, crea un Contract con `estadoContrato: 'sin_identificar'` (igual que cualquier
  arrendamiento del XML — con o sin DNI, **siempre** va a `sin_identificar`; el DNI no
  cambia el tipo de contrato que se crea).
- **Sí**, calcula `rentaMensual = round(importeDeclarado / 12)`.
- **Sí**, guarda el importe anual original (p.ej. 17.710 €) en
  `ejerciciosFiscales[año].importeDeclarado`, además del `rentaMensual` derivado.
- **No existe** una entidad separada tipo "bote anual" / "agregado fiscal". El propio
  contrato `sin_identificar` (con su mapa `ejerciciosFiscales`) **es** ese "bote".

### Código

`src/services/declaracionOnboardingService.ts:1147`
```ts
  // Calcular renta mensual estimada
  const rentaMensualEstimada = Math.round(importeDeclarado / 12);

  // Crear contrato sin_identificar
  await saveContract({
    inmuebleId: propertyId,
    unidadTipo: 'vivienda',
    modalidad,
    estadoContrato: 'sin_identificar',
    ...
    rentaMensual: rentaMensualEstimada,
    ...
    ejerciciosFiscales: {
      [ejercicio]: {
        estado: 'declarado',
        importeDeclarado,          // ← 17.710 € se conserva aquí, íntegro
        dias: Math.min(dias, 366),
        fuente: 'xml_aeat',
        fechaImportacion: new Date().toISOString(),
        nifsDetectados: nifsDetectados ?? [],
      },
    },
    ...
    monthlyRent: rentaMensualEstimada,
    ...
  });
```

Importante: el camino `sin_identificar` se dispara **para todos los arrendamientos** del XML
(comentario "F1: Todos los arrendamientos van a sin_identificar", `declaracionDistributorService.ts:233`),
**tenga o no NIF**. La ausencia de DNI no es lo que decide crear un `sin_identificar`; el
diseño actual manda **siempre** a `sin_identificar`.

### Ejemplo T48 (17.710 € declarados, año 2024, sin DNI específico)

- Se crea **1** contrato `sin_identificar` para T48 (si no existía ya uno para ese inmueble).
- `rentaMensual = round(17710 / 12) = 1476 €/mes` (estimación derivada).
- `ejerciciosFiscales[2024] = { importeDeclarado: 17710, dias: ..., fuente: 'xml_aeat', nifsDetectados: [] }`.
- No hay entidad "agregado fiscal" aparte; el dato fiscal anual vive dentro del contrato.

> Nota: el caso real T48 = ALISSER REAL ESTATE 1.235,26 €/mes (LAU vivienda) tiene poca
> relación con la estimación 17.710/12 = 1.476 €/mes que ATLAS calcularía si AEAT trae
> el agregado 17.710 €. La cifra derivada es un reparto lineal, no la renta contractual real.

> En lenguaje plano: ATLAS coge el total declarado del año, lo divide entre 12 para tener
> una renta mensual "de mentira" y guarda aparte (dentro del mismo contrato) el total anual
> de verdad. No hay un buzón separado de "pendiente de identificar"; ese papel lo hace el
> propio contrato marcado como `sin_identificar`.

---

## 6 · TreasuryEvents generados

### Respuesta corta
- Los genera **`treasurySyncService.generateMonthlyForecasts()`**, orquestado mes a mes por
  **`treasuryBootstrapService.regenerateForecastsForward()`**.
- Se generan **on-the-fly** (al cargar/refrescar Tesorería), **no** al crear el contrato.
  De hecho `saveContract` **omite** explícitamente la generación para `sin_identificar`
  (y además la función que omitiría es un no-op desde V62).
- Cobertura temporal: **mes en curso + 24 meses hacia delante** (horizonte por defecto).
- **Sí**, un contrato `sin_identificar` **genera cobros previstos** aunque no tenga inquilino
  real validado. Esto es un comportamiento cuestionable (ver hallazgo).
- Con `fechaFin: 2099-12-31` **no** llega a generar hasta 2099 (el horizonte capa a 24
  meses), pero el contrato se considera "activo en el mes" indefinidamente, así que produce
  cobros sin fin a medida que avanza la ventana.

### Quién genera los eventos (el generador vivo)

El evento observado (`sourceType: 'contrato'`, `description: 'Renta − Inquilino'`) coincide
exactamente con este generador:

`src/modules/horizon/tesoreria/services/treasurySyncService.ts:393`
```ts
  // ── 3. CONTRATOS ACTIVOS (rental income) ──
  const contracts = await getAllContracts();
  for (const contract of contracts) {
    if (!isContractActiveInMonth(contract, year, month)) continue;   // ← clave
    if (contract.id == null) continue;
    if (await isDuplicate('contrato', contract.id)) { skipped++; continue; }

    const inquilino =
      `${contract.inquilino?.nombre ?? ''} ${contract.inquilino?.apellidos ?? ''}`.trim() ||
      'Inquilino';                                                   // ← default "Inquilino"
    const day = contract.diaPago ?? 1;
    const amount = contract.rentaMensual ?? 0;                       // ← renta estimada (importe/12)

    await insertEvent({
      type: 'income' as const,
      amount,
      predictedDate: buildDate(year, month, day),
      description: `Renta – ${inquilino}`,                           // ← "Renta – Inquilino"
      sourceType: 'contrato' as const,
      sourceId: contract.id,
      ...
      status: 'predicted' as const,
    });
  }
```

El filtro `isContractActiveInMonth` **NO excluye `sin_identificar`** — solo descarta
`rescindido` y `finalizado`:

`src/modules/horizon/tesoreria/services/treasurySyncService.ts:91`
```ts
function isContractActiveInMonth(contract, year, month): boolean {
  if (contract.estadoContrato === 'rescindido' || contract.estadoContrato === 'finalizado') {
    return false;
  }
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const inicio = new Date(contract.fechaInicio);
  const fin = new Date(contract.fechaFin);
  return monthStart <= fin && monthEnd >= inicio;   // 2099 ⇒ siempre true hacia delante
}
```

### Cuándo / con qué cobertura temporal

`src/services/treasuryBootstrapService.ts:32` y `:164`
```ts
const DEFAULT_HORIZONTE_MESES = 24;
...
  for (let i = 0; i < horizonteMeses; i++) {
    const mes = addMonthsUTC(desde, i);
    ...
      const sync = await generateMonthlyForecasts(year, month);
```

→ Se recorren 24 meses desde el primer día del mes en curso. Para CB/T48
(`fechaInicio` pasado, `fechaFin: 2099`) **cada uno de esos 24 meses** cumple
`isContractActiveInMonth`, así que se genera **1 cobro `income` por mes** con
`amount = rentaMensual` (la estimación importe/12). Esto explica el patrón observado por
Jose: "+ otros 5 cobros mensuales × 12 meses cada uno" (varios inmuebles, cada uno con su
serie mensual de cobros previstos).

> Nota: `predictedDate: '2026-05-01'` del dump encaja con el primer mes de la ventana
> (mes en curso a fecha de hoy, 2026-05).

### Generación al crear el contrato: NO

`src/services/contractService.ts:102`
```ts
  // Generate monthly rent forecasts (RentaMensual)
  // Skip for sin_identificar contracts — they don't have sufficient data for monthly forecasts
  if (enhancedContract.estadoContrato !== 'sin_identificar') {
    await generateRentaMensual(contractId as number, enhancedContract);
  }
```
…y además `generateRentaMensual` es un **no-op** desde V62:
`src/services/contractService.ts:359` → cuerpo vacío.

### Auditoría de la decisión (incoherencia entre dos motores)

Hay **dos** motores de previsión de rentas con reglas **distintas** sobre `sin_identificar`:

1. `treasurySyncService.regenerar...` (el vivo, `sourceType: 'contrato'`): **incluye**
   `sin_identificar` (solo excluye `rescindido`/`finalizado`). → **genera cobros**.
2. `treasuryForecastService.regenerateRentalsForecast` (`sourceType: 'contract'`):
   **excluye** todo lo que no sea `activo`:

   `src/services/treasuryForecastService.ts:475`
   ```ts
   const activeContracts = contracts.filter((c) => c.estadoContrato === 'activo');
   ```

   → con esta regla un `sin_identificar` **no** generaría cobros.

Las dos lógicas se contradicen. La que está produciendo los eventos observados por Jose es
la #1 (`treasurySyncService`), que **sí** crea cobros previstos para contratos que en
realidad no tienen inquilino confirmado.

> En lenguaje plano: aunque el contrato esté "pendiente de identificar" (no sabemos quién
> es el inquilino ni la renta real), ATLAS igualmente rellena Tesorería con cobros mensuales
> estimados durante 2 años. No llega hasta 2099 porque solo proyecta 24 meses, pero como la
> fecha de fin es 2099, nunca se "apaga": seguirá generando cobros indefinidamente cada vez
> que pase el tiempo. Y hay dos piezas del código que opinan distinto sobre si esto debería
> pasar.

---

## 7 · Duplicación inquilino / tenant

### Respuesta corta
- Hay dos bloques porque **`tenant` es legacy** (compatibilidad hacia atrás) e
  **`inquilino` es el canónico** (modelo nuevo, en español, completo).
- El canónico actual es **`inquilino`** (con `nombre/apellidos/dni/telefono/email`).
  `tenant` (`name/nif/email`) está marcado explícitamente como "Legacy".
- **No hay sincronización automática** entre ambos. Quien crea el contrato debe rellenar
  los dos a mano (el wizard de XML los rellena ambos… en blanco).

### Modelo

`src/services/db.ts:716` (canónico)
```ts
  // NEW FIELDS: Tenant information (complete as required)
  inquilino: {
    nombre: string;
    apellidos: string;
    dni: string;
    telefono: string;
    email: string;
  };
```

`src/services/db.ts:840` (legacy)
```ts
  // Legacy tenant information
  tenant?: {
    name?: string;
    nif?: string;
    email?: string;
  };
```

`inquilino` es **obligatorio** (sin `?`); `tenant` es **opcional** (`tenant?`) y está bajo el
comentario "LEGACY FIELDS for backward compatibility" (db.ts:834). Misma relación que
`fechaInicio/fechaFin` (canónico) vs `startDate/endDate` (legacy), y `rentaMensual` (canónico)
vs `monthlyRent` (legacy).

### Quién lee cuál

- **Lecturas de `inquilino`** (canónico) — predominan en UI/servicios nuevos. Ejemplos:
  - `treasurySyncService.ts:406` arma el nombre del cobro desde `contract.inquilino?.nombre/apellidos`.
  - `treasuryForecastService.ts:498` igual.
  - `vinculacionFiscalService.ts:118-129` usa `contrato.inquilino?.nombre` y cae a
    `contrato.tenant?.nif` solo como **fallback**.
- **Lecturas de `tenant`** (legacy) — sobre todo como *fallback* cuando `inquilino` está vacío:
  - `vinculacionFiscalService.ts:129`: `contrato.inquilino?.dni ?? contrato.tenant?.nif ?? ''`.
  - `crearOActualizarContrato` deduplica mirando **ambos**: `inquilino?.dni` **o** `tenant?.nif`
    (`declaracionOnboardingService.ts:957-958`).
  - `scopeSeedService.ts:76`: `contract.tenant?.name || 'Inquilino'`.

### ¿Hay sincronización entre ambos?
**No.** No existe una función que mantenga `inquilino` ↔ `tenant` en sync. Cada escritor
rellena los dos por separado. En el camino de XML ambos se escriben **vacíos**:

`src/services/declaracionOnboardingService.ts:1155` y `:1195`
```ts
    inquilino: { nombre: '', apellidos: '', dni: '', telefono: '', email: '' },
    ...
    tenant: { name: '', nif: '', email: '' },
```

(En el camino legacy `crearOActualizarContrato`, en cambio, ambos se rellenan con el NIF:
`inquilino.dni = nifArrendatario` y `tenant.name = tenant.nif = nifArrendatario`,
líneas 1003 y 1032-1035 — pero ese camino no lo usa el wizard de XML.)

### ¿Cuál se rellena al importar XML?
**Ninguno con datos reales.** El wizard escribe los dos en blanco; el NIF real va a
`ejerciciosFiscales[año].nifsDetectados` (ver §3).

> En lenguaje plano: `inquilino` es la versión "buena" y `tenant` es la vieja que se mantiene
> por compatibilidad. Nadie los mantiene sincronizados automáticamente; el código nuevo lee
> `inquilino` y usa `tenant` solo como red de seguridad. Al importar XML, los dos quedan
> vacíos a propósito.

---

## Hallazgos adicionales

> Documentados como observación. **No se ha tocado ningún archivo.**

1. **H1 · La lógica de cambio de inquilino existe pero el wizard de XML no la usa.**
   `crearOActualizarContrato` (cierra contrato anterior, abre nuevo, deduplica por NIF) solo
   se llama desde el flujo `opciones.crearContratos` (onboarding por análisis/PDF,
   `declaracionOnboardingService.ts:705`). El wizard de XML (`distribuirDeclaracion`) usa
   exclusivamente `crearContratoPendienteIdentificar`. Resultado: por XML, el cambio de
   inquilino entre años **no** se modela. (§1, §2)

2. **H2 · `getContractStatus` (estado por fechas) es código muerto.** Único consumidor: un
   mock de test (`contractsListaEnhanced.test.tsx:19`). El `status` real se deriva de
   `estadoContrato` en `saveContract`. Por eso un contrato con `fechaInicio` en el pasado y
   `fechaFin` 2099 puede mostrarse como `upcoming` en lugar de `active`. (§4)

3. **H3 · `sin_identificar` se traduce a `upcoming` por descarte.** El mapeo de
   `saveContract` no tiene rama para `sin_identificar`, así que cae en el `else` →
   `upcoming`. La etiqueta visible "próximo" no describe bien un contrato que representa
   ingresos ya declarados de años pasados. (§4)

4. **H4 · Dos motores de previsión con reglas contradictorias sobre `sin_identificar`.**
   `treasurySyncService` (vivo) genera cobros para `sin_identificar`;
   `treasuryForecastService.regenerateRentalsForecast` los excluye (`=== 'activo'`).
   Conviven en el repo con `sourceType` distinto (`'contrato'` vs `'contract'`). (§6)

5. **H5 · Contratos `sin_identificar` generan cobros previstos sin inquilino validado.**
   `isContractActiveInMonth` no filtra `sin_identificar`. Con `fechaFin: 2099` el contrato es
   "activo" perpetuamente; el horizonte de 24 meses es lo único que limita el volumen de
   eventos. (§6)

6. **H6 · `rentaMensual` se fija con el PRIMER año importado y no se recalcula al fundir
   años posteriores.** En la rama `yaExiste` de `crearContratoPendienteIdentificar`
   (`declaracionOnboardingService.ts:1091-1127`) solo se actualiza `ejerciciosFiscales`; el
   campo `rentaMensual` del contrato **no** se toca. Si Jose importó 2020 primero, la renta
   mensual estimada que alimenta Tesorería se queda anclada a 2020 aunque 2024 declare otra
   cifra. (§2, §6)

7. **H7 · La fusión "mismo import < 60s" depende del reloj.** El criterio para sumar
   importes de varios `<Arrendamiento>` del mismo XML es que la última escritura tenga
   menos de 60 segundos (`60_000` ms, línea 1102). Si una importación grande tarda más de
   60s entre bloques del mismo inmueble (improbable pero posible), el código cambiaría de
   "sumar" a "sobrescribir", perdiendo importe. Es una heurística temporal, no una marca
   explícita de "misma importación". (§2)

8. **H8 · FA32 (H1-H4 rotativas) colapsa en un solo contrato.** Como la deduplicación es
   por inmueble (`estadoContrato === 'sin_identificar'`, sin mirar habitación), las 4
   habitaciones de FA32 se funden en un único contrato y sus importes se suman dentro del
   año. El detalle por habitación del XML no se conserva como contratos separados. (§1)

9. **H9 · `monthlyRent`/`rentaMensual` para agregados anuales es un reparto lineal.**
   `round(importeDeclarado/12)` no refleja días reales arrendados ni la renta contractual
   (ej. T48: 1.476 €/mes derivado vs 1.235,26 €/mes real). El dato fiel (importe anual +
   días) sí queda en `ejerciciosFiscales`, pero la renta mensual mostrada es aproximada. (§5)

---

## Preguntas abiertas para Jose

> Cosas que el código **no** responde por sí solo y que condicionan el diseño de la
> siguiente tarea. CC no las inventa.

1. **¿El modelo deseado es "1 contrato por inmueble" o "1 contrato por inquilino/periodo"?**
   Hoy el XML produce 1 contrato `sin_identificar` por inmueble con todos los años dentro.
   Para CB (AROA→CONCEPCION) o T48 (cambio de gestor), ¿quieres que ATLAS cree contratos
   distintos por inquilino/periodo, o prefieres mantener el "bote único por inmueble" y
   resolver el inquilino al vincular?

2. **¿`sin_identificar` debe generar cobros previstos en Tesorería?** Hoy sí (24 meses).
   ¿Quieres que un contrato sin inquilino validado aparezca en las previsiones de cobro, o
   solo a partir de que se vincule/confirme?

3. **¿Qué etiqueta visible quieres para `sin_identificar`?** Hoy se muestra como `upcoming`
   ("próximo"). ¿Debería tener su propia etiqueta ("pendiente de identificar"), o mapear a
   `active`/otra cosa?

4. **¿Cuál es la renta mensual "buena" cuando AEAT solo trae el agregado anual?**
   Hoy = importe/12. ¿Aceptable como estimación, o prefieres no mostrar renta mensual hasta
   tener el contrato real? (afecta a T48 y a los agregados.)

5. **¿Qué se hace con el cambio de inquilino entre años (NIF distinto)?** ¿Cerrar
   automáticamente el periodo anterior y abrir el siguiente (como hace la función legacy
   `crearOActualizarContrato`), o dejarlo como histórico de NIFs por año dentro del mismo
   contrato (como hace hoy el XML)?

6. **¿Cuál de los dos motores de previsión es el "oficial"?** Conviven `treasurySyncService`
   (`'contrato'`, incluye `sin_identificar`) y `treasuryForecastService` (`'contract'`, solo
   `activo`). Antes de cualquier fix conviene saber cuál debe quedar como fuente única.

7. **¿`tenant` (legacy) debe seguir existiendo?** Si todo el código nuevo lee `inquilino`,
   ¿se quiere planificar la retirada de `tenant`, o mantenerlo como fallback indefinidamente?
