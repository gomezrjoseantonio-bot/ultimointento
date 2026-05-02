# ADR · Configuración de libertad financiera parametrizable

> Decisión arquitectónica · canónica · aplica a todo ATLAS desde 2026-05-02

## Status

Adoptado · aplica a TODO ATLAS desde 2026-05-02

## Contexto

ATLAS calcula métricas financieras que implican **interpretaciones subjetivas**: qué cuenta como "renta pasiva", qué condición define "libertad financiera", cuántos meses de colchón son suficientes, qué rentabilidad se considera mínima, etc.

Sin parametrización, ATLAS impone una visión opinada al usuario. Si se hardcodea la definición de "renta pasiva" como "alquiler bruto", un usuario que prefiere calcular sobre renta neta obtiene números incorrectos para su situación. Si se hardcodea "libertad financiera = primer mes que renta ≥ gastos", un usuario que prefiere una definición más conservadora (por ejemplo, sostenida 12 meses) no puede expresar esa preferencia.

Adicionalmente, construir la UI de ajustes antes de tener el cálculo parametrizado genera acoplamiento inverso y dificulta el testing.

## Decisión

Toda funcionalidad de ATLAS que implica una **interpretación subjetiva** sigue este patrón:

1. **Definir un STANDARD** · default razonable que ATLAS aplica out-of-the-box · documentado en SPEC
2. **Exponer la parametrización en Ajustes** · usuario puede sustituir el STANDARD por su definición personal (se construye a demanda, no anticipadamente)
3. **El cálculo recibe la configuración como parámetro** · función pura · `f(supuestos, datosReales, config) → resultado`

## Aplicación universal

Lista no exhaustiva. Cualquier nuevo cálculo que caiga aquí debe seguir el patrón:

| Cálculo | Interpretación subjetiva |
|---|---|
| **Libertad financiera** | qué cuenta como renta pasiva · qué condición la define · qué horizonte |
| **Rentabilidad** | bruta vs neta vs neta-fiscal · cuál se muestra en el dashboard |
| **Colchón de emergencia** | cuántos meses de gastos vida · qué cuenta como gastos vida |
| **Cobertura de gastos** | porcentaje · si incluye o no gastos extraordinarios |
| **Yield mínima cartera** | % objetivo |
| **DTI máximo / LTV máximo** | ratios prudentes |
| **Tasa de ahorro mínima** | % de ingresos |
| **Punto de cruce** | simple · sostenido · con margen |
| **Cualquier KPI agregado** | si admite >1 fórmula razonable, es candidato |

## Implementación canónica

```typescript
// 1. Tipo de configuración con TODOS los parámetros
export interface XxxConfig {
  /** Qué hace este parámetro · valores válidos · default */
  parametroA: TipoA;
  parametroB: TipoB;
}

// 2. Constante con el STANDARD · se usa cuando el usuario no ha personalizado
export const STANDARD_XXX_CONFIG: XxxConfig = {
  parametroA: 'valor_estandar',
  parametroB: 25,
};

// 3. La función pura recibe la config como parámetro
export function calcularXxx(
  supuestos: SupuestosXxx,
  datosReales: DatosRealesXxx,
  config: XxxConfig = STANDARD_XXX_CONFIG,
): ResultadoXxx {
  // ...
}

// 4. La UI de Ajustes lee/escribe la config personalizada · si no hay personalizada · STANDARD
const config = await ajustesService.getXxxConfig() ?? STANDARD_XXX_CONFIG;
const resultado = calcularXxx(supuestos, datosReales, config);
```

## Consecuencias

### Positivas
- **Onboarding fluido**: el STANDARD evita que el usuario tenga que configurar nada para empezar a usar ATLAS
- **Respeto al criterio del usuario**: la parametrización evita que ATLAS imponga una visión opinada
- **Cero acoplamiento UI-cálculo**: la función pura con config inyectada es completamente testable sin UI
- **Múltiples consumidores**: el simulador puede pasar un override temporal sin persistirlo; los tests usan configs distintas sin DB
- **Backend sin anticipar UI**: el tipo + constante + función se construye desde el día 1; la UI de Ajustes se construye a demanda

### Negativas / trade-offs
- Ligero overhead de diseño inicial: hay que pensar qué parámetros exponer desde el principio
- Los campos `STANDARD` se vuelven parte del contrato público del tipo y no se pueden eliminar sin versionar

## Ámbito de aplicación

Aplica a TODO ATLAS desde esta fecha. Toda spec CC futura que añada cálculo subjetivo debe contemplar la parametrización. Si no la contempla, el spec está mal redactado y se devuelve.

La UI de Ajustes para exponer estos parámetros se construye **a demanda**: cada parámetro se añade cuando aporta valor o cuando un usuario lo pide. No se construye una UI gigante anticipándose. El backend (tipo + constante + función) sí se construye desde el día 1 con el patrón.

## Referencias

- Primera implementación · T27.4.1 · `src/types/libertad.ts` · `src/services/libertadService.ts`
- Doc arquitectura Financiación · `docs/ARQUITECTURA-financiacion.md`
- Stores Mi Plan · `docs/STORES-MI-PLAN-v3.md`
