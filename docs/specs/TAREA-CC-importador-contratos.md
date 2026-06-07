# TAREA CC · Importador de contratos de alquiler · Rentila + plantilla ATLAS

> **Tipo** · feature nueva + arreglo bug visual (IBAN raro en pantalla actual)
> **Tamaño** · medio-grande (1 PR · 8 commits secuenciales)
> **DB bump** · NO previsible (no añade stores · solo lee Excel y crea Contracts vía servicios existentes)
> **Stop-and-wait** · OBLIGATORIO entre commits
> **Origen** · validación con Jose tras 60 contratos Rentila reales subidos · pantalla actual `/inmuebles/importar-contratos` es muy pobre y tiene un bug (campo IBAN fuera de lugar)
> **Mockup validado** · `atlas-importer-contratos-v4.html` (en outputs · subido al repo `docs/mockups/`)
> **Predecesores** · módulo alquileres v3 desplegado · botes funcionando · pestaña "Por conciliar" implementada
> **Reglas inviolables** · `GUIA-DISENO-V5-atlas.md` sección 22 · paleta Oxford Gold · sentence case · sin emojis · Lucide

---

## 0 · LECTURA OBLIGATORIA PREVIA

### 0.1 · Documentos a leer

1. **`docs/mockups/atlas-importer-contratos-v4.html`** · mockup validado por Jose · referencia visual obligatoria
2. **`docs/decisions/DECISIONES-modelo-alquileres-XML.md`** · contexto bote vs Contract
3. **`docs/services/alquileres-modelo.md`** · estado actual del modelo
4. **`docs/GUIA-DISENO-V5-atlas.md`** · sección 22 checklist pre-entrega

### 0.2 · Contexto del problema

Pantalla actual `/inmuebles/importar-contratos` problemas detectados ·

- **Bug visual** · campo IBAN `ES6100490052632210412715` aparece junto al título · es código residual de otro flujo · NO tiene nada que ver con importar contratos · ELIMINAR
- **UX pobre** · solo "Descargar plantilla" + dropzone sin guía · sin preview · sin validación
- **No respeta paleta** · falta tokens del design system V5
- **Sin múltiples fuentes** · Rentila exporta activos + archivados por separado · hoy solo se puede subir 1
- **Sin mapeo de inmuebles** · `1-SANT FRUITOS` no coincide automáticamente con `CB Sant Fruitós` · ATLAS debe sugerir fuzzy match
- **Sin detección de duplicados** · IVAN GOMEZ ya existe del XML AEAT · si subes Rentila se duplica
- **Sin cotitulares** · `JORGE, SANDRA` (separados por coma) no se reconocen
- **Sin estado SIN FIRMAR editable** · todos los contratos quedan bloqueados tras importar

### 0.3 · Formato Rentila real · 12 columnas

Exportación real Rentila tiene esta estructura (validado con 3 archivos reales de Jose) ·

| # | Header | Notas |
|---|---|---|
| 1 | ID | Casi siempre vacío · raro caso "Nuevo alquiler" |
| 2 | Propiedad | Texto libre · ej. `"5-TENDERINA, 64 4D -001 - 0654104TP7005S0009SS"` |
| 3 | Tipo | 5 valores · vivienda · habitación · habitación temporada · temporada · Otro |
| 4 | Inicio de alquiler | DD/MM/YYYY |
| 5 | Fin del alquiler | DD/MM/YYYY · puede estar vacío |
| 6 | Nombre o compañía | Texto · cotitulares separados por coma |
| 7 | Alquiler | Importe principal |
| 8 | Alquiler | Importe duplicado · IGNORAR (Rentila lo duplica · usamos col 7) |
| 9 | Gastos | Importe |
| 10 | IVA | Valor % o vacío |
| 11 | Fianza | Importe |
| 12 | Otros gastos | Importe |

**NO trae** · NIF · email · teléfono · referencia catastral limpia. Solo nombres.

### 0.4 · Verificación grep · COMMIT 1 EXCLUSIVO

