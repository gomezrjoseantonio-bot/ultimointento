# S-WIZARD-CUENTA-V3 · pantalla única · estilo ATLAS v8

> **Tipo** · Reemplazo completo del modal crear/editar cuenta · 5 sub-tareas · 1 PR único
> **Tiempo estimado** · 5-8h CC
> **Cierra** · tercer wizard reescrito en estilo ATLAS v8 · refuerza patrón sentado por nómina + inmueble
> **Reglas aplicadas** · regla canónica grep duro · stop-and-wait · NO reutilizar código del actual · pre-flight obligatorio · 1 PR contra `main` sin mergear hasta autorización Jose
> **DB** · NO sube versión · v70 sigue · solo añade campos a schema TypeScript si faltan
> **Predecesor** · spec wizard nómina v3 · spec wizard inmueble v4 · TAREA 13 v4 mergeada · DB v70 · 40 stores · `accounts` con 8 registros en producción
> **Sucesor** · wizard autónomo · gasto recurrente · contrato · plan pensión

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en sub-tarea 1** · grep duro sobre el repo real · NO confiar en supuestos
2. **Si pre-flight revela contradicciones** con el spec · STOP · documentar · esperar Jose
3. **NO reutilizar NADA del modal actual** · se elimina entero
4. **NO TOCAR DB_VERSION** · sigue v70
5. **Encadenar sub-tareas en una rama** · 1 PR final único contra `main`
6. **NO mergear** · esperar Jose
7. **NO arreglar 43 tests failing pre-existing**
8. **Mockup v3 es la guía visual literal** · paleta · espaciados · densidad · colores · tipografía
9. **Sentence case mandatory** · "Nueva cuenta" no "Nueva Cuenta"
10. **IBAN NO obligatorio** · puede haber cuentas sin IBAN (ej. tarjetas crédito · cuentas raras)

---

## §1 · Contexto · qué reemplaza esta tarea

### 1.1 · Modal actual · estado · qué falla

Modal pequeño · NO full-screen · NO 2 columnas · disparado desde Tesorería al pulsar "Nueva cuenta".

Estructura actual ·
- Cuenta principal (input)
- Tipo (select desplegable · Corriente / Ahorro / Otra / Tarjeta crédito)
- IBAN * (marcado obligatorio · pero NO debería serlo)
- Saldo inicial
- Fecha
- Botón adjuntar (clip)
- Toggle "Cuenta remunerada"
- Botones · Cancelar / Crear cuenta (en NAVY · debe ser oro v8)

Problemas ·
- Modal pequeño · no aprovecha pantalla · sin preview live
- Botón "Crear cuenta" en navy · debe ser oro
- IBAN marcado obligatorio · NO debería serlo
- Tipo "Otra" sin sentido · falta Tarjeta crédito como tipo principal
- Si tipo = Tarjeta crédito · campos NO se adaptan (sigue pidiendo IBAN)
- "Cuenta remunerada" toggle sin desplegar campos cuando se activa
- No hay vista previa de cómo se verá la cuenta en listados
- No hay badges de "Cuenta principal" · "Recibe nómina X" · etc

### 1.2 · Wizard nuevo · objetivo

1 sola pantalla · modal full-screen · 2 columnas · 5 bloques en form · estilo ATLAS v8 · cálculos en tiempo real (intereses estimados si remunerada) · adaptación de campos visibles según tipo de cuenta · preview con avatar · vista de listado · badges de roles especiales.

### 1.3 · Caso real Jose como dogfood

Cuentas conocidas de Jose · 8 cuentas activas en `accounts` (snapshot AUDIT-39) ·
- Santander · ···· 2715 · corriente · destino nómina Orange · 30.000 € (memoria)
- Unicaja · BBVA · ING · Sabadell · Abanca · Bankinter · Revolut · Carrefour Card

Caso del mockup · "Santander principal" · IBAN ES61 0049 0052 6322 1041 2715 · cuenta principal · destino nómina · saldo inicial 30.000 €.

---

## §1.5 · Prerequisito Jose · subir mockup al repo

Antes de lanzar este spec a CC · Jose sube `atlas-wizard-cuenta-v3.html` al repo en ·

