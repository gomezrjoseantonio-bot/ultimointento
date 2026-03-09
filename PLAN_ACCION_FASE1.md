# 🚀 PLAN DE ACCIÓN - Fase 1 Crítica (6 semanas)

**Objetivo**: Preparar aplicación para venta de suscripciones  
**Duración**: 6 semanas  
**Inversión**: €8,850  
**Estado**: 📋 PENDIENTE DE INICIO

---

## 📊 PROGRESO GENERAL

```
SEMANA 1: [          ] 0%  - Infraestructura base
SEMANA 2: [          ] 0%  - Auth + Suscripciones  
SEMANA 3: [          ] 0%  - Backend API
SEMANA 4: [          ] 0%  - Migración datos
SEMANA 5: [          ] 0%  - Legal + Seguridad
SEMANA 6: [          ] 0%  - Testing + QA

TOTAL:    [          ] 0%
```

---

## 🗓️ SEMANA 1: DECISIONES Y SETUP (0-7 días)

### Día 1-2: Decisiones Estratégicas
- [ ] **DECISIÓN: Stack Backend**
  - [ ] Opción A: Supabase (rápido, recomendado)
  - [ ] Opción B: Node.js + PostgreSQL (personalizado)
  - [ ] Documentar decisión y razones en `/docs/decisions/backend-stack.md`

- [ ] **DECISIÓN: Auth Provider**
  - [ ] Opción A: Supabase Auth (si Supabase backend)
  - [ ] Opción B: Auth0
  - [ ] Opción C: Firebase Auth
  - [ ] Documentar decisión en `/docs/decisions/auth-provider.md`

- [ ] **DECISIÓN: Payment Provider**
  - [ ] Stripe (recomendado para EU)
  - [ ] PayPal (alternativa)
  - [ ] Paddle (alternativa con IVA incluido)
  - [ ] Documentar decisión en `/docs/decisions/payment-provider.md`

### Día 3-4: Setup Infraestructura

#### Si Supabase (Opción A):
- [ ] Crear cuenta en Supabase
- [ ] Crear proyecto en Supabase
- [ ] Configurar base de datos PostgreSQL
- [ ] Activar Auth en Supabase
- [ ] Configurar políticas RLS (Row Level Security)
- [ ] Instalar dependencias:
  ```bash
  npm install @supabase/supabase-js
  npm install @supabase/auth-helpers-react
  ```
- [ ] Crear archivo `src/lib/supabase.ts`
  ```typescript
  import { createClient } from '@supabase/supabase-js';
  
  export const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL!,
    process.env.REACT_APP_SUPABASE_ANON_KEY!
  );
  ```
- [ ] Actualizar `.env` con credenciales Supabase

#### Si Backend Custom (Opción B):
- [ ] Crear proyecto Node.js + Express en `/backend`
- [ ] Configurar PostgreSQL (Railway/Neon/AWS RDS)
- [ ] Configurar Auth0/Firebase
- [ ] Setup estructura base:
  ```
  backend/
  ├── src/
  │   ├── routes/
  │   ├── controllers/
  │   ├── models/
  │   ├── middleware/
  │   └── server.ts
  ├── package.json
  └── tsconfig.json
  ```
- [ ] Instalar dependencias:
  ```bash
  npm install express cors dotenv pg jsonwebtoken bcrypt
  npm install -D @types/express @types/node typescript
  ```

### Día 5-7: Setup Pagos
- [ ] Crear cuenta en Stripe
- [ ] Crear productos en Stripe Dashboard:
  - [ ] Plan FREE (€0)
  - [ ] Plan STARTER (€29/mes o €290/año)
  - [ ] Plan PROFESSIONAL (€79/mes o €790/año)
- [ ] Configurar webhooks en Stripe:
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
- [ ] Instalar Stripe SDK:
  ```bash
  npm install stripe @stripe/stripe-js @stripe/react-stripe-js
  ```
- [ ] Crear función Netlify para webhooks:
  ```typescript
  // functions/stripe-webhooks.ts
  import Stripe from 'stripe';
  
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  
  export async function handler(event: any) {
    const sig = event.headers['stripe-signature'];
    // Handle webhook events
  }
  ```