```bash
# 1 · Localizar pantalla actual /inmuebles/importar-contratos
find src -path "*importar*contratos*" -o -path "*ImportarContratos*" -name "*.tsx" | head -10
grep -rn "importar-contratos\|ImportarContratos" src --include="*.tsx" --include="*.ts" --include="*.ts*" | head -20

# 2 · Localizar el bug del IBAN raro en la pantalla actual
grep -rn "ES6100490052632210412715\|IBAN" src/pages/inmuebles src/modules/horizon/inmuebles 2>/dev/null | head -10

# 3 · Confirmar servicio de creación de Contract programático
grep -n "saveContract\|createContract" src/services/contractService.ts | head -10
sed -n '1,80p' src/services/contractService.ts

# 4 · Confirmar service de vinculación retrospectiva al bote (ya existe del PR de matching)
grep -n "vincularContractABote\|sugerirVinculaciones\|postContractCreated" src/services/boteAnualService.ts | head -20

# 5 · Inmuebles existentes · cómo se buscan por similitud de nombre
grep -rn "fuzzy\|matchProperty\|searchProperty\|findPropertyByName" src/services --include="*.ts" | head -10

# 6 · Confirmar cómo guarda Contract los cotitulares (campo añadido en spec v3)
grep -n "cotitulares" src/services/db.ts | head -10

# 7 · Estado SIN FIRMAR en Contract · valores válidos
grep -n "estadoContrato.*sin_firmar\|sin_firmar\|SIN_FIRMAR" src --include="*.ts" --include="*.tsx" -r | head -20

# 8 · Librería XLSX disponible en el proyecto
grep -n '"xlsx"\|from .xlsx.' package.json src --include="*.ts" --include="*.tsx" -r | head -10

# 9 · Si el flujo actual ya parsea Rentila
find src -name "*rentila*" -o -name "*Rentila*" | head -10
grep -rn "Rentila" src/services --include="*.ts" | head -10
```

### 0.5 · Reporte obligatorio en PR description commit 1

| Verificación | Resultado | Implicación |
|---|---|---|
| Pantalla `/inmuebles/importar-contratos` localizada | (path) | Donde rehacer |
| Bug IBAN raro · línea exacta | (path:línea) | Eliminar en commit 2 |
| `saveContract` o equivalente para creación programática | (función) | Reutilizar en commit 6 |
| `vincularContractABote` ya existe · firma actual | (firma) | Reutilizar en commit 7 (trigger automático) |
| ¿Existe fuzzy match de inmuebles? | (sí/no · path) | Si no · implementar en commit 4 |
| Contract.cotitulares existe en schema (de spec v3) | (sí/no) | Confirmar |
| Estado `sin_firmar` en enum estadoContrato | (sí/no · valores) | Si no · añadir o reusar `pendiente` |
| Librería xlsx · ¿ya está en el proyecto? | (versión) | Si no · añadir |
| ¿Existe parser Rentila previo? | (sí/no) | Si sí · auditar y aprovechar · si no · crear |

---

## 1 · ALCANCE FUNCIONAL · LO QUE EL PR ENTREGA

### 1.1 · Nueva pantalla `/inmuebles/importar-contratos` con wizard 4 pasos

Reemplazar pantalla actual completamente. Replica fielmente `atlas-importer-contratos-v4.html`.

### 1.2 · Paso 1 · Selección de origen

3 cards seleccionables ·

- **Rentila** (default) · "Exportación directa del módulo Alquileres de Rentila · ATLAS reconoce las 12 columnas automáticamente"
- **Plantilla ATLAS** · "Plantilla Excel propia con las columnas que ATLAS usa internamente · ideal si no tienes Rentila"
- **Otro Excel** · marcar como "Próximamente" · disabled · NO funcional en este PR (queda como apunte)

Banner informativo sobre cómo exportar desde Rentila si elige Rentila.

### 1.3 · Paso 2 · Subida de fichero · multi-fichero si origen=Rentila

**Si origen = Rentila** ·
- Dropzone con `<input multiple accept=".xlsx,.xls">`
- Acepta hasta 2 ficheros (Rentila exporta activos + archivados separados)
- Lista de ficheros con nombre · tamaño · contratos detectados · pill verde "formato Rentila reconocido"
- Botón quitar fichero por línea
- Banner verde total · "60 contratos listos para revisión"

