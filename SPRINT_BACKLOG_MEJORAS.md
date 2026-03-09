# 🚀 SPRINT BACKLOG - MEJORAS PRIORITARIAS

**Fecha**: 31 de Octubre de 2024  
**Versión**: 1.0  
**Basado en**: Auditoría Funcional Completa

---

## 📊 RESUMEN DE PRIORIDADES

| Sprint | Duración | Enfoque | Coste Estimado |
|--------|----------|---------|----------------|
| Sprint 6 | 2 semanas | Bloqueantes Críticos | €3,200 |
| Sprint 7 | 2 semanas | Multi-tenant | €3,200 |
| Sprint 8 | 2 semanas | Monetización | €3,200 |
| Sprint 9 | 2 semanas | Legal/Compliance | €3,200 |
| Sprint 10 | 2 semanas | Funcionalidades | €3,200 |
| Sprint 11 | 2 semanas | UX/Onboarding | €3,200 |
| **TOTAL** | **12 semanas** | **MVP Investor-Ready** | **€19,200** |

---

## 🔴 SPRINT 6: BLOQUEANTES CRÍTICOS (2 semanas)

### Objetivo
Resolver problemas que impiden uso básico multi-usuario y persistencia de datos

### User Stories

#### US-6.1: Sistema de Autenticación Básico
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 5 días  
**Responsable**: Backend Developer

**Como** usuario  
**Quiero** poder registrarme e iniciar sesión  
**Para** acceder a mis datos de forma segura

**Criterios de aceptación**:
- [ ] Registro con email/password
- [ ] Login con validación
- [ ] Logout funcional
- [ ] Sesión persistente (localStorage/cookies)
- [ ] Redirección a login si no autenticado
- [ ] Hash de contraseñas (bcrypt)

**Tareas técnicas**:
```typescript
// 1. Actualizar AuthContext.tsx
- Implementar registro real (POST /api/auth/register)
- Implementar login real (POST /api/auth/login)
- Implementar logout (POST /api/auth/logout)
- Gestión de JWT tokens

// 2. Actualizar LoginPage.tsx
- Conectar con AuthContext
- Validación de formulario
- Manejo de errores específicos

// 3. Actualizar RegisterPage.tsx
- Conectar con AuthContext
- Validación de contraseña (min 8 chars, etc.)
- Confirmación de email

// 4. Actualizar ProtectedRoute.tsx
- Verificar JWT válido
- Redirección a /login si inválido
```

**Archivos afectados**:
- `src/contexts/AuthContext.tsx`
- `src/pages/auth/LoginPage.tsx`
- `src/pages/auth/RegisterPage.tsx`
- `src/components/auth/ProtectedRoute.tsx`

---

#### US-6.2: Selección de Backend Provider
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 2 días  
**Responsable**: Tech Lead

**Como** equipo técnico  
**Quiero** seleccionar un provider de backend  
**Para** implementar persistencia cloud

**Opciones evaluadas**:

##### Opción A: Supabase (RECOMENDADO)
**Pros**:
- ✅ PostgreSQL managed
- ✅ Auth integrada
- ✅ Real-time subscriptions
- ✅ Storage incluido
- ✅ Free tier generoso
- ✅ SDK TypeScript excelente

**Cons**:
- ⚠️ Vendor lock-in moderado
- ⚠️ Límites en free tier

**Coste**: $0-25/mes (hasta 50,000 usuarios activos)

##### Opción B: Firebase
**Pros**:
- ✅ Google ecosystem
- ✅ Auth muy robusta
- ✅ Free tier generoso

**Cons**:
- ⚠️ NoSQL (Firestore) - cambio de paradigma
- ⚠️ Vendor lock-in alto

**Coste**: $0-25/mes

##### Opción C: Custom Backend (Node.js + PostgreSQL)
**Pros**:
- ✅ Control total
- ✅ Sin vendor lock-in

