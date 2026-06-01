# Modelo de alquileres v3 · botes, conciliación e histórico fiscal

Documento de referencia del modelo de datos y flujos del módulo de alquileres v3
(import XML AEAT, conciliación de rentas declaradas e histórico fiscal del
inmueble). Complementa la auditoría base
(`docs/audit/wizard-import-alquileres-auditoria.md`).

## 1 · Dos caminos al importar la declaración AEAT

Al importar la declaración de la AEAT, cada bloque `<Arrendamiento>` se enruta por
uno de dos caminos:

- **Camino 1 · Contract identificado.** Vivienda completa con NIF claro → se crea
  (o actualiza) un `Contract` real. Su historia fiscal por ejercicio vive en
  `Contract.ejerciciosFiscales[año]` (`importeDeclarado`, `nifsDetectados`,
  `estado`, `fuente`). Es la "gestión normal".
- **Camino 2 · Bote anual sin identificar.** Rentas que NO pudieron asociarse a un
  Contract al importar (sin NIF, por habitaciones, mixtas o no-vivienda) → se
  acumulan en un `BoteAnualSinIdentificar` por `(inmuebleId · año)`. El usuario las
  concilia después vinculando los Contracts reales que las cubren.

## 2 · El bote es transitorio

Un bote existe **solo** porque, cuando se generaron esos ingresos, ATLAS no estaba
en uso y no había contratos que los identificaran. Es una herramienta de
migración, no un registro permanente.

- Estados: `pendiente_total` → `parcial` → `cerrado` (y `sobre_asignado` si se
  asigna de más). Derivados de `importeDeclarado` vs `importeAsignado`
  (`boteAnualService.derivarEstado`).
- Cuando un bote llega a **`cerrado`** (saldo pendiente ≈ 0), **desaparece** de la
  pestaña "Por conciliar" de `/contratos` (filtro `estado !== 'cerrado'`). El badge
  contador de la pestaña cuenta solo los visibles (incluye `sobre_asignado`).
- **No se elimina de la BD**: queda archivado (idempotente, sin marcha atrás
  peligrosa), solo invisible en "Por conciliar".
- Cuando el usuario concilia todas sus declaraciones, la pestaña muestra el empty
  state "Todo conciliado". A partir de ahí ATLAS registra los ingresos en tiempo
  real desde los contratos y no se generan más botes.

## 3 · El histórico fiscal vive en el detalle del inmueble

El histórico fiscal declarado es **permanente** y se muestra en el tab Fiscalidad
del detalle de cada inmueble (`SeccionHistoricoFiscal`).

- Se construye con `obtenerHistoricoFiscalInmueble(inmuebleId)`: lectura cruzada
  año a año (descendente) que mergea **todos** los botes del inmueble (incluido
  `cerrado`) con los Contracts Camino 1 que tengan `ejerciciosFiscales`.
- El bote `cerrado` está oculto en "Por conciliar" pero **sí se lee aquí**: el
  filtro de estado aplica únicamente a la lista de "Por conciliar", no a otras
  vistas.
- No hay migración ni duplicación: **el bote (y `Contract.ejerciciosFiscales`) es
  la fuente de verdad siempre**. El histórico fiscal lee directamente de ellos.

## 4 · El Contract NO guarda aportes a declaraciones

Decisión de producto: un `Contract` **no** almacena a qué bote/ejercicio aportó.
Al inversor no le aporta valor saber "este contrato aportó 640 € a la declaración
2023". Quien sabe qué contratos cubrieron qué declaración es **el inmueble**, en su
sección de histórico fiscal, año a año. No existen campos tipo
`aportesAEjerciciosFiscales` en `Contract` y no deben crearse.

## 5 · Helper reutilizable

`src/utils/contractDisplay.ts` resuelve el nombre legible de un Contract desde su
id con una cadena de fallbacks (`nombre + apellidos` → `DNI <dni>` →
`Contrato #<id>`). Lo consumen tanto el drawer de conciliación ("Contratos
vinculados") como la sección de histórico fiscal, que solo guardan `contractId`.

## 6 · Apuntes futuros (fuera de alcance)

- Soporte de los 4 tipos Rentila (sesión propia).
- KPI "libres ahora" · limpieza.
- Duplicación `inquilino` vs `tenant` en `Contract` · limpieza.
- Los botes `cerrado` no se purgan de BD; si en el futuro se desea, sería una tarea
  de mantenimiento explícita y opcional.
