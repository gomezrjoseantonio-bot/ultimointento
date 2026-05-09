# T-BACKLOG-V11-AUDIT · verificar estado real TAREAs 8 y 12 del backlog post-T7

> **Tipo** · Auditoría dedicada · CERO código modificado · CERO migraciones · solo informe
>
> **Tiempo estimado** · 30-60 min CC · si pasa de 90 min · DETENERSE
>
> **Output** · 1 archivo nuevo · `docs/audits/T-BACKLOG-V11-AUDIT-INFORME.md`
>
> **Cierra** · regla V11.8 · cualquier ítem del backlog V11 §3 Tabla 1 con >2 versiones DB de antigüedad sin verificación · audit corto antes de spec implementación
>
> **Bloquea** · cualquier spec de implementación sobre TAREA 8 o TAREA 12 · sin este audit el alcance saldría contra suposiciones

---

## §0 · Lente del audit · V11.8 literal

> **Lección Jose 2026-05-09 sesión V11** · TAREA 10 estaba cerrada desde V62 · 8+ versiones DB antes de v70 · backlog V11 §3 Tabla 1 lo seguía marcando pendiente · si CC hubiera lanzado spec implementación · habría construido 3 funciones duplicadas. Validación al 100%.

Misma sospecha aplica a ·

- **TAREA 8** · "9 campos añadidos en T7 sub-1 sin lógica detrás" · marcado pendiente desde abril 2026 · pueden estar usados ya
- **TAREA 12** · "mapeo component→data sin hacer" · T20 saneó muchos módulos · puede estar resuelto parcial o totalmente

**Regla operativa V11.8** · NO redactar spec implementación de estas 2 TAREAs sin audit verificando estado real. Este audit confirma qué sigue siendo deuda · qué se cerró sin documentar.

NO incluye TAREA 9 (bootstrap compromisos) porque T-COMPROMISOS-AUDIT lo cubre en paralelo.

---

## §1 · Contexto

Backlog V11 §3 Tabla 1 lista 4 TAREAs post-T7 ·

| TAREA | Estado V11 nominal | Estado real |
|---|---|---|
| 8 · 9 campos huérfanos | 1-2h CC pendiente | Verificar |
| 9 · bootstrap compromisos | 30-60min CC pendiente | T-COMPROMISOS-AUDIT en curso |
| 10 · TODOs runtime | 30-60min CC pendiente | ✅ N/A confirmada B-TODOS-RUNTIME · cerrada V62 |
| 12 · component→data | 2-3h CC pendiente | Verificar |

DB v70 · 40 stores · sin upgrade en este audit.

---

## §2 · Pre-flight obligatorio · CC ejecuta y pega output literal

### §2.1 · TAREA 8 · 9 campos huérfanos · descubrir todos los campos sospechosos

V11.4 aplica · NO dar lista cerrada · CC descubre.

```bash
# Identificar campos añadidos en T7 sub-1 que pudieron quedar huérfanos
# Mirar tipos en types/db.ts vs uso real
grep -nE "balance\?|historicoRentas|origen\??:|metadata\??:|liquidacion\??:|history\??:" src/types/db.ts 2>/dev/null | head -30
```

Para CADA campo sospechoso descubierto · CC ejecuta plantilla siguiente · y para los 6 listados en V11 explícitamente ·

