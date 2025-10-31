# 🔧 ISSUES TÉCNICOS DETALLADOS - ATLAS Horizon Pulse

**Fecha**: 31 de Octubre de 2024  
**Versión**: 1.0  
**Basado en**: Análisis de código fuente

---

## 📑 TABLA DE CONTENIDOS

1. [Rutas Muertas en Navegación](#rutas-muertas)
2. [Errores de Validación](#errores-de-validación)
3. [Problemas en Fórmulas de Cálculo](#problemas-en-fórmulas)
4. [Errores de Persistencia](#errores-de-persistencia)
5. [Problemas de Seguridad](#problemas-de-seguridad)
6. [Issues de Performance](#issues-de-performance)
7. [Inconsistencias de UX](#inconsistencias-de-ux)

---

## 🗺️ RUTAS MUERTAS EN NAVEGACIÓN {#rutas-muertas}

### Issue #1: Sección Documentación Completa Sin Implementar

**Severidad**: 🔴 CRÍTICA  
**Archivo**: `src/config/navigation.ts` líneas 112-134

**Descripción**:
El menú de navegación incluye una sección completa de "Documentación" con 4 sub-rutas, pero ninguna está implementada en `App.tsx`.

**Código problemático**:
```typescript
// src/config/navigation.ts
{
  name: 'Documentación',
  href: '/documentacion',
  icon: FileText,
  module: 'shared',
  section: 'documentation',
  subTabs: [
    { name: 'Repositorio', href: '/documentacion', icon: FileText, module: 'shared' },
    { name: 'Filtros', href: '/documentacion/filtros', icon: Settings, module: 'shared' },
    { name: 'Extracción fiscal', href: '/documentacion/fiscal', icon: Calculator, module: 'shared' },
    { name: 'Inspecciones', href: '/documentacion/inspecciones', icon: Users, module: 'shared' },
  ]
}
```

**Resultado**: Clicking en cualquier enlace de Documentación resulta en error 404

**Solución**:

Opción A: Implementar rutas (RECOMENDADO para largo plazo)
```typescript
// src/App.tsx - agregar después de línea 237
<Route path="documentacion">
  <Route index element={
    <React.Suspense fallback={<LoadingSpinner />}>
      <DocumentacionPage />
    </React.Suspense>
  } />
  <Route path="filtros" element={
    <React.Suspense fallback={<LoadingSpinner />}>
      <DocumentacionFiltros />
    </React.Suspense>
  } />
  <Route path="fiscal" element={
    <React.Suspense fallback={<LoadingSpinner />}>
      <DocumentacionFiscal />
    </React.Suspense>
  } />
  <Route path="inspecciones" element={
    <React.Suspense fallback={<LoadingSpinner />}>
      <DocumentacionInspecciones />
    </React.Suspense>
  } />
</Route>
```

Opción B: Remover del menú temporalmente (RÁPIDO para MVP)
```typescript
// src/config/navigation.ts - comentar líneas 112-124
/*
{
  name: 'Documentación',
  ...
},
*/
```

**Impacto en usuario**:
- Usuario hace clic → Error 404
- Pérdida de confianza en la aplicación
- Navegación confusa

---

### Issue #2: Sub-rutas de Tesorería Faltantes

**Severidad**: 🟡 ALTA  
**Archivo**: `src/config/navigation.ts` líneas 52-62

**Descripción**:
Dos de tres sub-rutas de Tesorería no existen.

**Código problemático**:
```typescript
{
  name: 'Tesorería',
  href: '/tesoreria',
  icon: Banknote,
  module: 'horizon',
  section: 'horizon',
  subTabs: [
    { name: 'Radar', href: '/tesoreria', icon: Banknote, module: 'horizon' }, // ✅ Existe
    { name: 'Cobros/Pagos', href: '/tesoreria/cobros-pagos', icon: DollarSign, module: 'horizon' }, // ❌ No existe
    { name: 'Importar', href: '/tesoreria/importar', icon: Inbox, module: 'horizon' }, // ❌ No existe
  ]
}
```

**Rutas existentes en App.tsx**:
```typescript
<Route path="tesoreria">
  <Route index element={<Tesoreria />} /> // ✅ OK
  <Route path="learning-demo" element={<TreasuryLearningEngineDemo />} /> // ✅ OK
  <Route path="cuenta/:id" element={<Tesoreria />} /> // ✅ OK
  // ❌ Falta: cobros-pagos
  // ❌ Falta: importar
</Route>
```

**Solución**:

Opción A: Implementar rutas faltantes
```typescript
// Crear componentes
// src/modules/horizon/tesoreria/cobros-pagos/CobrosPagos.tsx
// src/modules/horizon/tesoreria/importar/ImportarMovimientos.tsx

// Agregar rutas en App.tsx
const CobrosPagos = React.lazy(() => import('./modules/horizon/tesoreria/cobros-pagos/CobrosPagos'));
const ImportarMovimientos = React.lazy(() => import('./modules/horizon/tesoreria/importar/ImportarMovimientos'));

<Route path="tesoreria">
  <Route index element={<Tesoreria />} />
  <Route path="cobros-pagos" element={
    <React.Suspense fallback={<LoadingSpinner />}>
      <CobrosPagos />
    </React.Suspense>
  } />
  <Route path="importar" element={
    <React.Suspense fallback={<LoadingSpinner />}>
      <ImportarMovimientos />
    </React.Suspense>
  } />
</Route>
```

Opción B: Actualizar navegación para usar componente existente
```typescript
// src/config/navigation.ts
subTabs: [
  { name: 'Radar', href: '/tesoreria', icon: Banknote, module: 'horizon' },
  // Remover temporalmente hasta implementar:
  // { name: 'Cobros/Pagos', href: '/tesoreria/cobros-pagos', ... },
  // { name: 'Importar', href: '/tesoreria/importar', ... },
]
```

---

### Issue #3: Sub-rutas de Contratos Incompletas

**Severidad**: 🟡 MEDIA  
**Archivo**: `src/config/navigation.ts` líneas 96-109

**Código problemático**:
```typescript
{
  name: 'Alquileres',
  href: '/contratos',
  subTabs: [
    { name: 'Lista', href: '/contratos/lista', ... }, // ✅ Existe
    { name: 'Nuevo', href: '/contratos/nuevo', ... }, // ✅ Existe
    { name: 'Renovación', href: '/contratos/renovacion', ... }, // ❌ No existe
    { name: 'Subidas', href: '/contratos/subidas', ... }, // ❌ No existe
    { name: 'Envío a firmar', href: '/firmas', ... }, // ✅ Existe
  ]
}
```

**Solución**: Implementar módulos de renovación y subidas de alquiler

---

### Issue #4: Ruta de Tareas en Inmuebles

**Severidad**: 🟡 MEDIA  
**Archivo**: `src/config/navigation.ts` línea 49

**Código problemático**:
```typescript
{
  name: 'Inmuebles',
  subTabs: [
    // ...
    { name: 'Tareas', href: '/inmuebles/tareas', icon: Settings, module: 'horizon' }, // ❌ No existe
  ]
}
```

**Solución**: 
- Opción A: Crear `/inmuebles/tareas`
- Opción B: Redirigir a `/tareas/pendientes` (ya existe)

---

## ❌ ERRORES DE VALIDACIÓN {#errores-de-validación}

### Issue #5: NominaForm - Validación de personalDataId Débil

**Severidad**: 🟡 MEDIA  
**Archivo**: `src/components/personal/nomina/NominaForm.tsx` líneas 68-74

**Problema**:
La validación de `personalDataId` ocurre en el momento de guardar, pero el ID se carga de forma asíncrona al montar el componente. Si falla la carga, el usuario puede llenar todo el formulario y solo al guardar descubre el error.

**Código actual**:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!personalDataId) {
    toast.error('Error: No se encontraron datos personales');
    return;
  }
  // ... resto del código
```

**Problema**:
```typescript
useEffect(() => {
  loadPersonalDataId();
  // ...
}, [nomina]);

const loadPersonalDataId = async () => {
  try {
    const personalData = await personalDataService.getPersonalData();
    if (personalData?.id) {
      setPersonalDataId(personalData.id);
    }
  } catch (error) {
    console.error('Error loading personal data ID:', error);
    // ⚠️ ERROR SILENCIOSO - No informa al usuario
  }
};
```

**Impacto**:
- Usuario pierde tiempo llenando formulario
- Error solo aparece al guardar
- Mala experiencia de usuario

**Solución**:
```typescript
const [loadingPersonalData, setLoadingPersonalData] = useState(true);
const [personalDataError, setPersonalDataError] = useState<string | null>(null);

const loadPersonalDataId = async () => {
  setLoadingPersonalData(true);
  setPersonalDataError(null);
  
  try {
    const personalData = await personalDataService.getPersonalData();
    if (personalData?.id) {
      setPersonalDataId(personalData.id);
    } else {
      setPersonalDataError('No se encontraron datos personales. Por favor, crea tus datos personales primero.');
    }
  } catch (error) {
    console.error('Error loading personal data ID:', error);
    setPersonalDataError('Error al cargar datos personales. Por favor, intenta de nuevo.');
  } finally {
    setLoadingPersonalData(false);
  }
};

// En el render:
if (loadingPersonalData) {
  return <LoadingSpinner />;
}

if (personalDataError) {
  return (
    <div className="p-6 text-center">
      <p className="text-error mb-4">{personalDataError}</p>
      <button onClick={() => navigate('/personal/resumen')}>
        Ir a Datos Personales
      </button>
    </div>
  );
}
```

---

### Issue #6: PropertyForm - Sin validación de fechas

**Severidad**: 🟡 MEDIA  
**Archivo**: `src/modules/horizon/inmuebles/cartera/PropertyForm.tsx`

**Problema**:
No se valida que `fechaCompra` < `fechaVenta` cuando ambas existen.

**Código problemático**:
```typescript
// Usuario puede ingresar:
fechaCompra: '2024-01-01'
fechaVenta: '2023-12-31'  // ⚠️ Antes de la compra!
```

**Solución**:
```typescript
const validateDates = (formData: PropertyFormData): string | null => {
  if (formData.fechaCompra && formData.fechaVenta) {
    const compra = new Date(formData.fechaCompra);
    const venta = new Date(formData.fechaVenta);
    
    if (venta <= compra) {
      return 'La fecha de venta debe ser posterior a la fecha de compra';
    }
  }
  
  return null;
};

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  const dateError = validateDates(formData);
  if (dateError) {
    toast.error(dateError);
    return;
  }
  
  // ... continuar con guardado
};
```

---

### Issue #7: PropertyForm - Acepta montos negativos

**Severidad**: 🟡 MEDIA

**Problema**:
Campos monetarios aceptan valores negativos:
- `precioCompra`
- `precioVenta`
- `valorCatastral`
- `gastosComunidad`

**Solución**:
```typescript
<input
  type="number"
  min="0"
  step="0.01"
  value={formData.precioCompra}
  onChange={(e) => {
    const value = parseFloat(e.target.value);
    if (value < 0) {
      toast.error('El precio no puede ser negativo');
      return;
    }
    setFormData(prev => ({ ...prev, precioCompra: value }));
  }}
/>
```

---

### Issue #8: NominaForm - Variables pueden sumar >100%

**Severidad**: 🟡 BAJA

**Problema**:
El código permite que las variables sumen más del 100% del salario, lo cual puede ser confuso.

**Código actual**:
```typescript
// src/services/nominaService.ts líneas 256-266
validateVariableDistribution(variable: Variable): { isValid: boolean; error?: string } {
  const totalPorcentaje = variable.distribucionMeses.reduce((total, d) => total + d.porcentaje, 0);
  
  if (totalPorcentaje === 0) {
    return { isValid: false, error: 'Debe distribuir al menos en un mes' };
  }
  
  // ⚠️ Permite distribución !== 100%
  if (totalPorcentaje !== 100) {
    return { 
      isValid: true, 
      error: `La distribución suma ${totalPorcentaje}% (se permite diferente de 100%)` 
    };
  }
  
  return { isValid: true };
}
```

**Recomendación**:
Está bien permitir distribución != 100%, pero debería haber una advertencia visual más prominente en la UI.

---

## 🧮 PROBLEMAS EN FÓRMULAS DE CÁLCULO {#problemas-en-fórmulas}

### Issue #9: Cálculo de ITP sin validación de entrada

**Severidad**: 🟡 MEDIA  
**Archivo**: `src/utils/taxCalculationUtils.ts` líneas 26-49

**Problema**:
La función acepta cualquier valor de `precioCompra` sin validar que sea positivo o razonable.

**Código actual**:
```typescript
export function calculateITPWithBase(
  precioCompra: number,
  postalCode: string,
  baseConfig: BaseITPConfig
): ITPCalculationResult | null {
  const location = getLocationFromPostalCode(postalCode);
  if (!location) {
    return null;
  }

  const itpRate = getITPRateForCCAA(location.ccaa);
  const baseImponible = baseConfig.modo === 'manual' && baseConfig.valor 
    ? baseConfig.valor 
    : precioCompra;

  // ⚠️ No valida que baseImponible > 0
  // ⚠️ No valida rangos razonables
  const importe = Math.round((baseImponible * itpRate / 100) * 100) / 100;

  return {
    importe,
    porcentaje: itpRate,
    baseImponible,
    ccaa: location.ccaa
  };
}
```

**Problemas potenciales**:
```typescript
// Casos problemáticos que la función acepta:
calculateITPWithBase(0, '28001', { modo: 'auto', valor: null });        // → 0€ ITP
calculateITPWithBase(-50000, '28001', { modo: 'auto', valor: null });   // → -3000€ ITP
calculateITPWithBase(999999999, '28001', { modo: 'auto', valor: null }); // → cálculo sin sentido
```

**Solución**:
```typescript
export function calculateITPWithBase(
  precioCompra: number,
  postalCode: string,
  baseConfig: BaseITPConfig
): ITPCalculationResult | null {
  // Validar entrada
  if (!precioCompra || precioCompra <= 0) {
    console.warn('Precio de compra inválido:', precioCompra);
    return null;
  }
  
  if (precioCompra > 10000000) { // 10M€ - límite razonable
    console.warn('Precio de compra excesivo:', precioCompra);
  }
  
  const location = getLocationFromPostalCode(postalCode);
  if (!location) {
    return null;
  }

  const itpRate = getITPRateForCCAA(location.ccaa);
  
  let baseImponible: number;
  if (baseConfig.modo === 'manual' && baseConfig.valor) {
    // Validar base manual
    if (baseConfig.valor <= 0) {
      console.warn('Base imponible manual inválida:', baseConfig.valor);
      return null;
    }
    if (baseConfig.valor > precioCompra * 1.5) { // Alerta si base >150% precio
      console.warn('Base imponible manual muy superior al precio de compra');
    }
    baseImponible = baseConfig.valor;
  } else {
    baseImponible = precioCompra;
  }

  const importe = Math.round((baseImponible * itpRate / 100) * 100) / 100;

  return {
    importe,
    porcentaje: itpRate,
    baseImponible,
    ccaa: location.ccaa
  };
}
```

---

### Issue #10: Cálculo de nómina - Simplificación excesiva del neto

**Severidad**: 🟡 MEDIA  
**Archivo**: `src/services/nominaService.ts` líneas 240-245

**Problema**:
El cálculo del salario neto usa una simplificación muy genérica (25% de deducciones) que no es precisa.

**Código actual**:
```typescript
/**
 * Simplified net salary calculation
 * In a real implementation, this would use official tax tables
 */
private calculateNetFromBruto(brutoMensual: number): number {
  // Simplified calculation assuming ~25% total deductions
  // This includes IRPF, Social Security, unemployment insurance, etc.
  const deductionRate = 0.25;
  return brutoMensual * (1 - deductionRate);
}
```

**Problemas**:
1. ❌ IRPF es progresivo (19%-47% según tramos)
2. ❌ Seguridad Social ~6.35% (tope en bases máximas)
3. ❌ No considera situación familiar
4. ❌ No considera deducciones

**Impacto**:
Para salario de 50,000€:
- Cálculo actual: Neto = 37,500€ (25% deducción)
- Cálculo real aproximado: Neto = 38,000-40,000€ (depende)
- Error: ~2,000-5,000€/año

**Recomendación**:
```typescript
/**
 * Calculate net salary using Spanish tax tables (2024)
 */
private calculateNetFromBruto(
  brutoMensual: number,
  situacionFamiliar: 'soltero' | 'casado' = 'soltero',
  hijos: number = 0
): number {
  // Seguridad Social (6.35% hasta base máxima)
  const baseMaximaSS = 4720.50; // 2024
  const baseSS = Math.min(brutoMensual, baseMaximaSS);
  const seguridadSocial = baseSS * 0.0635;
  
  // IRPF progresivo
  const baseIRPF = brutoMensual - seguridadSocial;
  const irpf = this.calculateIRPF(baseIRPF, situacionFamiliar, hijos);
  
  return brutoMensual - seguridadSocial - irpf;
}

private calculateIRPF(
  baseAnual: number,
  situacion: 'soltero' | 'casado',
  hijos: number
): number {
  // Tramos IRPF 2024
  const tramos = [
    { hasta: 12450, tipo: 0.19 },
    { hasta: 20200, tipo: 0.24 },
    { hasta: 35200, tipo: 0.30 },
    { hasta: 60000, tipo: 0.37 },
    { hasta: 300000, tipo: 0.45 },
    { hasta: Infinity, tipo: 0.47 }
  ];
  
  // Cálculo progresivo
  let irpf = 0;
  let baseRestante = baseAnual;
  let baseAnterior = 0;
  
  for (const tramo of tramos) {
    const baseTramo = Math.min(baseRestante, tramo.hasta - baseAnterior);
    if (baseTramo <= 0) break;
    
    irpf += baseTramo * tramo.tipo;
    baseRestante -= baseTramo;
    baseAnterior = tramo.hasta;
  }
  
  // Deducciones por situación familiar (simplificado)
  const deduccionHijos = hijos * 2400; // €2,400 por hijo
  const deduccionCasado = situacion === 'casado' ? 3400 : 0;
  
  irpf = Math.max(0, irpf - deduccionHijos - deduccionCasado);
  
  return irpf;
}
```

**Nota**: Esto sigue siendo una aproximación. Para cálculo exacto se necesitaría considerar:
- Comunidad Autónoma
- Deducciones por vivienda
- Otras deducciones aplicables
- Retención vs. cuota final

---

### Issue #11: Préstamos - Falta validación de índice actualizado

**Severidad**: 🟡 BAJA  
**Archivo**: `src/services/prestamosCalculationService.ts`

**Problema**:
Para préstamos variables/mixtos, se usa `valorIndiceActual` sin validar que esté actualizado.

**Código actual**:
```typescript
case 'VARIABLE':
  const rate = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
  return Math.round(rate * 10000) / 10000;
```

**Recomendación**:
```typescript
// Agregar timestamp del índice
interface Prestamo {
  // ... campos existentes
  valorIndiceActual: number;
  fechaActualizacionIndice: string; // Nuevo campo
}

// Validar actualización
calculateBaseRate(prestamo: Prestamo, currentDate?: Date): number {
  // ...
  case 'VARIABLE':
    // Validar que índice esté actualizado (<30 días)
    const fechaIndice = new Date(prestamo.fechaActualizacionIndice);
    const now = currentDate || new Date();
    const diasDesdeActualizacion = Math.floor(
      (now.getTime() - fechaIndice.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (diasDesdeActualizacion > 30) {
      console.warn(`Índice desactualizado (${diasDesdeActualizacion} días)`);
      // Opcionalmente, mostrar alerta en UI
    }
    
    const rate = (prestamo.valorIndiceActual || 0) + (prestamo.diferencial || 0);
    return Math.round(rate * 10000) / 10000;
}
```

---

## 💾 ERRORES DE PERSISTENCIA {#errores-de-persistencia}

### Issue #12: IndexedDB sin manejo de quota exceeded

**Severidad**: 🟡 MEDIA  
**Archivo**: `src/services/db.ts`

**Problema**:
No hay manejo del error de cuota excedida de IndexedDB (~50MB en la mayoría de navegadores).

**Solución**:
```typescript
async saveNomina(nomina: Nomit<Nomina, 'id'>): Promise<Nomina> {
  try {
    // ... código existente
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      throw new Error(
        'Almacenamiento lleno. Por favor, elimina datos antiguos o exporta a la nube.'
      );
    }
    throw error;
  }
}
```

---

### Issue #13: Sin sincronización entre pestañas

**Severidad**: 🟡 BAJA

**Problema**:
Si el usuario abre la app en dos pestañas, los cambios en una no se reflejan en la otra hasta recargar.

**Solución**:
```typescript
// Usar Broadcast Channel API
const channel = new BroadcastChannel('atlas_sync');

// Notificar cambios
async saveNomina(nomina: Nomit<Nomina, 'id'>): Promise<Nomina> {
  const saved = await store.add(nomina);
  
  // Notificar otras pestañas
  channel.postMessage({
    type: 'NOMINA_SAVED',
    data: saved
  });
  
  return saved;
}

// Escuchar cambios
channel.onmessage = (event) => {
  if (event.data.type === 'NOMINA_SAVED') {
    // Recargar datos en UI
    loadData();
  }
};
```

---

## 🔐 PROBLEMAS DE SEGURIDAD {#problemas-de-seguridad}

### Issue #14: Sin validación de origen de datos

**Severidad**: 🟡 MEDIA

**Problema**:
Los datos guardados en IndexedDB no tienen firma/validación de integridad. Un usuario técnico podría manipularlos directamente.

**Solución (parcial hasta migrar a backend)**:
```typescript
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.REACT_APP_DATA_KEY;

function signData(data: any): string {
  return CryptoJS.HmacSHA256(JSON.stringify(data), SECRET_KEY).toString();
}

function verifyData(data: any, signature: string): boolean {
  const expectedSignature = signData(data);
  return expectedSignature === signature;
}

// Al guardar
async saveNomina(nomina: Omit<Nomina, 'id'>): Promise<Nomina> {
  const signature = signData(nomina);
  const nominaWithSignature = { ...nomina, _signature: signature };
  // ... guardar
}

// Al leer
async getNominas(personalDataId: number): Promise<Nomina[]> {
  const nominas = await store.getAll();
  
  // Verificar firmas
  return nominas.filter(nomina => {
    const { _signature, ...data } = nomina;
    if (!verifyData(data, _signature)) {
      console.error('Datos manipulados detectados:', nomina.id);
      return false; // Descartar datos manipulados
    }
    return true;
  });
}
```

---

## ⚡ ISSUES DE PERFORMANCE {#issues-de-performance}

### Issue #15: Cálculos pesados en render

**Severidad**: 🟡 BAJA  
**Archivo**: `src/components/personal/nomina/NominaManager.tsx`

**Problema**:
Se recalcula el salario en cada render si existe nómina activa.

**Código actual**:
```typescript
useEffect(() => {
  // ...
  if (activa) {
    setActivaNomina(activa);
    const calculoResult = nominaService.calculateSalary(activa);
    setCalculo(calculoResult);
  }
}, []);
```

**Mejora con useMemo**:
```typescript
const calculo = useMemo(() => {
  if (!activaNomina) return null;
  return nominaService.calculateSalary(activaNomina);
}, [activaNomina]);
```

---

## 🎨 INCONSISTENCIAS DE UX {#inconsistencias-de-ux}

### Issue #16: Mensajes de error genéricos

**Severidad**: 🟡 MEDIA

**Problema**:
Muchos catch blocks usan mensajes genéricos:

```typescript
catch (error) {
  toast.error('Error al guardar la nómina');
}
```

**Solución**:
```typescript
catch (error) {
  const message = error instanceof Error 
    ? `Error al guardar la nómina: ${error.message}`
    : 'Error al guardar la nómina';
  
  toast.error(message);
  
  // Log para debugging
  console.error('Nomina save error:', {
    error,
    nomina: nominaData,
    personalDataId
  });
}
```

---

### Issue #17: Sin confirmación en acciones destructivas

**Severidad**: 🟡 MEDIA

**Problema**:
Algunas acciones destructivas (como eliminar) usan confirmación, pero no todas.

**Código actual (CON confirmación)**:
```typescript
const handleDeleteNomina = async (id: number) => {
  const confirmed = await confirmDelete('esta nómina');
  if (!confirmed) {
    return;
  }
  // ... eliminar
};
```

**Verificar que TODAS las acciones destructivas tengan confirmación**:
- [ ] Eliminar nómina ✅
- [ ] Eliminar propiedad
- [ ] Eliminar contrato
- [ ] Eliminar préstamo
- [ ] Cancelar suscripción (cuando se implemente)

---

## 📊 RESUMEN DE ISSUES

### Por Severidad

| Severidad | Cantidad |
|-----------|----------|
| 🔴 CRÍTICA | 1 |
| 🟡 ALTA | 2 |
| 🟡 MEDIA | 11 |
| 🟡 BAJA | 3 |
| **TOTAL** | **17** |

### Por Categoría

| Categoría | Issues |
|-----------|--------|
| Rutas Muertas | 4 |
| Validación | 4 |
| Fórmulas | 3 |
| Persistencia | 2 |
| Seguridad | 1 |
| Performance | 1 |
| UX | 2 |

### Top 5 Prioridades

1. 🔴 **Issue #1**: Implementar sección Documentación completa
2. 🟡 **Issue #2**: Completar sub-rutas de Tesorería
3. 🟡 **Issue #5**: Mejorar validación en NominaForm
4. 🟡 **Issue #9**: Validar cálculo de ITP
5. 🟡 **Issue #10**: Mejorar cálculo de nómina neta

---

## 🎯 RECOMENDACIONES

### Corto Plazo (Sprint 6)
1. Remover o comentar sección Documentación del menú
2. Actualizar navegación de Tesorería
3. Agregar validación de entrada en cálculos de impuestos
4. Mejorar mensajes de error

### Medio Plazo (Sprint 7-8)
5. Implementar rutas faltantes completas
6. Mejorar cálculo de nómina con IRPF real
7. Agregar validación de integridad de datos
8. Optimizar cálculos con useMemo

### Largo Plazo (Post-MVP)
9. Migrar a backend (resuelve issues de persistencia)
10. Implementar sincronización real-time
11. Auditoría de seguridad completa

---

**Documento generado por**: GitHub Copilot Agent  
**Fecha**: 31 de Octubre de 2024  
**Versión**: 1.0
