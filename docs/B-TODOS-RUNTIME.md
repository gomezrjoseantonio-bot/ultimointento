# B-TODOS-RUNTIME · cerrar 3 derivaciones runtime declaradas como TODO

> **Tipo** · Feature pequeña · 3 sub-tareas independientes
> **Tiempo estimado total** · 30-60 min CC
> **Cierra** · TAREA 10 backlog post-T7 V11 §3 Tabla 1
> **Reglas aplicadas** · idénticas a D-CRUD-ALTA + V11.6 + V11.7
> **Patrón ejecución** · igual que PR #1308 D-CRUD-ALTA · encadenar sub-tareas en una rama · commit por sub-tarea · 1 PR final único

---

## §0 · Reglas operativas obligatorias

Mismo §0 que D-CRUD-ALTA · resumen ·

1. **Pre-flight propio en cada sub-tarea** · NO confiar en handoff o backlog · grep duro EN EL MOMENTO
2. **Si pre-flight revela TODO ya cerrado** (ej · alguien lo implementó en otro PR sin actualizar handoff) · STOP · marcar N/A
3. **Si comentario `// TODO TAREA 7-X` no existe ya** · es muy posible que la derivación ya esté implementada · marcar N/A
4. **NO propagar urgencia basada en comentario** · regla V11.6
5. **Encadenar sub-tareas en una rama** · commit por sub-tarea · 1 PR final · NO mergear · esperar Jose
6. **NO arreglar 43 tests failing pre-existing** · solo no degradar
7. **DB sigue v70** · NO upgrade · NO migración

**Antecedente** · Estimación 30-60 min CC asume 0-1 N/A. Si las 3 son N/A · cierre rápido en 15-20 min · spec se queda como verificación. Está bien · es el patrón V11.6.

---

## §1 · Contexto

T7 (limpieza V60) eliminó stores derivables y dejó 3 cálculos runtime declarados como `// TODO TAREA 7-X` en código. TAREA 10 backlog dice cerrarlos · pendiente desde abril 2026. Pantallas que los consumen muestran datos parciales hoy.

DB v70 · 40 stores · NO upgrade en este spec.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · `valoraciones_mensuales` derivada de `valoraciones_historicas`

#### Pre-flight
```bash
# Buscar el TODO
grep -rnE "TODO.*TAREA.*7|TODO.*valoraciones_mensuales|valoraciones_mensuales.*derivar" src/ --include="*.ts" --include="*.tsx" 2>/dev/null

# Verificar que el store NO existe (debe estar derivado runtime)
grep -nE "'valoraciones_mensuales'" src/services/db.ts src/database/initDB.ts 2>/dev/null

# Servicio relacionado
grep -rnE "valoracionesMensuales|getValoracionesMensuales" src/services/ 2>/dev/null

# Pantallas que consumen
grep -rnE "valoraciones_mensuales|valoracionesMensuales" src/modules/ src/components/ --include="*.tsx" 2>/dev/null | head -10
```

#### Caso N/A
Si ningún match en `// TODO` · derivación ya implementada · marcar N/A · documentar dónde · cerrar.

#### Plan si TODO existe
1. Crear/completar función `getValoracionesMensuales(entityType, entityId, año)` que ·
   - Lee `valoraciones_historicas` filtradas por `entityType` + `entityId` + año
   - Agrupa por mes · 12 entradas
   - Si un mes no tiene valoración · usa la última conocida (carry forward) o `null` según regla del módulo que consume
2. Sustituir lecturas directas a `valoraciones_mensuales` por llamadas a la función
3. Eliminar `// TODO TAREA 7-X` correspondiente

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Función expuesta · TypeScript tipado · sin `any`
- [ ] Pantallas que la consumen muestran datos completos
- [ ] TODO eliminado

---

### Sub-tarea 2 · `patrimonioSnapshots` derivada de `valoraciones_historicas`

#### Pre-flight
```bash
grep -rnE "TODO.*patrimonioSnapshots|patrimonioSnapshots.*derivar" src/ --include="*.ts" --include="*.tsx" 2>/dev/null

# Confirmar que store NO existe
grep -nE "'patrimonioSnapshots'" src/services/db.ts src/database/initDB.ts 2>/dev/null

# Servicio + consumidores
grep -rnE "patrimonioSnapshots|getPatrimonioSnapshot" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -15
```