**ENTREGABLE SEMANA 1**:
✅ Infraestructura configurada  
✅ Cuentas creadas (Supabase/Stripe/etc)  
✅ Variables de entorno configuradas  
✅ Decisiones documentadas

---

## 🗓️ SEMANA 2: AUTENTICACIÓN (7-14 días)

### Frontend: Páginas de Auth
- [ ] Crear `src/pages/auth/LoginPage.tsx`
  - [ ] Form con email/password
  - [ ] Botón "Olvidé mi contraseña"
  - [ ] Link a registro
  - [ ] Google OAuth (opcional)
  - [ ] Manejo de errores
  - [ ] Loading states

- [ ] Crear `src/pages/auth/RegisterPage.tsx`
  - [ ] Form con email/password/confirmPassword/name
  - [ ] Validación de contraseña fuerte
  - [ ] Checkbox términos y condiciones
  - [ ] Checkbox política de privacidad
  - [ ] Link a login
  - [ ] Manejo de errores

- [ ] Crear `src/pages/auth/ForgotPasswordPage.tsx`
  - [ ] Form con email
  - [ ] Envío de email recuperación
  - [ ] Mensajes de confirmación

- [ ] Crear `src/pages/auth/ResetPasswordPage.tsx`
  - [ ] Form con nueva contraseña
  - [ ] Validación de token
  - [ ] Confirmación de cambio

### Service: Autenticación
- [ ] Crear `src/services/authService.ts`
  ```typescript
  export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    subscriptionId?: string;
    subscriptionStatus?: 'active' | 'cancelled' | 'past_due' | 'trialing';
    subscriptionPlan?: 'free' | 'starter' | 'professional';
    trialEndsAt?: Date;
    createdAt: Date;
  }

  export interface AuthService {
    // Registration
    register(email: string, password: string, name: string): Promise<User>;
    verifyEmail(token: string): Promise<void>;
    
    // Login
    login(email: string, password: string): Promise<User>;
    loginWithGoogle(): Promise<User>;
    logout(): Promise<void>;
    
    // Password
    resetPasswordRequest(email: string): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
    changePassword(oldPassword: string, newPassword: string): Promise<void>;
    
    // User
    getCurrentUser(): User | null;
    updateProfile(data: Partial<User>): Promise<User>;
    deleteAccount(): Promise<void>;
  }
  ```

### Context: Auth
- [ ] Crear `src/contexts/AuthContext.tsx`
  ```typescript
  interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (data: Partial<User>) => Promise<void>;
  }
  ```
- [ ] Wrap App con AuthProvider
- [ ] Crear ProtectedRoute component

### Routing: Protección
- [ ] Crear `src/components/auth/ProtectedRoute.tsx`
  - [ ] Verificar si usuario está autenticado
  - [ ] Redirigir a /login si no
  - [ ] Verificar suscripción activa
  - [ ] Mostrar mensaje si suscripción expirada

- [ ] Actualizar `src/App.tsx`
  - [ ] Rutas públicas: /, /login, /register, /forgot-password
  - [ ] Rutas protegidas: todo lo demás
  - [ ] Redirección automática

### Testing Auth
- [ ] Test: Registro exitoso
- [ ] Test: Login exitoso
- [ ] Test: Login con credenciales incorrectas
- [ ] Test: Logout
- [ ] Test: Recuperación de contraseña
- [ ] Test: Persistencia de sesión

**ENTREGABLE SEMANA 2**:
✅ Sistema de auth funcional  
✅ Páginas login/register/reset  
✅ Protección de rutas implementada  
✅ Tests básicos pasando

---

## 🗓️ SEMANA 3: SISTEMA DE SUSCRIPCIONES (14-21 días)

### Database Schema
- [ ] Crear tabla `subscriptions` en Supabase/PostgreSQL
  ```sql
  CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    plan_id TEXT NOT NULL, -- 'free', 'starter', 'professional'
    status TEXT NOT NULL, -- 'active', 'cancelled', 'past_due', 'trialing'
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_ends_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Crear tabla `invoices`
  ```sql
  CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID REFERENCES subscriptions(id),
    stripe_invoice_id TEXT UNIQUE,
    amount_due INTEGER NOT NULL,
    amount_paid INTEGER,
    currency TEXT DEFAULT 'eur',
    status TEXT NOT NULL, -- 'draft', 'open', 'paid', 'void'
    invoice_pdf TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

