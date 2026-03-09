# Patterns - ATLAS Design Bible

> Patrones de interacción y UX para ATLAS

## 🆘 Ayuda (SUA - Solo 4 Patrones)

### 1. EmptyState
**Uso**: Cuando no hay contenido que mostrar
```tsx
<div className="empty-state">
  <Icon className="empty-state-icon" size={48} />
  <h3 className="empty-state-title">No hay inmuebles</h3>
  <p className="empty-state-description">
    Añade tu primer inmueble para empezar a gestionar tu cartera
  </p>
  <button className="atlas-btn-primary">
    Añadir Inmueble
  </button>
</div>
```

### 2. InlineHint
**Uso**: Ayuda contextual dentro del flujo
```tsx
<div className="inline-hint">
  <Info size={16} className="inline-hint-icon" />
  <span className="inline-hint-text">
    El IBI se calcula automáticamente según el valor catastral
  </span>
</div>
```

### 3. InfoTooltip
**Uso**: Información adicional sobre hover/focus
```tsx
<div className="info-tooltip-trigger">
  <label>Rendimiento Bruto</label>
  <HelpCircle size={16} />
  <div className="tooltip">
    Ingresos anuales / Valor de compra × 100
  </div>
</div>
```

### 4. HelperBanner
**Uso**: Información importante no intrusiva
```tsx
<div className="helper-banner helper-banner-info">
  <Info size={16} />
  <div>
    <strong>Sincronización activa</strong>
    <p>Los datos se actualizan automáticamente cada 24 horas</p>
  </div>
</div>
```

### ❌ Patrones NO Permitidos
- ❌ Modales de ayuda
- ❌ Tours/overlays
- ❌ Ayuda en H1/H2
- ❌ Sidebars de ayuda
- ❌ Chatbots flotantes

## ⚠️ Confirmación Destructiva

### Modal Claro
```tsx
<div className="modal-overlay">
  <div className="modal-content">
    <div className="confirmation-header">
      <AlertTriangle size={24} className="text-warn" />
      <h3>Eliminar Inmueble</h3>
    </div>
    <p>
      Esta acción no se puede deshacer. Se eliminarán todos los 
      contratos y datos asociados.
    </p>
    <div className="confirmation-actions">
      <button className="atlas-btn-secondary">Cancelar</button>
      <button className="atlas-btn-destructive">Eliminar</button>
    </div>
  </div>
</div>
```

### Principios
- ✅ **Título claro de la acción**
- ✅ **Explicación de consecuencias**
- ✅ **Botón destructivo rojo**
- ✅ **Opción de cancelar**
- ❌ **SIN overlay oscuro**

## ⏳ Carga/Progreso

### Spinner Simple
```tsx
<div className="loading-spinner">
  <div className="spinner" />
  <span>Cargando...</span>
</div>
```

### Barra de Progreso
```tsx
<div className="progress-container">
  <div className="progress-header">
    <span>Importando movimientos</span>
    <span className="atlas-chip-neutral">2 de 5</span>
  </div>
  <div className="progress-bar">
    <div 
      className="progress-fill" 
      style={{ width: '40%' }}
    />
  </div>
</div>
```

### Estados con Chips
```tsx
<div className="import-status">
  <span className="atlas-chip-success">Completado</span>
  <span className="atlas-chip-warning">Procesando</span>
  <span className="atlas-chip-neutral">Pendiente</span>
</div>
```

## 📤 Importar/Subir

### Ubicación: **SOLO Topbar**
❌ **NUNCA en sidebar**

### Botón Topbar
```tsx
<div className="topbar-actions">
  <button className="atlas-btn-secondary">
    <Upload size={16} />
    Subir
  </button>
</div>
```

### Modal Import
```tsx
<div className="import-modal">
  <h3>Importar Movimientos</h3>
  <div className="import-dropzone">
    <Upload size={32} />
    <p>Arrastra tu archivo CSV o haz clic para seleccionar</p>
    <input type="file" accept=".csv,.xlsx" />
  </div>
  <div className="import-actions">
    <button className="atlas-btn-secondary">Cancelar</button>
    <button className="atlas-btn-primary">Importar</button>
  </div>
</div>
```

## 📋 Listas con Acciones

### Acción Primaria: Botón Azul
```tsx
<div className="list-item">
  <div className="list-content">
    <h4>Piso Calle Mayor, 123</h4>
    <p>Alquiler: 850,00 € / mes</p>
  </div>
  <div className="list-actions">
    <button className="atlas-btn-primary">
      Ver Detalle
    </button>
    <MoreHorizontal className="kebab-trigger" />
  </div>
</div>
```

### Acciones Secundarias: Menú Kebab
```tsx
<div className="kebab-menu">
  <button className="kebab-item">
    <Edit size={16} />
    Editar
  </button>
  <button className="kebab-item">
    <Copy size={16} />
    Duplicar
  </button>
  <button className="kebab-item kebab-item-danger">
    <Trash size={16} />
    Eliminar
  </button>
</div>
```

## 🧭 Navegación Canónica (Sidebar)

### Orden EXACTO
```
HORIZON — Supervisión
1. Dashboard
2. Personal
3. Inmuebles
4. Tesorería
5. Proyecciones
6. Fiscalidad
7. Financiación

PULSE — Gestión
8. Alquileres

DOCUMENTACIÓN
9. Documentación
```

### Fuera del Sidebar (Topbar)
- ⚙️ **Configuración** (menú avatar)
- 📋 **Tareas** (panel lateral)
- 📥 **Inbox/Subir**
- 🔔 **Notificaciones**

### Separadores Obligatorios
```css
.sidebar-separator {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: #9CA3AF;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 16px 8px;
  margin-top: 16px;
}
```

## 📱 Responsive Patterns

### Mobile First
```css
/* Mobile: Sidebar oculto por defecto */
.sidebar {
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}

.sidebar.open {
  transform: translateX(0);
}

/* Desktop: Sidebar siempre visible */
@media (min-width: 768px) {
  .sidebar {
    transform: translateX(0);
    position: relative;
  }
}
```

### Tabs en Mobile
```tsx
<div className="mobile-tabs">
  <button className="tab-item active">
    <Home size={20} />
    <span>Panel</span>
  </button>
  <button className="tab-item">
    <Building size={20} />
    <span>Inmuebles</span>
  </button>
  <button className="tab-item">
    <Banknote size={20} />
    <span>Tesorería</span>
  </button>
</div>
```

## 🔄 Estados de Carga

### Skeleton Loading
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg) 25%,
    rgba(248, 249, 250, 0.4) 50%,
    var(--bg) 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

## 🔄 Versión

**v1.0.0** - Especificación inicial de patrones