```
docs/mockups/atlas-wizard-cuenta-v3.html
```

CC verifica con `ls docs/mockups/atlas-wizard-cuenta-v3.html` en sub-tarea 1. Si no existe · STOP.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · Pre-flight · localizar arquitectura actual

**Tiempo** · 30-45 min CC

#### Pre-flight obligatorio

```bash
# Verificar mockup subido
ls -la docs/mockups/atlas-wizard-cuenta-v3.html

# Localizar modal actual de cuenta
grep -rnE "Nueva cuenta|NewAccountModal|CuentaModal|AccountForm|CreateAccount" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
find src/ -type f \( -name "*Account*" -o -name "*Cuenta*" -o -name "*Nueva*Cuenta*" \) 2>/dev/null

# Localizar servicio y store
find src/services -type f \( -name "account*" -o -name "cuenta*" \) 2>/dev/null
grep -rnE "accountsService|cuentasService|cuentaService" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Schema del store accounts
grep -rnE "objectStore.*\"accounts\"|createObjectStore.*accounts" src/ --include="*.ts" 2>/dev/null
grep -rnE "interface Account|type Account" src/types/ --include="*.ts" 2>/dev/null

# Verificar campos esperados en el tipo Account · qué hay y qué falta
# Esperados (según mockup) · alias · tipo · banco · iban · bic · saldoInicial · fechaSaldoInicial · esPrincipal · esRemunerada · taeAnual · frecuenciaLiquidacion · cuentaDestinoIntereses · ultimosCuatro · limiteCredito · cuentaCargo · diaCierre · diaPago

# Localizar disparador del modal actual (botón "Nueva cuenta" en Tesorería)
grep -rnE "showAccountModal|setShowNuevaCuenta|openNuevaCuenta|<NewAccountModal" src/ --include="*.tsx" 2>/dev/null | head -10

# Verificar consumidores del store accounts
grep -rnE "accountsService\.list|listAccounts|accounts\.getAll" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20

# Verificar lectura de "esta cuenta es destino de qué nómina" (para badge en preview)
grep -rnE "ingresos\.cuentaDestino|nomina\.cuentaDestino|cuentaCobro" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Verificar si solo puede haber UNA cuenta principal · cómo se desactiva en las demás
grep -rnE "esPrincipal|cuentaPrincipal|isPrimary" src/services/ src/types/ --include="*.ts" 2>/dev/null | head -10

# Verificar enum/valores actuales de tipo
grep -rnE "tipo.*['\"]corriente['\"]|tipo.*['\"]ahorro['\"]|tipo.*['\"]tarjeta" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

#### Resultado esperado en commit
CC reporta en commit message ·
- Path exacto del modal actual · todos los componentes asociados
- Path del servicio `accountsService` · API completa (list · upsert · delete · etc)
- Schema TypeScript actual del tipo `Account` · qué campos hay · qué falta vs spec
- Cómo se gestiona "esPrincipal" · si solo puede haber una · cómo se desactiva en otras
- Valores actuales del enum `tipo` (probablemente `corriente | ahorro | otra | tarjeta_credito`)
- Dónde se usan las cuentas (selectores · listados Tesorería)
- Si existe campo "destino de nómina" o se calcula desde `ingresos.cuentaDestino`

#### Caso STOP
Si el modal actual está más entrelazado de lo previsto · si el schema de Account es muy distinto · STOP · documentar · esperar Jose.

---

### Sub-tarea 2 · Eliminación completa del modal actual

**Tiempo** · 20-30 min CC

#### Plan
1. Eliminar el modal actual identificado en sub-tarea 1 + componentes auxiliares solo usados ahí
2. **NO eliminar** ·
   - `accountsService` · se reusa
   - Store `accounts` · se reusa
   - Tipo TS global `Account` · se extiende (sub-tarea 3)
3. Mantener el disparador (botón "Nueva cuenta" en Tesorería) · solo cambia el componente que abre

#### Caso STOP
Si la eliminación rompe selectores u otras pantallas · STOP · listar dependencias · esperar Jose.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit message
- [ ] Modal actual eliminado
- [ ] `accountsService` + store + tipo global intactos
- [ ] App compila · build pasa · type check pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 3 · Implementación nueva pantalla única

**Tiempo** · 3-5h CC

#### Plan
Crear · `src/components/cuenta/CuentaWizard.tsx` (o ruta equivalente identificada en sub-tarea 1).

Disparado desde Tesorería al pulsar "Nueva cuenta" o "Editar cuenta" · modal full-screen.

**Layout estructural** · ver mockup `docs/mockups/atlas-wizard-cuenta-v3.html` como guía visual literal.

```
┌─ MODAL full-screen overlay ─────────────────────────────────────┐
│ ┌─ HEADER navy compacto ──────────────────────────────────────┐ │
│ │ [icono cuenta] Editar cuenta · Santander principal [X]      │ │
│ │              Corriente · IBAN ES61 ···· 2715 · ...          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─ COL FORM (1.4fr) ────────┬─ COL PREVIEW (1fr · bg-soft) ─┐ │
│ │ [B1 · Tipo de cuenta]      │  KPI Saldo inicial navy        │ │
│ │ [B2 · Identificación]      │  Vista en listado (avatar)     │ │
│ │ [B3 · Datos bancarios]     │  Badges roles especiales       │ │
│ │ [B4 · Saldo inicial]       │  KPI Movimientos (placeholder) │ │
│ │ [B5 · Cuenta remunerada]   │                                 │ │
│ └────────────────────────────┴─────────────────────────────────┘ │
│ ┌─ FOOTER ────────────────────────────────────────────────────┐ │
│ │ Cambios sin guardar · ...      [Cancelar] [Guardar cuenta]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Bloques · uno a uno**

