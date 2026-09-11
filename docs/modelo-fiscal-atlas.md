# Modelo Fiscal ATLAS — Documento fundacional

## 1. Tres verdades por concepto fiscal

ATLAS debe convivir con tres lecturas simultáneas del mismo hecho fiscal:

| Verdad | Definición operativa | Lectura de producto |
| --- | --- | --- |
| Calculado | Lo que ATLAS suma o estima desde sus datos internos | Sirve para detectar huecos o errores de modelado. |
| Declarado | Lo que el cliente presentó a Hacienda | Es inmutable cuando existe AEAT importada. |
| Documentado | Lo que está respaldado por justificantes | Cambia con el tiempo y reduce riesgo inspector. |

La aplicación no debe forzar coincidencia entre las tres. La diferencia entre declarado y documentado expresa el riesgo descubierto del ejercicio.

## 2. Perfiles de cliente

- **Perfeccionista:** importa declaraciones históricas y reconstruye facturas poco a poco.
- **Nuevo sin historial cargado:** empieza desde cero y solo introduce arrastres mínimos cuando los necesita.
- **Sin pasado fiscal:** primer ejercicio con inmuebles o actividad; no necesita importar nada.

No debe existir onboarding forzado. La única excepción es que, cuando el cliente sube una primera declaración con la app vacía, ATLAS debe ofrecer bootstrap completo.

## 3. Ciclo de vida del ejercicio

```text
EN CURSO ──(31 dic)──> CERRADO SIN DECLARAR ──(sube AEAT)──> DECLARADO
```

### Reglas del motor

- **En curso:** recalcula en vivo con datos de la app.
- **Cerrado sin declarar:** recalcula con la foto cerrada del 31/12 y permite ajustes previos a la presentación.
- **Declarado:** no recalcula; la foto calculada queda congelada y la AEAT pasa a ser la verdad principal.

### Transiciones clave

1. **1 de enero:** ATLAS genera la foto inicial del ejercicio recién cerrado.
2. **Subida de AEAT:** conviven para siempre la foto calculada y la declaración presentada.
3. **Sin AEAT importada:** la verdad operativa sigue siendo la de ATLAS.

## 4. Documentación retroactiva

- Se pueden subir documentos para cualquier ejercicio en cualquier momento.
- Añadir documentación histórica solo cambia la columna **Documentado**.
- La cobertura documental debe expresarse con un informe simple de líneas cubiertas, parciales o no cubiertas.

## 5. Modelo de pantalla de declaración

### Ejercicio declarado

La vista debe enseñar las tres columnas: **Calculado**, **Declarado** y **Documentado**. Además, debe resaltar el riesgo total descubierto.

### Ejercicio cerrado sin declarar

Solo existe la columna **Calculado** y el usuario puede seguir ajustando antes de presentar.

### Ejercicio en curso

Solo existe **Calculado** y debe etiquetarse como estimación viva.

## 6. Arrastres entre ejercicios

La propagación hacia N+1 sigue estas prioridades:

1. **Casillas AEAT** si el ejercicio origen está declarado.
2. **Cálculo ATLAS** si todavía no existe AEAT.
3. **Entrada manual** si no hay ninguna de las dos fuentes anteriores.

Tipos principales:

- Gastos 0105+0106 pendientes.
- Pérdidas patrimoniales del ahorro.
- Amortizaciones acumuladas de inmuebles arrendados.
- Deducciones pendientes.

## 7. Bootstrap de la primera declaración

Cuando un cliente sin entidades sube su primera declaración, ATLAS debe ofrecer crear automáticamente:

- Perfil personal.
- Trabajo y retenciones.
- Inmuebles y sus relaciones principal/accesorio.
- Contratos detectados.
- Préstamos inferidos por intereses.
- Mejoras y mobiliario.
- Actividad económica.
- Arrastres pendientes.

Las declaraciones posteriores deben enriquecer sin duplicar, usando principalmente la referencia catastral y el histórico multi-ejercicio.

## 8. Reglas operativas resumidas

- **R1:** la AEAT manda cuando existe; si no, manda ATLAS.
- **R2:** los arrastres de N+1 toman su fuente del estado real de N.
- **R3:** el motor nunca recalcula ejercicios declarados.
- **R4:** la documentación retroactiva solo impacta la cobertura documental.
- **R5:** los arrastres manuales son fallback y se sustituyen por datos reales al importar la declaración.
- **R6:** la primera declaración puede bootstrappear toda la app.
- **R7:** declaraciones adicionales enriquecen, no duplican.
- **R8:** el cruce multi-año propone un timeline, pero nunca lo aplica en silencio.
- **R9:** la incompletitud no bloquea el uso de la app.