### Service: Suscripciones
- [ ] Crear `src/services/subscriptionService.ts`
  ```typescript
  export interface SubscriptionPlan {
    id: 'free' | 'starter' | 'professional';
    name: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
    limits: {
      properties: number;
      contracts: number;
      users: number;
    };
  }

  export interface SubscriptionService {
    // Plans
    getPlans(): SubscriptionPlan[];
    getCurrentPlan(): Promise<SubscriptionPlan>;
    
    // Subscription
    createSubscription(planId: string): Promise<string>; // Returns checkout URL
    cancelSubscription(): Promise<void>;
    resumeSubscription(): Promise<void>;
    
    // Payment Method
    getPaymentMethod(): Promise<PaymentMethod>;
    updatePaymentMethod(paymentMethodId: string): Promise<void>;
    
    // Invoices
    getInvoices(): Promise<Invoice[]>;
    downloadInvoice(invoiceId: string): Promise<Blob>;
    
    // Limits
    checkLimit(resource: 'properties' | 'contracts' | 'users'): Promise<boolean>;
    getUsage(): Promise<{ properties: number; contracts: number; users: number }>;
  }
  ```

### Páginas: Plan & Facturación
- [ ] ACTUALIZAR `src/modules/horizon/configuracion/plan-facturacion/PlanFacturacion.tsx`
  ```typescript
  // Eliminar "En construcción"
  // Implementar:
  // - Mostrar plan actual
  // - Botón "Cambiar plan" → modal con opciones
  // - Tabla de facturas
  // - Método de pago actual
  // - Botón "Cancelar suscripción"
  ```

- [ ] Crear `src/components/subscription/PlanSelector.tsx`
  - [ ] Mostrar 3 planes (FREE, STARTER, PRO)
  - [ ] Destacar plan actual
  - [ ] Botón "Seleccionar" por cada plan
  - [ ] Mostrar features y límites
  - [ ] Comparación de planes

- [ ] Crear `src/components/subscription/PaymentMethodCard.tsx`
  - [ ] Mostrar método de pago (últimos 4 dígitos)
  - [ ] Botón "Actualizar"
  - [ ] Modal con Stripe Elements

- [ ] Crear `src/components/subscription/InvoicesList.tsx`
  - [ ] Tabla de facturas
  - [ ] Botón descargar PDF
  - [ ] Filtros por fecha/estado

### Funciones Netlify: Stripe
- [ ] Crear `functions/stripe-create-checkout.ts`
  ```typescript
  // Crear sesión de Stripe Checkout
  // Devolver URL para redirigir
  ```

- [ ] Crear `functions/stripe-create-portal.ts`
  ```typescript
  // Crear sesión de Stripe Customer Portal
  // Devolver URL para redirigir
  ```

- [ ] Crear `functions/stripe-webhooks.ts`
  ```typescript
  // Manejar eventos de Stripe:
  // - invoice.payment_succeeded → activar suscripción
  // - invoice.payment_failed → marcar como past_due
  // - customer.subscription.deleted → cancelar acceso
  // - customer.subscription.updated → actualizar datos
  ```

### Testing Suscripciones
- [ ] Test: Crear suscripción STARTER
- [ ] Test: Crear suscripción PROFESSIONAL
- [ ] Test: Cancelar suscripción
- [ ] Test: Reactivar suscripción
- [ ] Test: Webhook payment_succeeded
- [ ] Test: Webhook payment_failed
- [ ] Test: Límites por plan (free: 3 propiedades)

**ENTREGABLE SEMANA 3**:
✅ Sistema de suscripciones funcional  
✅ Integración Stripe completa  
✅ Webhooks configurados y testeados  
✅ Módulo Plan & Facturación implementado

---

## 🗓️ SEMANA 4: BACKEND API Y MIGRACIÓN (21-28 días)

### API REST/GraphQL
- [ ] Crear endpoints para cada recurso:

#### Properties API
```typescript
// GET /api/properties - Listar propiedades del usuario
// POST /api/properties - Crear propiedad
// GET /api/properties/:id - Obtener detalle
// PUT /api/properties/:id - Actualizar
// DELETE /api/properties/:id - Eliminar
```

