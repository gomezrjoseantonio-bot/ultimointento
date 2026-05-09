# S-APP-QUITAR-BUSCADOR-GLOBAL · buscador topbar solo en Panel · resto de la app sin él

> **Tipo** · Cambio global UI · 2 sub-tareas
> **Tiempo estimado total** · 1-2h CC
> **Cierra** · decisión Jose 2026-05-09 · "el buscador me sobra prácticamente en toda la app · solo se queda en Panel"
> **Reglas aplicadas** · idénticas a specs previos · V11.6 + V11.7
> **Patrón ejecución** · encadenar sub-tareas en una rama · commit por sub-tarea · 1 PR final único

---

## §0 · Reglas operativas obligatorias

1. **Pre-flight propio en cada sub-tarea** · grep duro EN EL MOMENTO · NO confiar en supuestos
2. **Si pre-flight revela que el buscador YA solo vive en Panel** · STOP · marcar N/A · documentar
3. **NO INVENTAR arquitectura** · si el buscador vive en un Topbar compartido · respetar y usar mecanismo de control existente o el más coherente con la app
4. **Encadenar sub-tareas en una rama** · commit por sub-tarea · 1 PR final · NO mergear · esperar Jose
5. **NO arreglar 43 tests failing pre-existing** · solo no degradar
6. **DB sigue v70** · NO upgrade
7. **NO TOCAR lógica del buscador** · no eliminar el componente · solo decidir dónde se renderiza

---

## §1 · Contexto

Jose ha decidido · el buscador global topbar (input "Buscar inmueble · contrato · movimiento... ⌘K") solo tiene sentido en Panel/Dashboard como entrada global de búsqueda transversal. En el resto de módulos (Inmuebles · Inversiones · Tesorería · Financiación · Personal · Contratos · Mi Plan · Fiscal · Archivo · Ajustes) NO aporta · ocupa espacio · se elimina.

DB v70 · NO upgrade.

---

## §2 · Sub-tareas en orden

### Sub-tarea 1 · Localizar buscador global y mecanismo de renderizado

**Tiempo** · 30 min CC

#### Pre-flight obligatorio
```bash
# Localizar el componente del buscador global
grep -rnE "Buscar inmueble|Buscar.*contrato|Buscar.*movimiento|⌘K|cmdk" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -20

# Localizar topbar / layout compartido
find src/ -type f \( -name "Topbar*" -o -name "TopBar*" -o -name "AppLayout*" -o -name "MainLayout*" -o -name "*Layout.tsx" \) 2>/dev/null | head -10

# Localizar dónde se importa o renderiza
grep -rnE "import.*[Tt]opbar|<[Tt]opbar|<[Tt]opBar" src/ --include="*.tsx" 2>/dev/null | head -15

# Verificar si hay routing centralizado
find src/ -type f \( -name "App.tsx" -o -name "Routes.tsx" -o -name "routes.ts" \) 2>/dev/null | head -5

# Detectar si ya hay alguna prop tipo showSearch · hideSearch · etc
grep -rnE "showSearch|hideSearch|searchEnabled|globalSearch" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -10
```

#### Resultado esperado
CC reporta en commit ·
- Componente del buscador (archivo + línea)
- Componente topbar/layout que lo renderiza
- Cómo se renderiza · siempre? · condicional?
- Mecanismo de control existente · si lo hay

---

### Sub-tarea 2 · Aplicar el cambio · buscador solo en Panel

**Tiempo** · 30 min - 1.5h CC

#### Decisión técnica · CC propone con justificación
Según lo que detecte el pre-flight de la sub-tarea 1 · CC elige uno de estos mecanismos ·

| Mecanismo | Cuándo |
|---|---|
| **A · Prop `showSearch` en Topbar** | Si Topbar es componente compartido con renderizado condicional fácil · cada layout/route decide |
| **B · Whitelist de rutas en el propio Topbar** | Si Topbar se renderiza globalmente · check de `useLocation().pathname === '/panel'` para mostrar |
| **C · Mover buscador a componente PanelTopbar específico** | Si Panel tiene su propio layout · simplificar |