**Si origen = Plantilla ATLAS** ·
- Sección con descarga de `plantilla-contratos-atlas.xlsx` (estática · servida desde public/)
- Dropzone single fichero
- Parser distinto (ver § 1.6)

### 1.4 · Paso 3 · Revisión y mapeo · 3 secciones

Tras parsear · ATLAS agrupa los contratos en 3 secciones independientes ·

**Sección 1 · Listos para crear** (verde)
- Inmueble mapeado por fuzzy match con confianza alta
- Inquilino NO existe en ATLAS (nuevo)
- Botón "Crear N contratos" activo
- Al pulsar → crea N Contracts en estado `SIN FIRMAR` · sección desaparece

**Sección 2 · Requieren revisión** (ámbar)
- ATLAS no pudo mapear el inmueble con confianza alta (fuzzy < umbral o 0 matches)
- Select obligatorio "Elegir inmueble..." con opciones · inmuebles ATLAS + "Crear inmueble nuevo"
- Botón "Crear N contratos" disabled hasta que TODAS las filas tengan select rellenado
- Al pulsar → crea N Contracts en estado `SIN FIRMAR` · sección desaparece

**Sección 3 · Posibles duplicados** (rojo)
- Inquilino YA existe en ATLAS (match por nombre fuzzy + DNI si aplica)
- Por fila · select decisión · "Omitir esta fila" (default) · "Fusionar con existente" · "Crear nuevo igualmente"
- Botón "Aplicar decisiones" siempre activo
- Al pulsar → procesa cada fila según su decisión · sección desaparece

**Tooltip discreto top-derecha** · "Rentila reconocido" con `title` informativo · NO un pill grande.

**Banner SIN FIRMAR** al pie · "Los contratos se crean como SIN FIRMAR. Podrás completar DNIs · emails · documentos y corregir datos antes de marcarlos como activos."

### 1.5 · Paso 4 · Pantalla post-creación

- Icono check grande verde
- Header · "Listo · N contratos importados"
- Summary card con · contratos creados · duplicados omitidos · inquilinos nuevos · inmuebles afectados · renta mensual total · estado SIN FIRMAR
- Banner dorado · "N contratos pueden vincularse en Por conciliar"
- Botón dorado · "Ir a Por conciliar" → redirige a `/contratos?tab=por-conciliar`

### 1.6 · Plantilla ATLAS · plantilla Excel propia descargable

Crear archivo estático `public/templates/plantilla-contratos-atlas.xlsx` con estas 11 columnas (sin la duplicada Alquiler de Rentila) ·

| # | Header | Tipo | Requerido | Ejemplo |
|---|---|---|---|---|
| 1 | Inmueble (nombre o ref. catastral) | texto | sí | `CB Sant Fruitós` o `RC 7949807TP6074N0006YM` |
| 2 | Habitación | texto | no | `Hab 2` |
| 3 | Tipo de contrato | enum | sí | `Vivienda LAU` · `Habitación larga` · `Habitación temporada` · `Vivienda temporada` · `Vacacional` |
| 4 | Fecha inicio | fecha | sí | `01/01/2024` |
| 5 | Fecha fin | fecha | no | `31/12/2028` |
| 6 | Inquilino nombre completo | texto | sí | `CONCEPCION RAMIREZ GUERERO` |
| 7 | DNI/NIF inquilino | texto | no | `53639208B` |
| 8 | Email inquilino | texto | no | `contacto@ejemplo.com` |
| 9 | Teléfono inquilino | texto | no | `+34 666 555 444` |
| 10 | Renta mensual € | número | sí | `330` |
| 11 | Fianza € | número | no | `330` |

Primera fila con headers · 3 filas con ejemplos · resto vacío para que el usuario rellene.

### 1.7 · Eliminación del bug IBAN

Eliminar el campo `ES6100490052632210412715` de la pantalla actual. Es código residual de otro flujo · NO tiene sentido en `/inmuebles/importar-contratos`. CC verifica en commit 1 exactamente dónde está y lo elimina en commit 2.

---