#### Contracts API
```typescript
// GET /api/contracts - Listar contratos
// POST /api/contracts - Crear contrato
// GET /api/contracts/:id - Obtener detalle
// PUT /api/contracts/:id - Actualizar
// DELETE /api/contracts/:id - Eliminar
```

#### Loans API, Treasury API, Expenses API, etc.

### Middleware
- [ ] Crear `middleware/auth.ts`
  - [ ] Verificar JWT token
  - [ ] Extraer user_id
  - [ ] Añadir a req.user

- [ ] Crear `middleware/subscription.ts`
  - [ ] Verificar suscripción activa
  - [ ] Verificar límites por plan
  - [ ] Rechazar si excede límites

- [ ] Crear `middleware/rateLimit.ts`
  - [ ] Limitar requests por usuario
  - [ ] Prevenir abuso

### Migración de Servicios
- [ ] Actualizar `src/services/propertyService.ts`
  - [ ] Reemplazar IndexedDB por API calls
  - [ ] Mantener interfaz pública igual
  ```typescript
  // ANTES:
  export const getAllProperties = async (): Promise<Property[]> => {
    const db = await getDB();
    return db.getAll('properties');
  };

  // DESPUÉS:
  export const getAllProperties = async (): Promise<Property[]> => {
    const response = await fetch('/api/properties', {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.json();
  };
  ```

- [ ] Repetir para TODOS los servicios:
  - [ ] contractService.ts
  - [ ] loanService.ts (préstamos)
  - [ ] treasuryService.ts (tesorería)
  - [ ] expenseService.ts (gastos)
  - [ ] budgetService.ts (presupuestos)
  - [ ] fiscalService.ts (fiscalidad)
  - [ ] etc. (todos los que usan db.ts)

### Multi-Tenant Data Isolation
- [ ] Añadir `user_id` a TODAS las tablas
  ```sql
  ALTER TABLE properties ADD COLUMN user_id UUID REFERENCES auth.users(id);
  ALTER TABLE contracts ADD COLUMN user_id UUID REFERENCES auth.users(id);
  -- etc. para todas las tablas
  ```

- [ ] Crear Row Level Security policies en Supabase:
  ```sql
  -- Properties RLS
  ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "Users can only see their own properties"
    ON properties FOR SELECT
    USING (auth.uid() = user_id);
  
  CREATE POLICY "Users can only insert their own properties"
    ON properties FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  
  -- Repetir para todas las tablas
  ```

### Data Migration Tool
- [ ] Crear `src/services/dataMigrationService.ts`
  ```typescript
  export class DataMigrationService {
    async migrateAllData(userId: string) {
      try {
        // 1. Export from IndexedDB
        const localData = await this.exportLocalData();
        
        // 2. Upload to backend
        await this.uploadProperties(userId, localData.properties);
        await this.uploadContracts(userId, localData.contracts);
        await this.uploadLoans(userId, localData.loans);
        // ... etc.
        
        // 3. Verify migration
        const verification = await this.verifyMigration(userId);
        
        // 4. Clear local data (optional, ask user)
        if (verification.success) {
          await this.clearLocalData();
        }
        
        return { success: true, counts: verification.counts };
      } catch (error) {
        console.error('Migration failed:', error);
        throw error;
      }
    }
  }
  ```

- [ ] Crear página de migración `src/pages/MigrationPage.tsx`
  - [ ] Mostrar progreso de migración
  - [ ] Logs detallados
  - [ ] Botón "Iniciar migración"
  - [ ] Avisos y confirmaciones

### Testing API
- [ ] Test: CRUD propiedades con auth
- [ ] Test: Multi-tenant isolation (user A no ve data de user B)
- [ ] Test: Límites por suscripción
- [ ] Test: Rate limiting
- [ ] Test: Migración completa de datos

**ENTREGABLE SEMANA 4**:
✅ API REST completa y funcional  
✅ Servicios migrados a backend  
✅ Multi-tenant implementado y testeado  
✅ Herramienta de migración de datos

---

## 🗓️ SEMANA 5: SEGURIDAD Y CUMPLIMIENTO LEGAL (28-35 días)

