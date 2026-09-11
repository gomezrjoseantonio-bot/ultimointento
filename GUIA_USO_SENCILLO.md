# 📘 Guía de Uso Sencillo - ATLAS App

> Guía visual para uso intuitivo de ATLAS Horizon & Pulse

## 🎯 Filosofía de Diseño

ATLAS está diseñado para ser **simple, directo e intuitivo**:

- ✅ **Navegación clara**: Menú lateral con iconos descriptivos
- ✅ **Flujos lineales**: Wizards paso a paso para tareas complejas
- ✅ **Feedback inmediato**: Toasts y confirmaciones visuales
- ✅ **Ayuda contextual**: Tooltips y estados vacíos informativos
- ✅ **Colores consistentes**: Tokens ATLAS en toda la app

---

## 🚀 Primeros Pasos

### 1. Selección de Módulo

Al iniciar, elige tu módulo:

```
┌─────────────────────────────────────┐
│  🏢 HORIZON - Gestión Inmobiliaria  │
│  🔷 PULSE - Gestión Empresarial     │
└─────────────────────────────────────┘
```

**Horizon**: Para gestión de propiedades, inquilinos, tesorería
**Pulse**: Para gestión empresarial, facturación, proveedores

---

## 🏢 ATLAS HORIZON - Flujos Principales

### 📋 Flujo 1: Agregar un Inmueble

**Navegación**: Horizon → Inmuebles → Cartera → `+ Nuevo Inmueble`

**Pasos**:
1. Hacer clic en botón `+ Nuevo Inmueble` (azul, esquina superior derecha)
2. Completar formulario:
   - **Alias**: Nombre corto (ej: "Piso Centro")
   - **Dirección completa**: Calle, número, CP, ciudad
   - **Tipo**: Piso, Local, Garaje, etc.
   - **Fecha de compra** (opcional)
   - **Valor de compra** (opcional)
3. Hacer clic en `Guardar` (botón azul)
4. ✅ Toast verde confirma: "Inmueble creado correctamente"

**Resultado**: El inmueble aparece en la tabla de cartera

---

### 📋 Flujo 2: Crear un Contrato de Alquiler

**Navegación**: Horizon → Inmuebles → Contratos → `+ Nuevo Contrato`

**Pasos**:
1. Click en `+ Nuevo Contrato`
2. **Wizard paso 1 - Seleccionar Inmueble**:
   - Elegir de la lista de inmuebles disponibles
   - Click `Siguiente`
3. **Wizard paso 2 - Datos del Inquilino**:
   - Nombre, apellidos, DNI/NIE
   - Email, teléfono
   - Click `Siguiente`
4. **Wizard paso 3 - Términos del Contrato**:
   - Fecha inicio y fin
   - Renta mensual
   - Día de cobro (1-31)
   - Fianza (meses)
   - Click `Siguiente`
5. **Wizard paso 4 - Revisión**:
   - Verificar todos los datos
   - Click `Crear Contrato`
6. ✅ Toast: "Contrato creado correctamente"

**Resultado**: 
- Contrato activo en lista
- Movimientos previstos generados automáticamente en Tesorería

---

### 📋 Flujo 3: Registrar un Gasto

**Navegación**: Horizon → Tesorería → Movimientos → `+ Añadir Movimiento`

**Pasos**:
1. Click en `+ Añadir Movimiento`
2. Seleccionar **Tipo**: Gasto
3. Completar datos:
   - **Concepto**: Descripción clara (ej: "Reparación caldera")
   - **Importe**: Cantidad (se muestra en rojo para gastos)
   - **Fecha**: Cuándo ocurrió
   - **Inmueble**: Seleccionar de lista (opcional)
   - **Categoría**: IBI, Comunidad, Reparaciones, etc.
   - **Estado**: Previsto / Confirmado
4. Click `Guardar`
5. ✅ Toast: "Movimiento registrado"

**Resultado**: Movimiento aparece en tabla de tesorería

---

### 📋 Flujo 4: Importar Extracto Bancario

**Navegación**: Horizon → Tesorería → Importar