## 2 · LÓGICA TÉCNICA

### 2.1 · Parser Rentila · 12 columnas

Crear `src/services/rentilaParserService.ts` ·

```typescript
export interface RentilaRow {
  filaOriginal: number;       // número de fila en el Excel
  ficheroOrigen: string;      // nombre del fichero subido
  id: string | null;
  propiedad: string;          // col 2 · texto crudo
  tipo: string;               // col 3 · uno de los 5 valores reales
  inicioAlquiler: string;     // col 4 · DD/MM/YYYY
  finAlquiler: string | null; // col 5
  inquilino: string;          // col 6 · texto crudo · puede tener cotitulares
  alquiler: number;           // col 7 · ignorar col 8
  gastos: number;
  iva: string | null;         // col 10 · texto crudo (% o vacío)
  fianza: number;
  otrosGastos: number;
}

export async function parseRentilaXlsx(file: File): Promise<RentilaRow[]> {
  // 1 · Lee con xlsx (ya en el proyecto)
  // 2 · Valida que columnas 1-12 coinciden con header Rentila
  // 3 · Normaliza fechas DD/MM/YYYY → ISO YYYY-MM-DD para uso interno
  // 4 · Devuelve array de RentilaRow · NO crea Contracts aún
  // 5 · Si el header no coincide · throw RentilaFormatError
}
```

**Validación de header** · CC verifica que las 12 columnas son las exactas de Rentila (los nombres pueden variar por idioma · soportar ES e inglés si Rentila lo exporta así).

**Múltiples ficheros** · llamar `parseRentilaXlsx` por cada uno · concatenar resultados con `ficheroOrigen` poblado.

### 2.2 · Parser Plantilla ATLAS · 11 columnas

Crear `src/services/atlasTemplateParserService.ts` ·

```typescript
export interface AtlasTemplateRow {
  filaOriginal: number;
  inmuebleNombreOrRC: string;
  habitacion: string | null;
  tipoContrato: string;       // enum ATLAS
  fechaInicio: string;
  fechaFin: string | null;
  inquilinoNombre: string;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  rentaMensual: number;
  fianza: number;
}

export async function parseAtlasTemplateXlsx(file: File): Promise<AtlasTemplateRow[]>;
```

### 2.3 · Normalizador a `ContractDraft` · formato común antes de crear

Tanto Rentila como Plantilla ATLAS se normalizan a un formato intermedio común ·

```typescript
export interface ContractDraft {
  filaOriginal: number;
  ficheroOrigen: string;
  origen: 'rentila' | 'plantilla_atlas';
  
  // Mapeo de inmueble · resuelto o pendiente
  inmuebleRaw: string;             // texto crudo del Excel
  inmuebleIdSugerido: number | null;     // fuzzy match si hay
  inmuebleIdConfirmado: number | null;   // usuario confirmó en paso 3
  
  // Inquilino
  inquilinoNombre: string;
  inquilinoCotitulares: string[];  // si el nombre tenía comas
  inquilinoDni: string | null;
  inquilinoEmail: string | null;
  inquilinoTelefono: string | null;
  inquilinoExistenteId: number | null;   // match contra ATLAS
  
  // Datos del contrato
  modalidadAtlas: 'habitual' | 'vacacional';  // mapeo desde tipo Rentila
  fechaInicio: string;
  fechaFin: string | null;
  rentaMensual: number;
  fianza: number;
  
  // Clasificación · qué sección
  seccion: 'listos' | 'revisar' | 'duplicados';
  motivoSeccion: string;           // ej. "inquilino ya existe DNI 53639208B"
  
  // Decisión usuario · solo aplica si seccion=duplicados
  decisionDuplicado: 'omitir' | 'fusionar' | 'crear_nuevo' | null;
}
```

### 2.4 · Mapeo de tipos · Rentila → ATLAS

```typescript
const MAPEO_TIPO_RENTILA_ATLAS = {
  'Contrato de arrendamiento de vivienda': 'habitual',
  'Contrato de arrendamiento de habitación': 'habitual',
  'Contrato de arrendamiento de habitación temporada': 'vacacional',
  'Contrato de arrendamiento de temporada': 'vacacional',
  'Otro': 'habitual',  // default conservador · usuario edita si no aplica
};
```

