# Accessibility - ATLAS Design Bible

> Normas WCAG AA/AAA para ATLAS

## 🎯 Objetivos de Accesibilidad

- **WCAG 2.1 AA**: Cumplimiento mínimo obligatorio
- **WCAG 2.1 AAA**: Objetivo para elementos críticos
- **Navegación completa por teclado**
- **Compatibilidad con lectores de pantalla**

## 🌈 Contraste de Color

### WCAG AA (Mínimo 4.5:1)

```css
/* Combinaciones válidas verificadas */
--atlas-blue (#042C5E) + white = 14.8:1 ✅
--atlas-navy-1 (#303A4C) + white = 9.2:1 ✅  
--text-gray (#6C757D) + white = 4.6:1 ✅
--ok (#28A745) + white = 3.8:1 ⚠️ Usar para iconos, no texto
--warn (#FFC107) + black = 1.9:1 ❌ Requiere texto oscuro
--error (#DC3545) + white = 5.9:1 ✅
```

### Texto Sobre Fondos de Color

```css
/* Fondos claros - usar texto oscuro */
.bg-light {
  background-color: var(--bg);  /* #F8F9FA */
  color: var(--atlas-navy-1);   /* #303A4C - Contraste 8.1:1 */
}

/* Fondos oscuros - usar texto claro */
.bg-dark {
  background-color: var(--atlas-navy-2);  /* #142C50 */
  color: white;  /* Contraste 12.4:1 */
}

/* Estados de color - verificar contraste */
.status-success {
  background-color: rgba(40, 167, 69, 0.1);
  color: #155724;  /* Verde oscuro para mejor contraste */
}

.status-warning {
  background-color: rgba(255, 193, 7, 0.1);
  color: #856404;  /* Amarillo oscuro para contraste */
}
```

## ⌨️ Navegación por Teclado

### Focus Visible

```css
/* Focus consistente en toda la aplicación */
*:focus {
  outline: 2px solid var(--atlas-blue);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Focus específico para botones */
.atlas-btn-primary:focus {
  box-shadow: 0 0 0 3px rgba(4, 44, 94, 0.3);
}

/* Focus para inputs */
.input:focus {
  outline: 2px solid var(--atlas-blue);
  outline-offset: 1px;
  border-color: var(--atlas-blue);
}
```

### Tab Order Lógico

```html
<!-- Orden de tabulación debe seguir flujo visual -->
<form>
  <input type="text" placeholder="Nombre" tabindex="1" />
  <input type="email" placeholder="Email" tabindex="2" />
  <textarea placeholder="Descripción" tabindex="3"></textarea>
  <button type="submit" tabindex="4">Guardar</button>
  <button type="button" tabindex="5">Cancelar</button>
</form>
```

### Atajos de Teclado

```typescript
// Atajos globales
const keyboardShortcuts = {
  'Escape': 'Cerrar modal/drawer/dropdown',
  'Enter': 'Activar elemento enfocado',
  'Space': 'Activar botón/checkbox',
  'Tab': 'Siguiente elemento',
  'Shift+Tab': 'Elemento anterior',
  'ArrowDown': 'Siguiente opción en menú',
  'ArrowUp': 'Opción anterior en menú',
  'Home': 'Primer elemento',
  'End': 'Último elemento'
};
```

## 🎙️ Lectores de Pantalla

### ARIA Labels Obligatorios

```tsx
// Botones sin texto visible
<button aria-label="Cerrar modal">
  <X size={16} />
</button>

// Iconos informativos
<HelpCircle 
  size={16} 
  aria-label="Información sobre rendimiento bruto"
/>

// Elementos interactivos
<div 
  role="button" 
  tabindex="0"
  aria-label="Expandir detalles del inmueble"
>
  <ChevronDown size={16} />
</div>
```

### ARIA Expanded

```tsx
// Menús desplegables
<button 
  aria-expanded={isOpen}
  aria-controls="dropdown-menu"
  aria-haspopup="menu"
>
  Opciones
  <ChevronDown size={16} />
</button>

<div 
  id="dropdown-menu" 
  role="menu"
  hidden={!isOpen}
>
  <div role="menuitem">Editar</div>
  <div role="menuitem">Eliminar</div>
</div>
```

### ARIA Live Regions

```tsx
// Notificaciones dinámicas
<div 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {successMessage}
</div>

// Errores críticos
<div 
  aria-live="assertive"
  aria-atomic="true" 
  className="sr-only"
>
  {errorMessage}
</div>

// Estado de carga
<div 
  aria-live="polite"
  aria-busy={isLoading}
>
  {isLoading ? 'Cargando datos...' : 'Datos cargados'}
</div>
```