**Cons**:
- ❌ Más tiempo de desarrollo (4 semanas)
- ❌ Mantenimiento propio
- ❌ Costes de hosting

**Coste**: $50-100/mes + 4 semanas dev

**Decisión**: Supabase (mejor balance features/tiempo/coste)

**Criterios de aceptación**:
- [ ] Cuenta Supabase creada
- [ ] Proyecto configurado
- [ ] SDK instalado (`@supabase/supabase-js`)
- [ ] Variables de entorno configuradas
- [ ] Conexión verificada

---

#### US-6.3: Migración IndexedDB → Supabase
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 3 días  
**Responsable**: Backend Developer

**Como** desarrollador  
**Quiero** migrar de IndexedDB a Supabase  
**Para** tener persistencia cloud

**Fases de migración**:

**Fase 1: Schema Design (0.5 día)**
```sql
-- Tablas principales
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE personal_data (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nominas (
  id SERIAL PRIMARY KEY,
  personal_data_id INTEGER REFERENCES personal_data(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  salario_bruto_anual DECIMAL(10,2) NOT NULL,
  activa BOOLEAN DEFAULT FALSE,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_nominas_user ON nominas(user_id);
CREATE INDEX idx_properties_user ON properties(user_id);
```

**Fase 2: Service Adapters (1.5 días)**
```typescript
// src/services/supabase/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

// src/services/supabase/nominaSupabaseService.ts
class NominaSupabaseService {
  async saveNomina(nomina: Nomit<Nomina, 'id'>): Promise<Nomina> {
    const { data, error } = await supabase
      .from('nominas')
      .insert(nomina)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
  
  async getNominas(personalDataId: number): Promise<Nomina[]> {
    const { data, error } = await supabase
      .from('nominas')
      .select('*')
      .eq('personal_data_id', personalDataId);
    
    if (error) throw error;
    return data || [];
  }
  
  // ... más métodos
}
```

**Fase 3: Migration Tool (1 día)**
```typescript
// src/utils/migrateToSupabase.ts
async function migrateUserData() {
  // 1. Leer todos los datos de IndexedDB
  const localNominas = await nominaService.getNominas();
  const localProperties = await propertyService.getProperties();
  
  // 2. Subir a Supabase
  for (const nomina of localNominas) {
    await nominaSupabaseService.saveNomina(nomina);
  }
  
  // 3. Marcar migración completa
  localStorage.setItem('migrated_to_supabase', 'true');
}
```

**Criterios de aceptación**:
- [ ] Schema de BD creado en Supabase
- [ ] Services migrados a Supabase
- [ ] Tool de migración funcional
- [ ] RLS (Row Level Security) configurado
- [ ] Tests de migración pasando

---

#### US-6.4: Resolver Vulnerabilidades NPM
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 1 día  
**Responsable**: DevOps

**Como** equipo técnico  
**Quiero** resolver vulnerabilidades de seguridad  
**Para** cumplir estándares de seguridad

**Tareas**:
```bash
# 1. Auditoría actual
npm audit

# 2. Fix automático
npm audit fix

# 3. Fix manual para breaking changes
npm audit fix --force

# 4. Actualizar paquetes específicos
npm update postcss nth-check css-select

# 5. Reemplazar paquetes deprecated
# react-beautiful-dnd → @dnd-kit/* (YA INSTALADO ✅)
npm uninstall react-beautiful-dnd

# 6. Re-ejecutar tests
npm test

# 7. Re-build
npm run build
```

**Criterios de aceptación**:
- [ ] 0 vulnerabilidades HIGH
- [ ] Max 2 vulnerabilidades MODERATE
- [ ] Paquetes deprecated removidos
- [ ] Build exitoso
- [ ] Tests pasando

---

### Entregables Sprint 6
- [ ] Sistema de auth funcional (login/registro/logout)
- [ ] Supabase configurado y conectado
- [ ] Schema de BD diseñado
- [ ] Migration path definido
- [ ] Vulnerabilidades resueltas
- [ ] Documentación de arquitectura actualizada