Mapeo desde Plantilla ATLAS · directo (los valores de la plantilla ya son ATLAS).

**Apunte futuro** · ATLAS solo distingue `habitual` vs `vacacional` actualmente. Los 4 tipos Rentila tienen matices fiscales (art.23.2 LAU vivienda completa vs habitación) que se trabajarán en sesión propia. NO entra en este PR.

### 2.5 · Mapeo de inmuebles · fuzzy match

```typescript
export async function sugerirInmueble(
  textoExcel: string  // ej. "1-SANT FRUITOS" o "01-OVD-NICOLAI"
): Promise<{ inmuebleId: number | null; confianza: number }>;
```

Heurísticas (en orden) ·

1. **Match exacto por referencia catastral** · si el texto contiene una RC válida (`/^\d{7}[A-Z]{2}\d{4}[A-Z]\d{4}[A-Z]{2}$/`) → buscar por `property.refCatastral` · confianza 1.0
2. **Match por nombre normalizado** · normalizar texto (sin números prefijo · sin tildes · uppercase) y comparar con `property.alias` o `property.nombre` · usar Levenshtein o similar
3. **Confianza ≥ 0.7** · sugerir mapeo · sección "Listos"
4. **Confianza < 0.7** · sugerir nada · sección "Revisar"

**Habitaciones** · si texto contiene `H1`, `H2`, `-001`, `-Hab1`, etc · intentar mapear al sub-inmueble si existe.

### 2.6 · Detección de cotitulares

Si `inquilinoNombre` contiene una coma · separar ·

```typescript
"JORGE ANDERSON RIOS POSADA, SANDRA CHALARCA"
  → inquilinoNombre: "JORGE ANDERSON RIOS POSADA"
  → inquilinoCotitulares: ["SANDRA CHALARCA"]
```

El primero es el principal · el resto cotitulares.

### 2.7 · Detección de duplicados

Un Contract es "posible duplicado" si ·

- Existe un Contract en ATLAS con · `inmuebleId === draft.inmuebleIdSugerido` Y
- Coincide por `inquilino.dni` (si draft tiene DNI Y existe Contract con ese DNI en mismo inmueble) O
- Coincide por nombre fuzzy alto (Levenshtein ≥ 0.85) en mismo inmueble

Ejemplo caso Jose ·
- XML AEAT trajo Contract Camino 1 · NIF 53639208B · inmueble Sant Joan d'En Coll · 420€
- Rentila trae `2-MANRESA` · IVAN DANIEL GOMEZ RAMIREZ · 430€ · Sant Joan d'En Coll · sin DNI
- ATLAS detecta · mismo inmueble + nombre coincide con el del Contract existente (NIF 53639208B se resolvería a "IVAN ..." si tuviéramos lookup · o si Rentila trae el nombre y ATLAS lo tiene · fuzzy match)
- → sección Duplicados

### 2.8 · Decisiones en duplicados · qué hace cada una

| Decisión | Comportamiento |
|---|---|
| `omitir` | NO se crea Contract · la fila se descarta |
| `fusionar` | Se actualiza el Contract existente con los datos adicionales del Excel (ej. email · teléfono · si vienen) · NO se cambian campos protegidos (renta · fechas) si el Contract está activo · si está SIN FIRMAR se actualiza todo |
| `crear_nuevo` | Se crea un Contract nuevo · ATLAS NO marca relación con el existente · el usuario sabrá luego cuál es cuál |

### 2.9 · Creación efectiva · Contracts en estado SIN FIRMAR

Cuando el usuario pulsa "Crear N contratos" en cualquier sección ·