#### Bloque 1 · Tipo de cuenta
3 cards horizontales · grid 3 columnas ·
1. Corriente
2. Ahorro
3. Tarjeta crédito

Selección = oro (gold-bg + gold border).

NO incluir Cripto · Broker (viven en módulo Inversiones).
NO mostrar hint sobre campos visibles · condicionalidad silenciosa.

**Visibilidad condicional según tipo** ·

| Tipo | Bloque 3 (Datos bancarios) | Bloque 4 (Saldo) | Bloque 5 (Remunerada) |
|---|---|---|---|
| **Corriente** | IBAN + BIC | Importe + fecha | Toggle disponible |
| **Ahorro** | IBAN + BIC | Importe + fecha | Toggle disponible |
| **Tarjeta crédito** | Últimos 4 dígitos · Banco emisor · Cuenta de cargo (select de cuentas existentes Corriente/Ahorro) · Día cierre · Día pago | Límite crédito + Deuda actual + fecha | OCULTO · no aplica |

#### Bloque 2 · Identificación
1 fila · 3 campos ·
- Alias (input · obligatorio)
- Banco / proveedor (select con catálogo de bancos · opción "Otro · escribir" al final · si selecciona Otro · aparece input texto adicional)
- Cuenta principal (toggle inline · solo una puede ser principal en todo ATLAS)

Catálogo de bancos · Santander · BBVA · Sabadell · ING · Unicaja · Abanca · Bankinter · Revolut · Carrefour Card · Caixabank · Kutxabank · Cajamar · Ibercaja · Otro.

**Lógica "Cuenta principal"** ·
- Solo una cuenta puede ser principal a la vez en todo ATLAS
- Al activar este toggle · si guarda · CC actualiza el flag a `false` en TODAS las demás cuentas en una transacción (consistencia)

#### Bloque 3 · Datos bancarios (varía según tipo)

**Si tipo = Corriente o Ahorro** ·
- IBAN (NO obligatorio · puede estar vacío)
- BIC / SWIFT (opcional)

**Si tipo = Tarjeta crédito** ·
- Últimos 4 dígitos (mono · max 4 chars)
- Banco emisor (select igual al bloque 2 · puede ser distinto al banco de la cuenta de cargo)
- Cuenta de cargo (select de cuentas existentes Corriente/Ahorro del usuario · obligatorio · de aquí se descontará la deuda al pagar)
- Día cierre (numérico · 1-31)
- Día pago (numérico · 1-31)

#### Bloque 4 · Saldo inicial