---

## 🟡 SPRINT 7: MULTI-TENANT (2 semanas)

### Objetivo
Implementar aislamiento de datos y sistema de permisos

### User Stories

#### US-7.1: Backend API REST
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 5 días

**Endpoints requeridos**:
```typescript
// Auth
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

// Nominas
GET    /api/nominas
POST   /api/nominas
GET    /api/nominas/:id
PUT    /api/nominas/:id
DELETE /api/nominas/:id

// Properties
GET    /api/properties
POST   /api/properties
GET    /api/properties/:id
PUT    /api/properties/:id
DELETE /api/properties/:id

// ... más endpoints
```

**Criterios de aceptación**:
- [ ] API REST funcional
- [ ] Autenticación JWT
- [ ] Rate limiting
- [ ] CORS configurado
- [ ] Logs de auditoría
- [ ] Documentación OpenAPI

---

#### US-7.2: Multi-tenant Isolation
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 3 días

**Tareas**:
- [ ] RLS policies en Supabase
- [ ] Middleware de aislamiento
- [ ] Tests de aislamiento
- [ ] Auditoría de seguridad

---

#### US-7.3: Roles y Permisos
**Prioridad**: 🟡 ALTA  
**Estimación**: 2 días

**Roles**:
- ADMIN: Acceso total
- MANAGER: Gestión inmuebles + finanzas
- VIEWER: Solo lectura

**Criterios de aceptación**:
- [ ] Tabla `user_roles` creada
- [ ] Middleware de autorización
- [ ] UI adapta según rol
- [ ] Tests de permisos

---

### Entregables Sprint 7
- [ ] API REST documentada
- [ ] Multi-tenant funcional
- [ ] Roles implementados
- [ ] Security audit pasado

---

## 💰 SPRINT 8: MONETIZACIÓN (2 semanas)

### Objetivo
Implementar sistema de pagos y suscripciones

### User Stories

#### US-8.1: Integración Stripe
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 4 días

**Planes propuestos**:
- **FREE**: 1 propiedad, features básicas
- **STARTER**: 5 propiedades, €9.99/mes
- **PRO**: Ilimitado, €29.99/mes

**Tareas**:
- [ ] Cuenta Stripe creada
- [ ] Productos y precios configurados
- [ ] Checkout integrado
- [ ] Webhooks configurados
- [ ] Customer portal

---

#### US-8.2: Gestión de Suscripciones
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 3 días

**Tareas**:
- [ ] Tabla `subscriptions`
- [ ] Upgrade/downgrade
- [ ] Cancelación
- [ ] Trial de 14 días
- [ ] Facturación automática

---

#### US-8.3: Límites por Plan
**Prioridad**: 🟡 ALTA  
**Estimación**: 2 días

**Tareas**:
- [ ] Middleware de límites
- [ ] Mensajes de upgrade
- [ ] Analytics de uso

---

### Entregables Sprint 8
- [ ] Stripe funcional
- [ ] 3 planes activos
- [ ] Facturación automática
- [ ] Customer portal

---

## 📜 SPRINT 9: LEGAL Y COMPLIANCE (2 semanas)

### Objetivo
Cumplimiento RGPD y requisitos legales

### User Stories

#### US-9.1: RGPD Compliance
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 5 días

**Tareas**:
- [ ] Banner de cookies
- [ ] Política de privacidad
- [ ] Términos de servicio
- [ ] Consentimientos
- [ ] Data export
- [ ] Data deletion

---

#### US-9.2: Auditoría de Seguridad
**Prioridad**: 🔴 CRÍTICA  
**Estimación**: 3 días

**Tareas**:
- [ ] Penetration testing
- [ ] Security headers
- [ ] XSS protection
- [ ] CSRF protection
- [ ] SQL injection tests

---