```typescript
async function crearContractsDesdeDrafts(drafts: ContractDraft[]) {
  for (const d of drafts) {
    const contract = {
      inmuebleId: d.inmuebleIdConfirmado,
      propertyId: d.inmuebleIdConfirmado,  // legacy
      inquilino: {
        nombre: d.inquilinoNombre,
        dni: d.inquilinoDni || '',
        email: d.inquilinoEmail || '',
        telefono: d.inquilinoTelefono || '',
        cotitulares: d.inquilinoCotitulares,
      },
      tenant: {
        nif: d.inquilinoDni || '',
      },
      modalidad: d.modalidadAtlas,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin || '2099-12-31',
      rentaMensual: d.rentaMensual,
      monthlyRent: d.rentaMensual,
      fianzaImporte: d.fianza,
      estadoContrato: 'sin_firmar',
      status: 'pending',
      fuente: d.origen,  // 'rentila' | 'plantilla_atlas'
      // ... otros campos según schema
    };
    
    const id = await saveContract(contract);
    
    // Trigger vinculación retrospectiva al bote (ya implementado en PR matching)
    await postContractCreated(id);
  }
}
```

### 2.10 · Estado SIN FIRMAR · regla de edición

Los Contracts importados nacen `SIN FIRMAR`. **Mientras estén en ese estado · TODOS los campos son editables sin anexo** (incluida renta · fechas · fianza). En cuanto el usuario los marca como `ACTIVO` · se aplica la regla de bloqueo + anexo de la sesión futura PR C.

**Este PR NO implementa la edición granular** (que es PR C aparte). Pero SÍ se asegura de que ·

- Los Contracts creados aquí nacen `SIN FIRMAR`
- El detalle del Contract permite editar todo si está `SIN FIRMAR` (verificar que la regla actual del banner "BLOQUEADO · REQUIERE ANEXO" NO se aplica a estado `SIN FIRMAR`)

Si el código actual del detalle del Contract bloquea `SIN FIRMAR` igualmente · CC repara solo eso (no granular · solo "si SIN FIRMAR · todo editable").

### 2.11 · Trigger vinculación retrospectiva al bote

Tras crear cada Contract · llamar a `postContractCreated(contractId)` (función del PR de matching ya implementada · CC verifica firma en grep).

Esto hace que ATLAS detecte automáticamente botes pendientes del mismo inmueble/año y prepare sugerencias para mostrar en `/contratos?tab=por-conciliar`.

El paso 4 final muestra "N contratos pueden vincularse en Por conciliar" · sumando las sugerencias generadas.

---

## 3 · UX · DETALLES VISUALES

CC replica el mockup `atlas-importer-contratos-v4.html` fielmente. Puntos clave ·

- **Sin emojis** · solo Lucide
- **Sentence case** · todos los textos
- **Paleta Oxford Gold** · tokens V5 · cero hex hardcoded
- **Sin bug IBAN** · eliminar campo residual
- **Stepper top** · 4 indicadores con número · activo/done con dorado
- **Demo controls** · NO se replican (eran solo para el mockup)
- **Tooltip "Rentila reconocido"** · pequeño · pill verde discreto · NO grande
- **Filas de tabla neutras** · color solo en select cuando hay acción pendiente
- **Botón por sección** · primario navy · disabled si revisión incompleta
- **Empty states** · si una sección tiene 0 contratos · NO se renderiza
- **Validaciones inline** · select sin elegir → border ámbar + outline al hover

---

## 4 · COMMITS · 8 SECUENCIALES

PR único contra `main` · título · `feat(contratos): importador Rentila + plantilla ATLAS + 3 secciones revisión`

**Stop-and-wait OBLIGATORIO entre commits.**

### Commit 1 · `chore(audit): verificación grep + reporte`

- Ejecutar grep de § 0.4
- Reportar tabla de § 0.5 en PR description
- Confirmar localización del bug IBAN
- Confirmar disponibilidad de `xlsx` lib · `saveContract` · `postContractCreated`
- NO tocar código
- Esperar autorización Jose

### Commit 2 · `fix(importer): eliminar bug IBAN residual + reorganizar layout`

- Eliminar el campo IBAN raro de la pantalla actual
- Limpiar el componente · preparar estructura para wizard 4 pasos
- Mantener funcionalidad mínima (que no rompa antes de añadir el nuevo)
- Tests · pantalla no muestra IBAN · ruta sigue siendo `/inmuebles/importar-contratos`

### Commit 3 · `feat(parsers): rentilaParserService + atlasTemplateParserService`

