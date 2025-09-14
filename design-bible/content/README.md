# Content - ATLAS Design Bible

> Tono de voz, microcopy y formatos de contenido para ATLAS

## 🗣️ Tono de Voz

### Principios
- **Directo**: Sin rodeos, información clara
- **Profesional**: Serio pero no intimidante  
- **Empático**: Comprende las necesidades del usuario

### Características
✅ **Usar**:
- Lenguaje simple y claro
- Verbos en infinitivo para acciones
- "Tú" en lugar de "usted"
- Términos del sector inmobiliario

❌ **Evitar**:
- Jerga técnica innecesaria
- Lenguaje muy formal o distante
- Humor o ironía
- Anglicismos cuando hay equivalente español

## 📝 Microcopy

### Botones
**Formato**: Verbos de acción + objeto (cuando sea necesario)

```
✅ Correcto:
- "Añadir Inmueble"
- "Guardar Cambios"  
- "Eliminar Contrato"
- "Exportar Datos"
- "Cerrar"
- "Cancelar"

❌ Incorrecto:
- "Nuevo" (muy vago)
- "OK" (no descriptivo)
- "Submit" (anglicismo)
- "Aceptar" (confuso en contexto)
```

### Placeholders
**Formato**: Ejemplos útiles que ayuden al usuario

```
✅ Correcto:
- "DD/MM/AAAA" (campos fecha)
- "0,00 €" (campos importe)
- "Introduce el concepto del gasto..."
- "Ej: Piso Calle Mayor, 123"
- "nombre@empresa.com"

❌ Incorrecto:
- "Introduce texto..." (muy genérico)
- "Campo obligatorio" (va en validation)
- "Fecha" (no ayuda al formato)
```

### Mensajes de Error

**Formato**: Qué pasó + Cómo solucionarlo

```
✅ Correcto:
- "Email no válido. Introduce un email con formato válido."
- "Archivo demasiado grande. El tamaño máximo es 10MB."
- "Este inmueble ya existe. Verifica la dirección introducida."
- "Sin conexión. Comprueba tu conexión a internet e inténtalo de nuevo."

❌ Incorrecto:
- "Error" (no informativo)
- "Campo incorrecto" (no específico)
- "Ha ocurrido un error inesperado" (no accionable)
```

### Mensajes de Éxito

**Formato**: Confirmación clara de lo que se completó

```
✅ Correcto:
- "Inmueble añadido correctamente"
- "Datos exportados a inmuebles_2024.xlsx"
- "Contratos sincronizados (3 actualizados)"
- "Configuración guardada"

❌ Incorrecto:
- "¡Éxito!" (no específico)
- "Completado" (muy genérico)
- "Todo OK" (informal)
```

### Empty States

**Formato**: Estado actual + Acción sugerida

```
✅ Correcto:
- "No hay inmuebles en tu cartera"
  "Añade tu primer inmueble para empezar a gestionar tu cartera"

- "Sin movimientos este mes"
  "Los movimientos aparecerán aquí cuando se sincronicen con tu banco"

- "Filtros sin resultados"
  "Prueba a cambiar los filtros o criterios de búsqueda"

❌ Incorrecto:
- "No hay nada aquí" (no útil)
- "Sin datos" (no accionable)
- "Lista vacía" (muy técnico)
```

## 🌍 Formatos Españoles

### Números
```
Formato: 1.234.567,89
- Separador miles: punto (.)
- Separador decimales: coma (,)

Ejemplos:
- 1.250 (mil doscientos cincuenta)
- 15.750,50 (quince mil setecientos cincuenta euros con cincuenta)
- 850,00 (ochocientos cincuenta euros)
```

### Fechas
```
Formato principal: DD/MM/AAAA
- 15/03/2024 (15 de marzo de 2024)
- 01/01/2024 (1 de enero de 2024)

Formato extendido: DD de MMMM de AAAA
- 15 de marzo de 2024
- 1 de enero de 2024

Formato relativo:
- "Hace 2 días"
- "Ayer"
- "Hoy"
- "La semana pasada"
```

### Moneda
```
Formato: 1.234.567,89 €
- Separador miles: punto
- Separador decimales: coma  
- Símbolo: € (al final con espacio)

Ejemplos:
- 850,00 €
- 1.250,50 €
- 125.000,00 €

Formato abreviado (cuando sea necesario):
- 850€
- 1,25K€ (para miles)
- 1,25M€ (para millones)
```

### Porcentajes
```
Formato: XX,XX%
- 4,50% (rendimiento)
- 21,00% (IVA)
- 100,00% (ocupación)

Sin espacios entre número y símbolo
```

## 🏠 Lenguaje del Usuario

### Términos Preferidos

```
✅ Usar (lenguaje usuario):
- "Alquileres" → no "Contratos"
- "Inmuebles" → no "Propiedades" 
- "Inquilinos" → no "Arrendatarios"
- "Propietarios" → no "Arrendadores"
- "Gastos" → no "Egresos"
- "Ingresos" → no "Revenue"
- "Importar" → no "Sincronizar" (para archivos)

✅ Términos técnicos cuando sean necesarios:
- "Rendimiento bruto" (KPI específico)
- "IBI" (impuesto conocido)
- "IRPF" (retención fiscal)
- "Valor catastral" (dato oficial)
```

### Secciones y Navegación

```
✅ Nombres en navegación:
- Dashboard → "Panel"
- Personal → "Personal" 
- Inmuebles → "Inmuebles"
- Tesorería → "Tesorería"
- Proyecciones → "Proyecciones"
- Fiscalidad → "Fiscalidad"
- Financiación → "Financiación"
- Alquileres → "Alquileres"
- Documentación → "Documentación"
```

## 📧 Comunicaciones

### Notificaciones
```
Formato: [Acción] en [Contexto]

✅ Ejemplos:
- "Nuevo inquilino en Piso Calle Mayor, 123"
- "Vencimiento de contrato el 15/03/2024"
- "Pago recibido: 850,00 € de Juan Pérez"
- "Documento pendiente de firma"

❌ Evitar:
- "Tienes 1 notificación nueva"
- "Algo requiere tu atención"
- "Actualización disponible"
```

### Emails del Sistema
```
Asunto: [ATLAS] Acción específica

Ejemplo:
Asunto: [ATLAS] Nuevo contrato pendiente de firma
Cuerpo:
Hola [Nombre],

Tienes un nuevo contrato de alquiler pendiente de firma:

Inmueble: Piso Calle Mayor, 123
Inquilino: Juan Pérez  
Importe: 850,00 € / mes
Fecha inicio: 01/04/2024

[Ver Contrato] [Firmar Ahora]

Saludos,
Equipo ATLAS
```

## 🔤 Capitalización

### Títulos y Secciones
```
✅ Sentence case:
- "Panel de control"
- "Lista de inmuebles" 
- "Configuración de cuenta"

❌ Title Case:
- "Panel De Control"
- "Lista De Inmuebles"
```

### Botones
```
✅ Sentence case:
- "Añadir inmueble"
- "Guardar cambios"
- "Exportar datos"

❌ MAYÚSCULAS:
- "AÑADIR INMUEBLE"
- "GUARDAR CAMBIOS"
```

### Labels
```
✅ Sentence case:
- "Nombre del inmueble"
- "Dirección completa"
- "Importe mensual"
```

## 🔄 Versión

**v1.0.0** - Especificación inicial de contenido y tono de voz