#### Caso N/A
Idéntico a sub-tarea 1 · si TODO no existe · N/A.

#### Plan si TODO existe
1. Función `getPatrimonioSnapshot(fecha)` que devuelve foto del patrimonio en una fecha dada ·
   - Suma valoración de cada inmueble en la fecha (de `valoraciones_historicas` con carry forward)
   - Suma valoración de inversiones en la fecha (`inversiones`)
   - Suma cuentas (`accounts.balance` o cálculo desde `movements` · CC decide canónica)
   - Resta deuda viva préstamos (`prestamos` + planpagos)
2. Output · objeto con desglose · usable por dashboard · panel patrimonial · gráficas
3. Eliminar TODO

#### Criterios aceptación
- Igual que sub-tarea 1

---

### Sub-tarea 3 · `treasuryRecommendations` cálculo runtime

#### Pre-flight
```bash
grep -rnE "TODO.*treasuryRecommendations|treasuryRecommendations.*runtime" src/ --include="*.ts" --include="*.tsx" 2>/dev/null

# Confirmar store NO existe
grep -nE "'treasuryRecommendations'" src/services/db.ts src/database/initDB.ts 2>/dev/null

# Servicio + consumidores
grep -rnE "treasuryRecommendations|getTreasuryRecommendations" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -15
```

#### Caso N/A
Idéntico · si TODO no existe · N/A.

#### Plan si TODO existe
1. Función `getTreasuryRecommendations(accountIds?, horizonteDias?)` que ·
   - Lee `accounts` (saldos actuales)
   - Lee `treasuryEvents` futuros próximos N días (default 90)
   - Calcula proyección saldo por cuenta
   - Detecta cuentas en rojo · oportunidades de barrido a cuenta de ahorro · etc.
2. Output · array de recomendaciones tipadas · severity (info/warning/alert)
3. Pantallas que la consumen (probablemente Tesorería · Panel) cablean
4. Eliminar TODO

#### Criterios aceptación
- Igual que sub-tarea 1

---

## §3 · Orden de ejecución

| Orden | Sub-tarea | Tiempo |
|---|---|---|
| 1 | `valoraciones_mensuales` derivada | 10-20 min |
| 2 | `patrimonioSnapshots` derivada | 10-20 min · usa la función de sub-tarea 1 |
| 3 | `treasuryRecommendations` runtime | 10-20 min · independiente |

Encadenadas · sub-tarea 2 puede reusar función de sub-tarea 1.

**Estimación realista** · 30-60 min CC · si todas N/A · 15 min de verificación.

---

## §4 · Reglas globales

1. CC arranca por sub-tarea 1 · sigue orden
2. Pre-flight pegado en commit message
3. Encadenar en una rama · 1 PR final único
4. NO mergear · esperar Jose
5. Si pre-flight revela TODO inexistente · N/A · documentar
6. NO consolidar lógica relacionada fuera de scope (saneamientos = otros specs)
7. NO arreglar 43 tests failing pre-existing
8. DB sigue v70

---

## §5 · Criterios de aceptación globales

- [ ] 3 sub-tareas ejecutadas o marcadas N/A con justificación
- [ ] 1 PR final con commits por sub-tarea
- [ ] PR description con tabla resumen · estado de cada sub-tarea
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] 0 `// TODO TAREA 7-X` restantes en código (o documentación de por qué algunos quedan)

---

## §6 · Tras merge

| Siguiente | Tiempo |
|---|---|
| TAREA 9 · bootstrap `compromisosRecurrentes` (sigue valor para cliente nuevo) | 30-60 min CC |
| TAREA 8 · activar 9 campos huérfanos del schema | 1-2h CC |
| TAREA 12 · mapeo component→data | 2-3h CC |
| Después · cada duplicidad con audit dedicado (regla V11.7) o volver a estratégico C-PROY-5 motor 20 años | variable |

---

**Fin del spec.**
**Listo para entregar a CC tras merge D-CRUD-MEDIA.**