- Crear `rentilaParserService.ts` con `parseRentilaXlsx` (§ 2.1)
- Crear `atlasTemplateParserService.ts` con `parseAtlasTemplateXlsx` (§ 2.2)
- Validación header obligatoria · throw `RentilaFormatError` si no cuadra
- Tests · parsear los 3 xlsx reales de Jose · verificar 60 + 10 + 1 filas detectadas
- Tests · validación de header rechaza un xlsx con columnas distintas

### Commit 4 · `feat(normalizer): ContractDraft + mapeos + fuzzy match inmuebles`

- Función `normalizarRentila` y `normalizarAtlas` que producen `ContractDraft`
- Mapeo de tipos Rentila → ATLAS (§ 2.4)
- Función `sugerirInmueble` con fuzzy match (§ 2.5)
- Detección de cotitulares por coma (§ 2.6)
- Detección de duplicados (§ 2.7)
- Clasificación en 3 secciones (`listos` · `revisar` · `duplicados`)
- Tests · caso Jose · `2-MANRESA` → Sant Joan d'En Coll (confianza alta) · `01-OVD-NICOLAI` → sin sugerencia (sección revisar) · IVAN GOMEZ → duplicado por NIF
- Tests · cotitulares `JORGE, SANDRA` → 1 principal + 1 cotitular

### Commit 5 · `feat(ui): wizard 4 pasos · paso 1 (origen) + paso 2 (subida multi-fichero)`

- Crear componente `ImportarContratosWizard.tsx`
- Paso 1 · 3 cards seleccionables (Rentila · Plantilla ATLAS · Otro Excel disabled)
- Paso 2 · dropzone multi-fichero si Rentila · single fichero si Plantilla ATLAS
- Lista de ficheros subidos con contadores
- Botón continuar con validación (al menos 1 fichero válido)
- Aplicar paleta · tokens · Lucide · sentence case
- Tests · subir 2 xlsx Rentila → ATLAS los lista correctamente

### Commit 6 · `feat(ui): paso 3 · 3 secciones independientes con acciones por bloque`

- Componente paso 3 con 3 secciones renderizadas según clasificación
- Sección "Listos" · tabla preview 4 filas + "ver todas"
- Sección "Revisar" · selects obligatorios con border ámbar
- Sección "Duplicados" · selects de decisión por fila
- Botón "Crear N" en cada sección · disabled cuando aplique
- Al pulsar · llama `crearContractsDesdeDrafts` · sección desaparece
- Tooltip discreto "Rentila reconocido"
- Banner SIN FIRMAR informativo
- Tests · clic "Crear 52" en Listos → se crean 52 Contracts SIN FIRMAR · sección se cierra · botón "Continuar a resumen" se habilita

### Commit 7 · `feat(creation): crearContractsDesdeDrafts + trigger postContractCreated`

- Función `crearContractsDesdeDrafts` que itera drafts y llama `saveContract` (§ 2.9)
- Estado `sin_firmar` para todos los Contracts creados
- Trigger `postContractCreated` para vinculación retrospectiva al bote
- Reparación · si detalle de Contract bloquea `SIN FIRMAR` · permitir edición de todo (§ 2.10)
- Tests · 60 Contracts creados de Jose → 7 botes con sugerencias automáticas

### Commit 8 · `feat(ui): paso 4 final + plantilla ATLAS estática + docs`

- Paso 4 · pantalla post-creación con icono check + resumen + banner Por conciliar
- Botón "Ir a Por conciliar" → redirige a `/contratos?tab=por-conciliar`
- Crear `public/templates/plantilla-contratos-atlas.xlsx` con 11 columnas + 3 filas ejemplo (§ 1.6)
- Botón descarga en paso 2 si origen=Plantilla ATLAS
- Actualizar `docs/services/alquileres-modelo.md` con · importador · estado SIN FIRMAR · vinculación automática
- Tests E2E · flujo completo Jose · subir 2 xlsx Rentila → revisar 3 secciones → crear → llegar a paso 4 → click "Ir a Por conciliar" → ver sugerencias
- Apunte futuro · "Otro Excel" con mapeo manual · 4 tipos Rentila con matiz fiscal · sesión propia