**Si tipo = Corriente o Ahorro** ·
- Importe (mono · sufijo €)
- A fecha (date · obligatorio)
- Hint · "El saldo inicial es el punto de partida desde el que ATLAS calcula el cashflow."

**Si tipo = Tarjeta crédito** ·
- Límite crédito (mono · sufijo €)
- Deuda actual (mono · sufijo € · puede ser 0)
- A fecha (date · obligatorio)
- Hint · "La deuda actual es lo que debes ahora mismo · se descontará en la próxima fecha de pago de la cuenta de cargo."

#### Bloque 5 · Cuenta remunerada (solo Corriente/Ahorro · OCULTO si Tarjeta crédito)

Toggle ON/OFF en header.

Si ON · 1 fila · 3 campos ·
- TAE anual (mono · sufijo %)
- Frecuencia liquidación (select · "Mensual" · "Trimestral" · "Semestral" · "Anual")
- Cuenta destino intereses (select de cuentas existentes · default "esta misma cuenta")

Hint debajo · cálculo live · "Intereses año estimados · {valor} € · liquidación {frecuencia}"

#### Bloque "Movimientos vinculados" del preview

**Decisión actual** · placeholder · se vuelve a discutir más adelante.

CC NO implementa cálculos reales · solo muestra "0 · cuenta nueva · sin movimientos" en modo create · y un texto neutro tipo "{N} movimientos vinculados" en modo edit usando `count(movements)` filtrado por `accountId`.

**Columna preview · live · siempre visible**

KPI principal navy · varía según tipo ·
- Corriente / Ahorro · "Saldo inicial · {valor} €" + sub "a fecha {fecha} · cuenta {tipo}"
- Tarjeta crédito · "Crédito disponible · {límite − deuda} €" + sub "Deuda actual {valor} € de {límite} € · paga el {díaPago} de cada mes"

Vista en listado · cómo aparecerá la cuenta ·
- Avatar circle · 2 letras del banco · color navy + letra oro
- Nombre · alias
- Meta · "{tipo} · ···· {últimos 4 IBAN o tarjeta}"
- Saldo (alineado derecha · mono bold)

Badges · solo si aplica ·
- Si esPrincipal · badge oro · "Cuenta principal · domiciliaciones por defecto · destino selectores nuevos"
- Si la cuenta es destino de alguna nómina (lectura cruzada con `ingresos`) · badge teal · "Recibe la nómina {empresa} · {importe} / mes"
- Si la cuenta es origen de alguna domiciliación recurrente importante · badge teal · "Pagas {N} domiciliaciones desde aquí" (opcional · si fácil de calcular)

KPI mini "Movimientos vinculados" · placeholder · ver decisión arriba.

**Footer**

- Texto izquierda (si cambios pendientes) · "Cambios sin guardar · al guardar la cuenta aparece en Tesorería y selectores"
- Botones derecha · "Cancelar" (ghost) + "Guardar cuenta" (primary gold + check icon)

**Cálculo live · función pura `calcularCuentaResumen()`**

Crear `src/services/cuentaCalculatorService.ts` ·

```ts
interface CuentaInput {
  tipo: 'corriente' | 'ahorro' | 'tarjeta_credito';
  saldoInicial?: number;
  limiteCredito?: number;
  deudaActual?: number;
  esRemunerada?: boolean;
  taeAnual?: number;
  frecuenciaLiquidacion?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
}

interface CuentaResumen {
  saldoInicialOCreditoDisponible: number;
  interesesAnualesEstimados?: number;
  interesesPorPeriodo?: number;
}

function calcularCuentaResumen(input: CuentaInput): CuentaResumen {
  // pura · sin efectos
}
```

**Paleta v8 estricta · cero hardcoded hex**

- Tokens CSS desde el design system
- Selección = oro en TODOS los elementos seleccionables
- Números en JetBrains Mono · títulos en Inter
- Sentence case · solo títulos de bloque en uppercase con letter-spacing alto