```bash
# Plantilla por campo · sustituir {storeName} y {campo}

# Campo 1 · accounts.balance
grep -rnE "\.balance" src/services/account*.ts 2>/dev/null | head -10
grep -rnE "accounts.*balance|balance.*accounts" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Campo 2 · contracts.historicoRentas[]
grep -rnE "historicoRentas" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -15

# Campo 3 · arrastresIRPF.origen
grep -rnE "arrastresIRPF.*origen|origen.*arrastres" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Campo 4 · documents.metadata.tipo
grep -rnE "metadata\.tipo|tipo.*documents.*metadata" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Campo 5 · prestamos.liquidacion
grep -rnE "prestamos.*liquidacion|liquidacion.*prestamo" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Campo 6 · movementLearningRules.history[]
grep -rnE "movementLearningRules.*history|history\[\]" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

CC documenta · escritores · lectores · UI por cada campo.

### §2.2 · TAREA 12 · component→data · descubrir módulos sospechosos

```bash
# Módulos donde el riesgo de inconsistencia es típico · Mi Plan · Tesorería · Inmuebles
find src/modules/horizon/mi-plan/ src/modules/v5/mi-plan/ -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | head -20
find src/modules/horizon/tesoreria/ src/modules/v5/tesoreria/ -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | head -20
find src/modules/horizon/inmuebles/ src/modules/v5/inmuebles/ -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | head -20
```

```bash
# Verificar si cada componente tiene su propia llamada a stores · o pasa por servicio centralizador
grep -rnE "db\.get\(|db\.getAll\(" src/modules/horizon/mi-plan/ src/modules/v5/mi-plan/ 2>/dev/null | head -20
grep -rnE "db\.get\(|db\.getAll\(" src/modules/horizon/tesoreria/ src/modules/v5/tesoreria/ 2>/dev/null | head -20
grep -rnE "db\.get\(|db\.getAll\(" src/modules/horizon/inmuebles/ src/modules/v5/inmuebles/ 2>/dev/null | head -20
```

```bash
# Buscar TODOs T20 o T12 sin cerrar
grep -rnE "TODO.*T20|TODO.*T12|TODO.*component.*data|TODO.*centralizar" src/ 2>/dev/null | head -20
```

```bash
# Detectar valores hardcoded que podrían ser inconsistentes (Mi Plan · KPIs)
grep -rnE "100\.000|patrimonioTotal|valorTotal" src/modules/horizon/mi-plan/ src/modules/v5/mi-plan/ 2>/dev/null | head -15
```

---

## §3 · Output esperado · estructura informe

CC crea `docs/audits/T-BACKLOG-V11-AUDIT-INFORME.md` con esta estructura ·

### §A · TAREA 8 · campos huérfanos · matriz por campo

Tabla por cada campo descubierto en §2.1 · 7 columnas ·

| Campo | ¿En type TS? | ¿Servicio escribe? | ¿Servicio lee? | ¿UI muestra? | Veredicto | Spec necesario |
|---|---|---|---|---|---|---|

Veredicto · uno de ·
- ✅ ACTIVO · campo usado correctamente · N/A
- 🟡 PARCIAL · falta una pieza (ej · servicio escribe pero UI no muestra)
- ❌ HUÉRFANO · campo en type sin servicio ni UI · candidato a eliminar o activar
- 🗑️ ELIMINADO · campo ya no existe en types · backlog desactualizado

Mínimo 9 filas (los campos de V11 explícitos) · más cualquier descubierto.

### §B · TAREA 12 · component→data · matriz por módulo

Tabla por módulo (Mi Plan · Tesorería · Inmuebles · más cualquier descubierto) · 5 columnas ·

| Módulo | ¿Hay servicio centralizador? | ¿Cuántos componentes leen directo de db? | ¿Riesgo inconsistencia detectado? | Veredicto |
|---|---|---|---|---|

Veredicto · uno de ·
- ✅ SANEADO · servicio centralizador · componentes consumen vía servicio · OK
- 🟡 PARCIAL · algunos componentes saneados · otros leen directo · gap parcial
- ❌ INCONSISTENTE · cada componente decide store · riesgo confirmado
- 🗑️ T20 PARTE 1 lo cerró · backlog desactualizado

### §C · Veredicto · alcance del trabajo necesario

CC propone una de estas 4 rutas ·

- **R1 · Ambas TAREAs cerradas** · 8 y 12 son N/A · cerrar formalmente · backlog actualizado
- **R2 · TAREA 8 con N campos reales** · spec activar campos · alcance N × 30min
- **R3 · TAREA 12 con N módulos reales** · spec saneamiento component→data · alcance variable
- **R4 · Ambas con trabajo real** · 2 specs separados · estimación combinada

Resumen ejecutivo · 5 líneas para PR description.

---

## §4 · Reglas de ejecución

1. **CERO código modificado** · solo informe
2. **Pegar output LITERAL** de comandos del §2
3. **Aplicar V11.4** · descubrir TODOS los campos sospechosos · NO solo los 6 explícitos en spec
4. **NO confiar en backlog V11** · cada campo y módulo verificado en grep
5. **Stop-and-wait** · CC abre PR · NO mergea · espera Jose
6. **Si campo NO existe en types** (ej · accounts.balance fue eliminado) · marcar 🗑️ ELIMINADO · documentar versión DB que lo eliminó si posible
7. **Si TODO T20 sigue activo** · documentar · es deuda separada · NO entrar a sanear ahí
8. **Tiempo estimado** · 30-60 min CC · si pasa de 90 min · DETENERSE

---

## §5 · Criterios de aceptación

- [ ] Pre-flight §2 ejecutado · output pegado literal
- [ ] §A · matriz campos huérfanos · mínimo 9 filas
- [ ] §B · matriz component→data · mínimo 3 módulos (Mi Plan · Tesorería · Inmuebles)
- [ ] §C · veredicto R1/R2/R3/R4 · justificado
- [ ] PR contra `main` con UN solo archivo
- [ ] PR description con resumen ejecutivo · 5 líneas

---

## §6 · Tras merge

| Veredicto | Acción Jose+Claude |
|---|---|
| R1 · ambas N/A | Backlog V11 §3 Tabla 1 · TAREAs 8 y 12 marcadas cerradas · cerrar también si T-COMPROMISOS deja TAREA 9 N/A · todo el bloque post-T7 cierra |
| R2 · TAREA 8 con N campos | Spec activar campos · N × 30min CC · encadenar |
| R3 · TAREA 12 con N módulos | Spec saneamiento component→data · alcance según N · puede ser grande |
| R4 · ambas con trabajo | 2 specs separados · empezar por la más rápida |

---

**Fin del spec.**
**Listo para entregar a CC.**