**Pasos**:
1. Click en `Importar Extracto`
2. **Seleccionar banco**: Lista de bancos soportados
3. **Arrastrar archivo** o click para seleccionar
   - Formatos: CSV, XLS, XLSX, PDF (según banco)
4. **Previsualización**: Verificar movimientos detectados
5. Click `Importar`
6. ✅ Toast: "X movimientos importados"

**Resultado**: Movimientos aparecen en tesorería, listos para conciliar

---

### 📋 Flujo 5: Subir un Documento

**Navegación**: Horizon → Documentos → Inbox

**Pasos**:
1. **Arrastrar archivos** a zona de "drop" o click `Subir`
2. Seleccionar archivos (PDF, imágenes, ZIPs)
3. **Procesamiento automático**:
   - OCR detecta tipo de documento
   - Extrae datos clave (proveedor, importe, fecha)
   - Sugiere clasificación
4. **Revisión**:
   - Verificar datos extraídos
   - Corregir si es necesario
   - Asignar a inmueble (si aplica)
5. Click `Confirmar y Guardar`
6. ✅ Toast: "Documento guardado"

**Resultado**: Documento archivado y vinculado a entidades

---

## 📊 Características de Usabilidad

### 🎨 Sistema de Colores

Los colores tienen significado consistente:

| Color | Significado | Ejemplo |
|-------|-------------|---------|
| 🔵 Azul (`#042C5E`) | Primario, acciones, links | Botones principales |
| 🟢 Verde (`#28A745`) | Éxito, ingresos, OK | Rentas cobradas |
| 🔴 Rojo (`#DC3545`) | Error, gastos, alertas | Facturas pendientes |
| 🟡 Amarillo (`#FFC107`) | Advertencia, pendiente | Pagos próximos |
| ⚪ Gris (`#6C757D`) | Neutral, secundario | Texto descriptivo |

### 🔔 Sistema de Notificaciones

**Toasts (esquina superior derecha)**:
- ✅ Verde: Acción exitosa
- ❌ Rojo: Error con sugerencia de solución
- ℹ️ Azul: Información
- ⚠️ Amarillo: Advertencia

**Confirmaciones**:
- Modal centrado con opciones claras
- `Cancelar` (botón gris) a la izquierda
- `Confirmar` (botón según acción) a la derecha

### 🎯 Estados Vacíos

Cuando no hay datos, aparece un **EmptyState** con:
- Icono descriptivo
- Mensaje claro
- Acción sugerida (botón)

Ejemplo:
```
┌────────────────────────────────┐
│     📄 (icono)                 │
│                                │
│  No hay documentos en Inbox    │
│                                │
│  Sube tu primer documento      │
│  [+ Subir Documento]           │
└────────────────────────────────┘
```

### 💡 Tooltips

Pasar el cursor sobre iconos muestra ayuda contextual:
- **ℹ️**: Información adicional
- **?**: Ayuda sobre el campo
- **🔒**: Funcionalidad bloqueada (próximamente)

---

## 🎯 Patrones de Interacción

### Botones

| Tipo | Aspecto | Uso |
|------|---------|-----|
| Primario | Azul sólido | Acción principal (Guardar, Crear) |
| Secundario | Borde azul | Cancelar, Volver |
| Destructivo | Rojo sólido | Eliminar, Descartar |
| Ghost | Transparente | Acciones terciarias |

### Formularios

- **Campos obligatorios**: Marcados con `*`
- **Validación en tiempo real**: Borde rojo si error
- **Mensajes de ayuda**: Texto gris bajo el campo
- **Autocompletado**: Sugerencias al escribir

### Tablas

- **Ordenar**: Click en cabeceras de columna
- **Filtrar**: Barra de búsqueda arriba
- **Acciones**: Iconos en última columna
  - 👁️ Ver
  - ✏️ Editar
  - 🗑️ Eliminar

### Wizards

Para procesos complejos (crear contrato, configurar):
1. **Pasos numerados** arriba
2. **Un paso a la vez**
3. **Navegación**: `Anterior` | `Siguiente`
4. **Revisión final** antes de confirmar