#### Criterios aceptación sub-tarea 3
- [ ] Mockup `docs/mockups/atlas-wizard-cuenta-v3.html` reproducido fielmente
- [ ] 5 bloques implementados · visibilidad condicional aplicada
- [ ] 3 tipos de cuenta funcionan · Corriente · Ahorro · Tarjeta crédito
- [ ] Preview live actualizado en tiempo real
- [ ] Función pura `calcularCuentaResumen()` con tests unitarios
- [ ] Cero hex hardcoded · 100% tokens CSS
- [ ] Build pasa · type check pasa · lint pasa
- [ ] Tests suites failing ≤ 43

---

### Sub-tarea 4 · Cableado fuentes y guardado

**Tiempo** · 1-1,5h CC

#### Plan
1. **Lectura · al abrir el wizard** ·
   - Si modo edit · cargar cuenta desde `accountsService.get(id)`
   - Cargar lista de cuentas existentes (para selector "Cuenta de cargo" en tarjetas y "Cuenta destino intereses" en remuneradas)
   - Cargar `ingresos` filtrado por `cuentaDestino === cuentaId` para badge "Recibe nómina X"
2. **Extender schema TypeScript de `Account`** · añadir si no existen ·
   ```ts
   bic?: string;
   esRemunerada?: boolean;
   taeAnual?: number;
   frecuenciaLiquidacion?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
   cuentaDestinoIntereses?: number; // FK a otra account
   // Específicos tarjeta crédito
   ultimosCuatro?: string;
   bancoEmisor?: string;
   cuentaCargoId?: number; // FK a otra account
   limiteCredito?: number;
   deudaActual?: number;
   diaCierre?: number;
   diaPago?: number;
   ```
3. **Guardado · al pulsar "Guardar cuenta"** ·
   - Validar campos obligatorios · errores claros en UI · IBAN NO obligatorio
   - **Lógica "esPrincipal"** · si el usuario activó este toggle ·
     - Transacción · actualizar TODAS las demás cuentas a `esPrincipal: false`
     - Guardar esta con `esPrincipal: true`
   - Llamar `accountsService.upsert(...)` con todos los campos
   - **NO escribir** en `ingresos` · `movements` · `treasuryEvents` desde aquí · son flujos separados

#### Caso STOP
Si la API de `accountsService` no soporta transacción para la lógica esPrincipal · STOP · documentar · esperar Jose (puede que CC implemente método `setPrincipal(id)` que haga la transacción · pero confirmar antes).

#### Criterios aceptación sub-tarea 4
- [ ] Schema TypeScript de `Account` extendido con campos nuevos
- [ ] IBAN NO obligatorio en validación
- [ ] Validaciones · campos obligatorios variables según tipo
- [ ] Guardado funcional · datos persistidos en `accounts`
- [ ] Lógica esPrincipal · solo una cuenta principal a la vez
- [ ] Cuenta de cargo (tarjeta) · FK validada (debe existir)
- [ ] Cuenta destino intereses · FK validada

---

### Sub-tarea 5 · QA visual + accesibilidad mínima

**Tiempo** · 30 min CC

#### Plan
1. Verificar visualmente contra mockup
2. Tab order coherente
3. Labels asociados a inputs
4. Botón cerrar accesible con teclado
5. Modal escapable con `Esc`
6. Cero hex hardcoded
7. Comprobar visibilidad condicional · cambiar entre los 3 tipos
8. Comprobar preview live · cambiar valores y ver actualización
9. Comprobar lógica esPrincipal · activar en una cuenta · verificar que se desactiva en otras

#### Criterios aceptación sub-tarea 5
- [ ] Cero hex hardcoded en componentes nuevos
- [ ] Tab order verificado
- [ ] Labels correctos
- [ ] Esc cierra modal
- [ ] Visibilidad condicional verificada para los 3 tipos
- [ ] Preview live se recalcula correctamente
- [ ] Lógica esPrincipal verificada manualmente
- [ ] Comparativa visual screenshot vs mockup pegada en commit

---

## §3 · Orden de ejecución

| Orden | Sub-tarea | Tiempo |
|---|---|---|
| 1 | Pre-flight | 30-45 min |
| 2 | Eliminación modal actual | 20-30 min |
| 3 | Implementación pantalla única | 3-5h |
| 4 | Cableado fuentes + guardado | 1-1,5h |
| 5 | QA visual + accesibilidad | 30 min |

**Total** · 5-8h CC.

---