### Vulnerabilidades
- [ ] Resolver vulnerabilidades npm
  ```bash
  npm audit
  npm audit fix
  # Si no funciona:
  npm update nth-check postcss webpack-dev-server
  # Reemplazar xlsx si necesario:
  npm uninstall xlsx
  npm install exceljs
  ```
- [ ] Actualizar dependencies críticas
- [ ] Testing después de actualizar
- [ ] Verificar que no se rompió nada

### Políticas Legales
- [ ] Escribir **Política de Privacidad**
  - [ ] Qué datos recopilamos
  - [ ] Cómo los usamos
  - [ ] Cómo los protegemos
  - [ ] Derechos RGPD
  - [ ] Cookies que usamos
  - [ ] Contacto DPO

- [ ] Escribir **Términos y Condiciones**
  - [ ] Uso aceptable
  - [ ] Límites de responsabilidad
  - [ ] Propiedad intelectual
  - [ ] Política de cancelación
  - [ ] Reembolsos
  - [ ] Resolución de disputas

- [ ] Escribir **Política de Cookies**
  - [ ] Tipos de cookies
  - [ ] Finalidad
  - [ ] Cómo desactivarlas

- [ ] Crear páginas:
  - [ ] `/legal/privacidad`
  - [ ] `/legal/terminos`
  - [ ] `/legal/cookies`

### RGPD Implementation
- [ ] Instalar Cookie Consent banner
  ```bash
  npm install react-cookie-consent
  ```
  ```typescript
  <CookieConsent
    location="bottom"
    buttonText="Aceptar todas"
    declineButtonText="Solo necesarias"
    enableDeclineButton
    onAccept={() => {
      // Activar Google Analytics, etc.
      gtag('consent', 'update', {
        'analytics_storage': 'granted'
      });
    }}
    onDecline={() => {
      // Solo cookies esenciales
    }}
  >
    Usamos cookies para mejorar tu experiencia. 
    <a href="/legal/cookies">Más información</a>
  </CookieConsent>
  ```

- [ ] Implementar derecho al olvido
  ```typescript
  // src/services/gdprService.ts
  export const deleteUserData = async (userId: string) => {
    // 1. Anonimizar datos personales
    await anonymizeUser(userId);
    
    // 2. Eliminar datos sensibles
    await deleteProperties(userId);
    await deleteContracts(userId);
    // ... etc.
    
    // 3. Mantener datos agregados/anónimos para analytics
    // 4. Log de la eliminación (obligatorio RGPD)
    await logDeletion(userId);
  };
  ```

- [ ] Implementar exportación de datos
  ```typescript
  export const exportUserData = async (userId: string): Promise<Blob> => {
    const data = {
      user: await getUserProfile(userId),
      properties: await getProperties(userId),
      contracts: await getContracts(userId),
      // ... todo lo que tenga el usuario
    };
    
    return new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
  };
  ```

- [ ] Añadir opciones en configuración:
  - [ ] "Exportar mis datos" (botón)
  - [ ] "Eliminar mi cuenta" (botón con confirmación)

### Encriptación
- [ ] HTTPS forzado (Netlify lo hace automático)
- [ ] Encriptar datos sensibles en DB:
  ```typescript
  // Ejemplo: Encriptar IBANs
  import crypto from 'crypto';
  
  const encrypt = (text: string): string => {
    const cipher = crypto.createCipher('aes-256-gcm', SECRET_KEY);
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  };
  
  const decrypt = (encrypted: string): string => {
    const decipher = crypto.createDecipher('aes-256-gcm', SECRET_KEY);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  };
  ```

### Logs de Auditoría
- [ ] Crear tabla `audit_logs`
  ```sql
  CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'login', 'logout', 'delete_property', etc.
    resource TEXT, -- 'property:123', 'contract:456', etc.
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```

- [ ] Log eventos importantes:
  - [ ] Login/Logout
  - [ ] Cambios de suscripción
  - [ ] Eliminación de datos
  - [ ] Exportación de datos
  - [ ] Cambio de contraseña

**ENTREGABLE SEMANA 5**:
✅ Sin vulnerabilidades críticas  
✅ Políticas legales publicadas  
✅ RGPD implementado  
✅ Encriptación de datos sensibles  
✅ Logs de auditoría funcionando