---

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl/Cmd + S` | Guardar |
| `Esc` | Cerrar modal |
| `Tab` | Navegar entre campos |
| `Enter` | Confirmar (en modales) |
| `/` | Foco en búsqueda |

---

## 📱 Diseño Responsive

ATLAS se adapta a tu dispositivo:

**Desktop** (>1024px):
- Sidebar fijo a la izquierda
- Tablas completas
- Formularios en 2-3 columnas

**Tablet** (768-1024px):
- Sidebar colapsable
- Tablas con scroll horizontal
- Formularios en 2 columnas

**Mobile** (<768px):
- Menú hamburguesa
- Tablas en tarjetas
- Formularios en 1 columna

---

## 🔍 Búsqueda y Filtros

### Búsqueda Global

Barra de búsqueda en cada vista:
- Busca en todos los campos visibles
- Actualización instantánea al escribir
- Clear button para limpiar

### Filtros Avanzados

Paneles desplegables con:
- **Rango de fechas**: Desde/Hasta
- **Estados**: Checkboxes múltiples
- **Categorías**: Select dropdown
- **Importes**: Min/Max

---

## 🆘 Ayuda y Soporte

### Dónde Encontrar Ayuda

1. **Tooltips**: Hover sobre `ℹ️` y `?`
2. **Estados vacíos**: Guían la primera acción
3. **Toasts de error**: Incluyen solución sugerida
4. **Design Bible**: Menú → Ayuda → Guía ATLAS

### Mensajes de Error Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Error de red" | Sin conexión | Verifica tu internet |
| "Formato incorrecto" | Archivo no válido | Usa PDF, CSV o XLS |
| "Campo requerido" | Falta información | Completa campos marcados `*` |
| "Fecha inválida" | Formato de fecha | Usa formato DD/MM/YYYY |

---

## 🎨 Estándares ATLAS

### Tipografía

- **Fuente**: Inter (única permitida)
- **Tamaños**:
  - H1: 1.5rem (títulos principales)
  - H2: 1.25rem (subtítulos)
  - Body: 1rem (texto normal)
  - Caption: 0.875rem (etiquetas)

### Espaciado

- **Grid**: 4px
- **Gaps**:
  - XS: 4px (entre elementos muy cercanos)
  - SM: 8px (dentro de componentes)
  - MD: 12px (entre componentes relacionados)
  - LG: 16px (entre secciones)
  - XL: 24px (entre bloques)

### Iconografía

- **Librería**: Lucide React
- **Tamaño**: 24px (o 16px en contextos pequeños)
- **Color**: Hereda del texto padre
- **Uso**: Un icono por botón/acción

---

## ✅ Checklist de Experiencia de Usuario

Para cualquier nueva funcionalidad, verificar:

- [ ] **Feedback visual**: Toast o mensaje de confirmación
- [ ] **Estados**: Loading, error, vacío, éxito
- [ ] **Validación**: En tiempo real en formularios
- [ ] **Confirmación**: Para acciones destructivas
- [ ] **Accesibilidad**: Navegable por teclado
- [ ] **Responsive**: Funciona en móvil y tablet
- [ ] **Colores ATLAS**: Usa tokens, no hardcoded
- [ ] **Botones ATLAS**: Clases estándar
- [ ] **Iconos Lucide**: Solo librería permitida
- [ ] **Fuente Inter**: Aplicada correctamente

---

## 🚀 Próximas Mejoras

En el roadmap de UX:

- [ ] **Onboarding interactivo**: Tour guiado en primer uso
- [ ] **Atajos personalizables**: Configurar teclas
- [ ] **Temas oscuros**: (pendiente aprobación ATLAS)
- [ ] **Vistas guardadas**: Filtros predefinidos
- [ ] **Dashboards personalizables**: Drag & drop KPIs

---

**Versión**: 1.0  
**Última actualización**: 2024  
**Feedback**: Para sugerencias de mejora, contactar al equipo de Product

---

## 📚 Recursos Adicionales

- **Guía de diseño V5 (única)**: `docs/GUIA-DISENO-V5-atlas.md` · tokens en `src/design-system/v5/tokens.css`
- **Auditoría Completa**: `/AUDITORIA_FINAL_ATLAS.md`
