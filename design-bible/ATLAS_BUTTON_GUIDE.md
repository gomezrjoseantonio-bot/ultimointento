# 🎨 Guía de Botones ATLAS

> Sistema unificado de botones para ATLAS Horizon & Pulse

## 📋 Clases Estándar ATLAS

### Botones Primarios

```css
.atlas-btn-primary {
  background: var(--atlas-blue);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;
}

.atlas-btn-primary:hover {
  background: #031F47;
  transform: translateY(-1px);
}
```

**Uso**: Acciones principales, CTAs, guardar, confirmar

```tsx
<button className="atlas-btn-primary">
  Guardar
</button>
```

---

### Botones Secundarios

```css
.atlas-btn-secondary {
  background: transparent;
  color: var(--atlas-blue);
  border: 1px solid var(--atlas-blue);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;
}

.atlas-btn-secondary:hover {
  background: rgba(4, 44, 94, 0.05);
}
```

**Uso**: Acciones secundarias, cancelar, volver

```tsx
<button className="atlas-btn-secondary">
  Cancelar
</button>
```

---

### Botones Destructivos

```css
.atlas-btn-destructive {
  background: var(--error);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;
}

.atlas-btn-destructive:hover {
  background: #c82333;
  transform: translateY(-1px);
}
```

**Uso**: Eliminar, descartar, acciones irreversibles

```tsx
<button className="atlas-btn-destructive">
  Eliminar
</button>
```

---

### Botones Ghost (Terciarios)

```css
.atlas-btn-ghost {
  background: transparent;
  color: var(--atlas-navy-1);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 400;
  transition: all 0.2s;
}

.atlas-btn-ghost:hover {
  background: var(--bg);
}
```

**Uso**: Acciones terciarias, opciones de menú, navegación

```tsx
<button className="atlas-btn-ghost">
  Ver más
</button>
```

---

### Botones de Éxito

```css
.atlas-btn-success {
  background: var(--ok);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s;
}

.atlas-btn-success:hover {
  background: #218838;
  transform: translateY(-1px);
}
```

**Uso**: Aprobar, validar, confirmar acciones positivas

```tsx
<button className="atlas-btn-success">
  Aprobar
</button>
```

---

## 📏 Tamaños

### Small (sm)

```tsx
<button className="atlas-btn-primary atlas-btn-sm">
  Pequeño
</button>
```

```css
.atlas-btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}
```

### Medium (default)

Sin clase adicional - tamaño por defecto

### Large (lg)

```tsx
<button className="atlas-btn-primary atlas-btn-lg">
  Grande
</button>
```

```css
.atlas-btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}
```

---

## 🔄 Estados

### Disabled

```tsx
<button className="atlas-btn-primary" disabled>
  Deshabilitado
</button>
```

```css
.atlas-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

### Loading

```tsx
<button className="atlas-btn-primary atlas-btn-loading">
  <Loader2 className="animate-spin mr-2" />
  Cargando...
</button>
```

---

## 🚫 Anti-Patrones (NO USAR)

❌ **Evitar**:
```tsx
// No usar clases Tailwind directamente
<button className="bg-blue-500 text-white px-4 py-2">

// No usar estilos inline
<button style={{ background: '#042C5E' }}>

// No usar btn-accent, btn-success sin prefijo atlas-
<button className="btn-primary">
```

✅ **Usar**:
```tsx
// Usar clases ATLAS
<button className="atlas-btn-primary">

// Con iconos de Lucide
<button className="atlas-btn-primary">
  <Save className="mr-2 h-4 w-4" />
  Guardar
</button>
```

---

## 🎯 Combinaciones Comunes

### Botón con Icono

```tsx
import { Save } from 'lucide-react';

<button className="atlas-btn-primary">
  <Save className="mr-2 h-4 w-4" />
  Guardar cambios
</button>
```

### Grupo de Botones

```tsx
<div className="flex gap-2">
  <button className="atlas-btn-secondary">
    Cancelar
  </button>
  <button className="atlas-btn-primary">
    Guardar
  </button>
</div>
```

### Botón Full Width

```tsx
<button className="atlas-btn-primary w-full">
  Continuar
</button>
```

---

## 📦 Clases Disponibles

| Clase | Propósito | Ejemplo |
|-------|-----------|---------|
| `atlas-btn-primary` | Acción principal | Guardar, Confirmar |
| `atlas-btn-secondary` | Acción secundaria | Cancelar, Volver |
| `atlas-btn-destructive` | Acción destructiva | Eliminar, Descartar |
| `atlas-btn-ghost` | Acción terciaria | Ver más, Opciones |
| `atlas-btn-success` | Acción positiva | Aprobar, Validar |
| `atlas-btn-sm` | Tamaño pequeño | Chips, badges |
| `atlas-btn-lg` | Tamaño grande | CTAs principales |

---

## ✅ Checklist de Migración

Al migrar botones a ATLAS:

- [ ] Identificar el propósito del botón
- [ ] Elegir la clase ATLAS correcta
- [ ] Reemplazar clases Tailwind/inline styles
- [ ] Agregar iconos Lucide si es necesario
- [ ] Verificar estados (disabled, loading)
- [ ] Probar interacción (hover, focus, click)
- [ ] Validar accesibilidad (aria-label si solo icono)

---

**Versión**: 1.0  
**Última actualización**: 2024  
**Mantenido por**: ATLAS Design System Team