---

## 🗓️ SEMANA 6: TESTING Y QA (35-42 días)

### Tests E2E (End-to-End)
- [ ] Setup Playwright/Cypress
  ```bash
  npm install -D @playwright/test
  npx playwright install
  ```

- [ ] Test: Flujo completo registro → suscripción
  ```typescript
  test('User can register and subscribe', async ({ page }) => {
    // 1. Registro
    await page.goto('/register');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'SecurePass123!');
    await page.fill('[data-testid="name"]', 'Test User');
    await page.check('[data-testid="terms"]');
    await page.click('[data-testid="submit"]');
    
    // 2. Verificar redirección a plan selection
    await page.waitForURL('/plan-facturacion');
    
    // 3. Seleccionar plan STARTER
    await page.click('[data-testid="plan-starter"]');
    
    // 4. Stripe Checkout (usar test card)
    await page.waitForURL(/checkout.stripe.com/);
    await page.fill('[name="cardNumber"]', '4242424242424242');
    await page.fill('[name="cardExpiry"]', '12/25');
    await page.fill('[name="cardCvc"]', '123');
    await page.click('[data-testid="submit-payment"]');
    
    // 5. Verificar suscripción activa
    await page.waitForURL('/dashboard');
    await expect(page.locator('[data-testid="subscription-badge"]')).toHaveText('STARTER');
  });
  ```

- [ ] Test: Crear propiedad
- [ ] Test: Crear contrato
- [ ] Test: Límites de plan (free: max 3 propiedades)
- [ ] Test: Cancelar suscripción
- [ ] Test: Exportar datos RGPD

### Tests de Integración
- [ ] Test: Auth + Suscripción
- [ ] Test: Suscripción + Límites
- [ ] Test: Webhooks Stripe → Update DB
- [ ] Test: Migración de datos

### QA Manual (checklist)
#### Registro y Login
- [ ] Registro con email válido
- [ ] Registro con email duplicado (error)
- [ ] Registro con contraseña débil (error)
- [ ] Login con credenciales correctas
- [ ] Login con credenciales incorrectas (error)
- [ ] Logout
- [ ] Recuperar contraseña
- [ ] Cambiar contraseña

#### Suscripciones
- [ ] Ver planes disponibles
- [ ] Suscribirse a STARTER
- [ ] Suscribirse a PROFESSIONAL
- [ ] Ver plan actual en configuración
- [ ] Ver facturas
- [ ] Descargar factura PDF
- [ ] Actualizar método de pago
- [ ] Cancelar suscripción
- [ ] Reactivar suscripción

#### Funcionalidades principales
- [ ] Crear propiedad (plan FREE)
- [ ] Intentar crear 4ta propiedad en FREE (bloqueado)
- [ ] Upgrade a STARTER
- [ ] Crear más propiedades (permitido)
- [ ] Crear contrato
- [ ] Crear préstamo
- [ ] Ver tesorería
- [ ] Exportar datos

#### RGPD
- [ ] Banner de cookies aparece
- [ ] Aceptar cookies
- [ ] Rechazar cookies
- [ ] Ver política de privacidad
- [ ] Ver términos y condiciones
- [ ] Exportar datos personales
- [ ] Eliminar cuenta (con confirmación)

#### Responsive
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

#### Navegadores
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Beta Testing
- [ ] Reclutar 5-10 usuarios beta
- [ ] Darles acceso gratis durante 1 mes
- [ ] Recoger feedback:
  - [ ] Qué les gusta
  - [ ] Qué les confunde
  - [ ] Qué falta
  - [ ] Bugs encontrados
- [ ] Priorizar feedback
- [ ] Corregir bugs críticos
- [ ] Implementar mejoras rápidas

### Performance Testing
- [ ] Lighthouse score > 90
- [ ] Load time < 3s
- [ ] API response time < 500ms
- [ ] Bundle size < 300KB (gzipped)

### Security Testing
- [ ] Intentar acceder a datos de otro usuario (bloqueado)
- [ ] Intentar usar API sin auth (bloqueado)
- [ ] SQL injection attempts (bloqueado)
- [ ] XSS attempts (bloqueado)
- [ ] CSRF protection (verificado)