### Entregables Sprint 9
- [ ] RGPD compliant
- [ ] Security audit pasado
- [ ] Documentación legal

---

## ✨ SPRINT 10: COMPLETAR FUNCIONALIDADES (2 semanas)

### Objetivo
Completar rutas muertas y mejorar validación

### User Stories

#### US-10.1: Implementar Rutas Muertas
**Prioridad**: 🟡 ALTA  
**Estimación**: 5 días

**Rutas a implementar**:
- [ ] /documentacion
- [ ] /tesoreria/cobros-pagos
- [ ] /tesoreria/importar
- [ ] /contratos/renovacion
- [ ] /contratos/subidas

---

#### US-10.2: Validación Robusta
**Prioridad**: 🟡 ALTA  
**Estimación**: 3 días

**Tareas**:
- [ ] Validadores reutilizables
- [ ] Mensajes específicos
- [ ] Validación asíncrona
- [ ] Tests de validación

---

### Entregables Sprint 10
- [ ] 0 rutas muertas
- [ ] Validación consistente
- [ ] Tests E2E

---

## 🎨 SPRINT 11: UX Y ONBOARDING (2 semanas)

### Objetivo
Mejorar experiencia de usuario y onboarding

### User Stories

#### US-11.1: Tour Guiado
**Prioridad**: 🟡 MEDIA  
**Estimación**: 3 días

**Tareas**:
- [ ] Biblioteca de tours (driver.js)
- [ ] Tour inicial
- [ ] Tours contextuales
- [ ] Skip/completar tours

---

#### US-11.2: Ayuda Contextual
**Prioridad**: 🟡 MEDIA  
**Estimación**: 2 días

**Tareas**:
- [ ] Tooltips informativos
- [ ] Help icons
- [ ] FAQs inline

---

#### US-11.3: Documentación de Usuario
**Prioridad**: 🟡 MEDIA  
**Estimación**: 3 días

**Tareas**:
- [ ] Manual de usuario
- [ ] Videos tutoriales
- [ ] Centro de ayuda
- [ ] Knowledge base

---

### Entregables Sprint 11
- [ ] Tour funcional
- [ ] Ayuda contextual
- [ ] Documentación completa

---

## 📋 CHECKLIST DE PREPARACIÓN PARA INVERSORES

### Pre-Sprint
- [ ] Equipo completo asignado
- [ ] Entorno de desarrollo configurado
- [ ] Supabase account creada

### Post-Sprint 6
- [ ] ✅ Autenticación funcional
- [ ] ✅ Backend conectado
- [ ] ✅ Vulnerabilidades resueltas

### Post-Sprint 7
- [ ] ✅ Multi-tenant funcional
- [ ] ✅ API REST documentada
- [ ] ✅ Roles implementados

### Post-Sprint 8
- [ ] ✅ Pagos funcionales
- [ ] ✅ 3 planes activos
- [ ] ✅ Facturación automática

### Post-Sprint 9
- [ ] ✅ RGPD compliant
- [ ] ✅ Security audit pasado

### Post-Sprint 10
- [ ] ✅ Funcionalidades completas
- [ ] ✅ 0 rutas muertas

### Post-Sprint 11
- [ ] ✅ Onboarding completo
- [ ] ✅ Documentación lista

### Lanzamiento MVP
- [ ] ✅ Demo preparada
- [ ] ✅ Pitch deck actualizado
- [ ] ✅ Métricas definidas
- [ ] ✅ Plan de marketing

---

## 🎯 MÉTRICAS DE ÉXITO

### Técnicas
- 0 vulnerabilidades HIGH
- >90% code coverage
- <2s tiempo de carga
- 99.9% uptime

### Negocio
- 100 usuarios beta
- <5% churn rate
- >4.5 rating
- 10% conversión free→paid

---

**Documento generado por**: GitHub Copilot Agent  
**Fecha**: 31 de Octubre de 2024  
**Versión**: 1.0