---

## 5 · TESTS OBLIGATORIOS

### 5.1 · Unitarios

- `parseRentilaXlsx` · 12 columnas · header validation · 3 xlsx reales Jose
- `parseAtlasTemplateXlsx` · 11 columnas · header validation
- `sugerirInmueble` · 7 casos reales (CB · T48 · FA32 · T64-4D · T64-4Iz · Sant Joan · NICOLAI desconocido)
- `detectarCotitulares` · `"A, B"` · `"A, B, C"` · sin comas
- `detectarDuplicado` · por NIF + inmueble · por nombre fuzzy + inmueble · sin match
- `MAPEO_TIPO_RENTILA_ATLAS` · 5 entradas

### 5.2 · E2E caso Jose · 2 ficheros Rentila

- Subir `Rentila-Alquileres-activos.xlsx` (10 contratos) + `Rentila-Alquileres-archivados.xlsx` (50 contratos)
- Paso 3 muestra 3 secciones · esperado · ~52 listos · ~5 revisar · ~3 duplicados (cifras orientativas · CC ajusta según datos reales)
- Crear sección Listos → 52 Contracts SIN FIRMAR creados
- Trigger postContractCreated dispara sugerencias para 7 botes
- Paso 4 muestra "52 pueden vincularse en Por conciliar"
- Click "Ir a Por conciliar" → URL `/contratos?tab=por-conciliar` con sugerencias visibles

### 5.3 · E2E flujo Plantilla ATLAS

- Paso 1 · elegir "Plantilla ATLAS"
- Paso 2 · descargar plantilla · validar 11 columnas + 3 ejemplos
- Rellenar 3 contratos manuales + subir
- Paso 3 muestra los 3 en sección Listos
- Crear → Contracts SIN FIRMAR

### 5.4 · Visuales · Checklist § 22

Pre-entrega cada commit · checklist completa GUIA-DISENO-V5 sección 22.

---

## 6 · VERIFICACIÓN POST-DEPLOY (Jose en producción)

1. Ir a `/inmuebles/importar-contratos` · ver wizard nuevo · NO ver bug IBAN
2. Paso 1 · elegir Rentila · continuar
3. Paso 2 · subir 2 xlsx Rentila (activos + archivados) · ver lista 2 ficheros · 60 contratos
4. Paso 3 · ver 3 secciones · pulsar "Crear 52" · sección desaparece
5. Resolver mapeos en sección Revisar · pulsar "Crear 5"
6. Aplicar decisiones en sección Duplicados · pulsar "Aplicar"
7. Paso 4 · ver resumen · pulsar "Ir a Por conciliar"
8. `/contratos?tab=por-conciliar` · ver sugerencias automáticas en cada bote
9. Ir a `/contratos?tab=activos` · ver Contracts SIN FIRMAR · abrir uno · verificar que se puede editar todo (sin banner anexo)

---

## 7 · LO QUE NO ENTRA

- "Otro Excel" con mapeo manual de columnas · disabled · sesión futura
- Matiz fiscal de los 4 tipos Rentila (art.23.2 LAU vivienda completa vs habitación) · sesión propia
- Edición granular Categoría A vs B · PR C aparte
- Modelo de gestión delegada (ALISSER · sub-contratos · facturas honorarios) · PR D · sesión futura
- Cualquier hallazgo nuevo no incluido aquí → apunte en PR description · NO parchear

---

## 8 · CONTACTO ANTE BLOQUEOS

Si CC encuentra ·

- `saveContract` requiere campos que ContractDraft no provee
- `postContractCreated` no existe o tiene firma distinta
- Librería xlsx no está · y añadirla impacta bundle size
- El bug IBAN está conectado a algo crítico
- El estado `sin_firmar` no existe en el enum y hay que añadirlo (cambio de schema)
- Cualquier sorpresa

**PARAR · reportar en PR description · esperar input Jose.**

NO inventar · NO parchear · NO seguir.

---

**Fin de la spec · 1 PR · 8 commits · stop-and-wait · checklist § 22 · caso Jose validación · mockup v4 como referencia visual obligatoria.**