CC justifica decisión en commit (1 párrafo) · usa el más coherente con la app existente · NO inventa nuevo patrón si hay uno establecido.

#### Plan
1. Aplicar el mecanismo elegido
2. Verificar que en Panel SÍ aparece el buscador (incluyendo atajo ⌘K si existe)
3. Verificar que en TODOS los demás módulos NO aparece ·
   - `/inmuebles` · `/inversiones` · `/tesoreria` · `/tesoreria/cuenta/:id` · `/tesoreria/importar`
   - `/financiacion` · `/personal` · `/contratos` · `/mi-plan` · `/fiscal` · `/archivo` · `/ajustes`
   - Sub-rutas de cada módulo si las tienen
4. Espacio liberado · NO añadir nada en su lugar · simplemente la zona queda con notif + ayuda (si existen) o vacía

#### Caso N/A
Si el buscador YA solo aparece en Panel · STOP · documentar · marcar N/A.

#### Criterios aceptación
- [ ] Pre-flight pegado en commit
- [ ] Decisión técnica justificada (1 párrafo en commit)
- [ ] Buscador visible en Panel (con ⌘K si existe)
- [ ] Buscador NO visible en resto de módulos verificados (lista §6)
- [ ] Build pasa · type check pasa · lint pasa
- [ ] Tests · suites failing ≤ 43

---

## §3 · Orden de ejecución

| Orden | Sub-tarea | Tiempo |
|---|---|---|
| 1 | Localizar buscador y mecanismo | 30 min |
| 2 | Aplicar cambio · solo Panel | 30 min - 1.5h |

**Total** · 1-2h CC.

---

## §4 · Reglas globales

1. CC arranca por sub-tarea 1 · pre-flight informa decisión sub-tarea 2
2. Pre-flight pegado en commit message
3. Encadenar en una rama · 1 PR final único
4. NO mergear · esperar Jose
5. NO TOCAR lógica del buscador · solo dónde se renderiza
6. NO INVENTAR mecanismo nuevo si la app ya tiene patrón
7. NO arreglar 43 tests failing pre-existing
8. DB sigue v70

---

## §5 · Criterios de aceptación globales

- [ ] 2 sub-tareas ejecutadas o marcadas N/A con justificación
- [ ] 1 PR final con commits por sub-tarea
- [ ] PR description con tabla resumen estado
- [ ] Tests suites failing ≤ 43
- [ ] Build pasa · lint pasa · type check pasa
- [ ] DB_VERSION sigue 70
- [ ] **Cero cambios en lógica del buscador** · solo cambia su renderizado

---

## §6 · Tras merge · validación manual Jose

Recorrer todas las rutas y verificar ·

| Ruta | Buscador esperado |
|---|---|
| `/panel` | ✅ visible |
| `/inmuebles` y subrutas | ❌ NO visible |
| `/inversiones` y subrutas | ❌ NO visible |
| `/tesoreria` | ❌ NO visible |
| `/tesoreria/importar` | ❌ NO visible |
| `/financiacion` | ❌ NO visible |
| `/personal` | ❌ NO visible |
| `/contratos` | ❌ NO visible |
| `/mi-plan` | ❌ NO visible |
| `/fiscal` | ❌ NO visible |
| `/archivo` | ❌ NO visible |
| `/ajustes` | ❌ NO visible |
| `/configuracion/proveedores` y otras de configuración | ❌ NO visible |

Si todas pasan · cambio cerrado.

---

## §7 · Próximos specs

| # | Spec | Tiempo CC | Cuándo |
|---|---|---|---|
| 2 | S-TESORERIA-FASE-B-VISTA-GENERAL | 6-10h | En paralelo · Claude redacta mientras CC trabaja en este |
| 3 | S-TESORERIA-FASE-B-VISTA-CUENTA | 8-12h | En paralelo · Claude redacta mientras CC trabaja en este |

---

**Fin del spec.**
**Listo para entregar a CC.**