**ENTREGABLE SEMANA 6**:
✅ Tests E2E completos y pasando  
✅ QA manual completado  
✅ Beta testing con feedback positivo  
✅ Bugs críticos corregidos  
✅ Performance optimizado  
✅ Security verificado

---

## ✅ DEFINICIÓN DE "HECHO" (Definition of Done)

### Funcionalidad se considera completa cuando:
- [ ] ✅ Código implementado y funcional
- [ ] ✅ Tests unitarios escritos y pasando
- [ ] ✅ Tests E2E escritos y pasando (si aplica)
- [ ] ✅ QA manual realizado
- [ ] ✅ Code review aprobado
- [ ] ✅ Documentación actualizada
- [ ] ✅ Sin vulnerabilidades de seguridad
- [ ] ✅ Desplegado en staging
- [ ] ✅ Validado por stakeholder

### Fase 1 se considera completa cuando:
- [ ] ✅ Todas las tareas marcadas ✅
- [ ] ✅ Checklist pre-lanzamiento 100%
- [ ] ✅ Beta testing completado con éxito
- [ ] ✅ No hay bugs bloqueantes (P0)
- [ ] ✅ Menos de 5 bugs críticos (P1)
- [ ] ✅ Aprobación final del stakeholder
- [ ] ✅ Desplegado en producción
- [ ] ✅ Monitoring configurado y funcionando

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs a medir:
```
TÉCNICOS:
- Uptime: > 99.5%
- API response time: < 500ms (p95)
- Error rate: < 0.1%
- Lighthouse score: > 90

NEGOCIO:
- Conversión registro → pago: > 10%
- Churn rate: < 5% mensual
- NPS (Net Promoter Score): > 40
- Customer Lifetime Value (CLV): > €300

USUARIOS:
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Retention D7/D30
- Feature adoption rates
```

---

## 🚨 GESTIÓN DE RIESGOS

### Riesgo: Retraso en desarrollo
**Probabilidad**: Media  
**Impacto**: Alto  
**Mitigación**: Buffer de 1 semana incluido, scope reducido si necesario

### Riesgo: Bugs críticos en producción
**Probabilidad**: Media  
**Impacto**: Alto  
**Mitigación**: Beta testing extensivo, monitoring agresivo, rollback plan

### Riesgo: Bajo adoption por usuarios
**Probabilidad**: Baja  
**Impacto**: Alto  
**Mitigación**: Plan FREE generoso, onboarding guiado, soporte proactivo

### Riesgo: Problemas con Stripe webhooks
**Probabilidad**: Baja  
**Impacto**: Crítico  
**Mitigación**: Testing exhaustivo, logs detallados, webhook retry logic

---

## 📞 COMUNICACIÓN Y REPORTES

### Reportes semanales (cada viernes):
```markdown
## Reporte Semana X

**Progreso**: X% completado

**Completado esta semana**:
- [ ] Task 1
- [ ] Task 2

**En progreso**:
- [ ] Task 3 (50%)

**Bloqueadores**:
- Ninguno / Issue XYZ

**Próxima semana**:
- [ ] Task 4
- [ ] Task 5

**Riesgos identificados**:
- Riesgo A (Mitigación: ...)

**Necesito ayuda con**:
- Decisión sobre X
- Review de Y
```

### Daily standups (opcional si equipo > 1):
- Qué hice ayer
- Qué haré hoy
- Bloqueadores

### Canales de comunicación:
- Slack/Discord: Actualizaciones diarias
- Email: Reportes semanales
- GitHub Issues: Tracking de bugs/features
- GitHub Projects: Kanban board

---

## 🎯 SIGUIENTE ACCIÓN

**ACCIÓN INMEDIATA** (esta semana):
1. ✅ Revisar este plan con equipo/stakeholders
2. 🎯 **DECIDIR**: ¿Supabase o backend custom?
3. 💰 **APROBAR**: Presupuesto de €8,850
4. 👥 **ASIGNAR**: Developer(s) al proyecto
5. 📅 **CREAR**: Calendario con hitos semanales
6. 🚀 **INICIAR**: Día 1 de Semana 1

---

**Creado**: ${new Date().toLocaleDateString('es-ES')}  
**Actualizar**: Cada viernes durante desarrollo  
**Versión**: 1.0.0