## 🏷️ Etiquetas Semánticas

### Estructura HTML5

```html
<main role="main">
  <header role="banner">
    <nav role="navigation" aria-label="Navegación principal">
      <!-- Menú principal -->
    </nav>
  </header>
  
  <section aria-labelledby="page-title">
    <h1 id="page-title">Lista de Inmuebles</h1>
    <!-- Contenido principal -->
  </section>
  
  <aside role="complementary" aria-label="Filtros">
    <!-- Sidebar con filtros -->
  </aside>
</main>
```

### Formularios Accesibles

```tsx
// Labels asociados
<div className="form-field">
  <label htmlFor="property-name">
    Nombre del inmueble *
  </label>
  <input 
    id="property-name"
    type="text"
    required
    aria-describedby="name-help name-error"
  />
  <div id="name-help" className="help-text">
    Ej: Piso Calle Mayor, 123
  </div>
  {error && (
    <div id="name-error" className="error-text" role="alert">
      {error}
    </div>
  )}
</div>

// Grupos de radio/checkbox
<fieldset>
  <legend>Tipo de inmueble</legend>
  <input type="radio" id="piso" name="tipo" value="piso" />
  <label htmlFor="piso">Piso</label>
  
  <input type="radio" id="casa" name="tipo" value="casa" />
  <label htmlFor="casa">Casa</label>
</fieldset>
```

## 📊 Tablas Accesibles

```tsx
<table role="table" aria-label="Lista de inmuebles">
  <caption className="sr-only">
    Tabla con {properties.length} inmuebles. 
    Ordenable por columnas.
  </caption>
  
  <thead>
    <tr>
      <th 
        scope="col"
        aria-sort={sortBy === 'name' ? sortOrder : 'none'}
      >
        <button 
          onClick={() => handleSort('name')}
          aria-label="Ordenar por nombre"
        >
          Nombre
          <ArrowUpDown size={16} />
        </button>
      </th>
      <th scope="col">Dirección</th>
      <th scope="col">Alquiler</th>
    </tr>
  </thead>
  
  <tbody>
    <tr>
      <td>Piso Centro</td>
      <td>Calle Mayor, 123</td>
      <td>
        <span aria-label="850 euros al mes">
          850,00 €/mes
        </span>
      </td>
    </tr>
  </tbody>
</table>
```

## 🖼️ Imágenes y Media

### Alt Text Descriptivo

```tsx
// Imágenes informativas
<img 
  src="property-photo.jpg"
  alt="Vista exterior del piso en Calle Mayor 123, 
       edificio de ladrillo rojo de 4 plantas"
/>

// Imágenes decorativas
<img 
  src="decoration.svg"
  alt=""
  role="presentation"
/>

// Iconos con significado
<img 
  src="success-icon.svg"
  alt="Operación completada con éxito"
/>
```

## 📱 Modales Accesibles

```tsx
const Modal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) {
      // Enfocar modal al abrir
      modalRef.current?.focus();
      
      // Capturar foco dentro del modal
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
  
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    
    // Trap focus dentro del modal
    if (e.key === 'Tab') {
      trapFocus(e);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        ref={modalRef}
        className="modal-content"
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button 
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={16} />
          </button>
        </header>
        
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
```

## 📱 Responsive y Mobile

### Touch Targets

```css
/* Mínimo 44px para elementos táctiles */
.btn, .link, .tab, .toggle {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}

/* Espaciado entre elementos táctiles */
.mobile-nav .nav-item {
  margin-bottom: 8px;
}
```

### Zoom hasta 200%

```css
/* El layout debe funcionar con zoom 200% */
@media (max-width: 1280px) {
  .container {
    max-width: 100%;
    padding: 0 16px;
  }
  
  .grid {
    grid-template-columns: 1fr;
  }
}
```

## 🔧 Herramientas de Testing

### Testing Manual
1. **Navegación por teclado**: Tab por toda la interfaz
2. **Zoom 200%**: Verificar que todo funciona
3. **Sin ratón**: Usar solo teclado por 5 minutos
4. **Lector de pantalla**: Probar con NVDA/JAWS

### Testing Automatizado
```bash
# Instalar axe-core para testing
npm install --save-dev @axe-core/react

# Usar en tests
import axe from '@axe-core/react';

if (process.env.NODE_ENV !== 'production') {
  axe(React, ReactDOM, 1000);
}
```

## 🔄 Versión

**v1.0.0** - Especificación inicial de accesibilidad