## §4 · Reglas inviolables

1. NO reutilizar código del modal actual · eliminación completa
2. NO subir DB_VERSION · sigue v70
3. **IBAN NO obligatorio** · validación lo deja pasar vacío
4. NO incluir Cripto · Broker · Pensión · Otro como tipos · solo Corriente · Ahorro · Tarjeta crédito
5. NO incluir bloque Documentos · viven en módulo Archivo
6. NO escribir en `ingresos` · `movements` · `treasuryEvents` desde este wizard
7. NO mostrar hint sobre campos visibles según tipo · condicionalidad silenciosa
8. NO mergear · stop-and-wait
9. Selección visual = oro en TODOS los elementos seleccionables
10. Mockup `docs/mockups/atlas-wizard-cuenta-v3.html` es referencia visual literal
11. Cero hex hardcoded · 100% tokens CSS
12. Función `calcularCuentaResumen()` pura · sin efectos · con tests unitarios
13. Sentence case
14. Solo UNA cuenta principal en todo ATLAS · transacción al guardar

---

## §5 · Criterios de aceptación globales

- [ ] 5 sub-tareas ejecutadas en orden
- [ ] Pre-flight pegado en commit message de sub-tarea 1
- [ ] 1 PR final único contra `main` con commits separados por sub-tarea
- [ ] PR description con tabla resumen + screenshots vs mockup para los 3 tipos
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] DB_VERSION sigue 70
- [ ] **Usuario abre Tesorería · pulsa "Nueva cuenta" · ve modal nuevo · 1 sola pantalla · puede crear y editar · datos persisten · cálculos en tiempo real · cuenta aparece en listado**

---

## §6 · Validación manual Jose tras merge

1. Abrir Tesorería · pulsar "Nueva cuenta"
2. Verificar layout · 2 columnas · header navy · footer fijo
3. Cambiar tipo entre Corriente · Ahorro · Tarjeta crédito · verificar que bloques aparecen/desaparecen correctamente
4. Caso Corriente · introducir datos Santander 2715 del mockup · IBAN sin asterisco
5. Dejar IBAN vacío · verificar que NO bloquea el guardado
6. Activar "Cuenta principal" · si ya había otra principal · al guardar verificar que la otra queda como NO principal
7. Activar "Cuenta remunerada" · introducir TAE 2,5% · verificar cálculo live de intereses año
8. Cambiar a Tarjeta crédito · verificar que aparece selector "Cuenta de cargo" · día cierre · día pago · y desaparecen IBAN/BIC y bloque remunerada
9. Guardar
10. Verificar cuenta aparece en listado de Tesorería con avatar y badges correctos
11. Volver a editar · verificar persistencia
12. Si cuenta es destino de alguna nómina · verificar badge teal "Recibe nómina X" en preview

---

## §7 · Lo que NO entra en este lote

- Cuentas tipo Cripto · Broker (módulo Inversiones)
- Adjuntar documentos (módulo Archivo)
- Recálculo automático de "Movimientos vinculados" (placeholder por ahora · spec aparte cuando decidamos qué mostrar)
- Wizards siguientes (autónomo · gasto recurrente · contrato · plan pensión · préstamo)
- TAREA 14 · configuración fiscal sitio único

---

## §8 · Patrón sentado · refuerza el de wizard nómina + inmueble

Tras este wizard mergeado · queda confirmado el patrón ATLAS v8 ·

| Patrón | Aplica en |
|---|---|
| 1 sola pantalla · modal full-screen · sin pasos | Todos los wizards |
| 2 columnas · form izquierda + preview live derecha | Todos los con cálculo |
| Bloques compactos · campos en fila · sin subtítulos | Todos |
| Selección = oro · paleta v8 estricta | Todos |
| Visibilidad condicional silenciosa según selectores | Wizards con sub-tipos |
| Vista previa de cómo se verá en listados | Wizards de entidades visibles en listados (cuenta · inmueble · plan pensión · etc.) |
| Función pura `calcularXResumen()` con tests | Todos los con cálculo |

---

**Fin del spec.**
**Listo para entregar a CC tras Jose subir `atlas-wizard-cuenta-v3.html` a `docs/mockups/`.**
