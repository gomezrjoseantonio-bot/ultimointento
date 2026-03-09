import React, { useState, useEffect } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import { useTheme } from '../../../../contexts/ThemeContext';
import { 
  Copy, 
  RotateCcw, 
  Power, 
  PowerOff, 
  Mail, 
  FileText, 
  Search,
  CheckCircle,
  XCircle,
  Upload,
  Info,
  ExternalLink,
  Shield,
  Plus,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  emailIngestService, 
  EmailAlias, 
  EmailProcessingResult,
  EMAIL_LIMITS 
} from '../../../../services/emailIngestService';
import { initDB } from '../../../../services/db';

// Enhanced interface for H3 requirements
interface EmailLog extends EmailProcessingResult {
  isMock?: boolean;
}

const EmailEntrante: React.FC = () => {
  const { currentModule } = useTheme();
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInstructions, setShowInstructions] = useState(false);
  // Issue 2: Whitelist management
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [newWhitelistEmail, setNewWhitelistEmail] = useState('');
  // Properties for property aliases
  const [properties, setProperties] = useState<any[]>([]);

  const subtitle = currentModule === 'horizon' 
    ? 'Gestión de correo entrante para recepción automática de facturas en Horizon.'
    : 'Gestión de correo entrante para recepción automática de documentos en Pulse.';

  // Initialize with enhanced data including tenant tokens
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load properties from database
      const db = await initDB();
      const props = await db.getAll('properties');
      setProperties(props);

      // Issue 1: Generate aliases with proper tenant tokens
      const sampleAliases: EmailAlias[] = [
        {
          id: 'global-1',
          email: emailIngestService.generateGlobalAlias(),
          type: 'global',
          tenantToken: 'mock-token-123',
          isActive: true,
          created: new Date(Date.now() - 86400000), // 1 day ago
          lastUsed: new Date(Date.now() - 3600000) // 1 hour ago
        },
        {
          id: 'personal-1',
          email: emailIngestService.generatePersonalAlias(),
          type: 'personal',
          tenantToken: 'mock-token-123',
          isActive: true,
          created: new Date(Date.now() - 172800000), // 2 days ago
        }
      ];

      // Add property aliases for existing properties
      props.slice(0, 2).forEach((prop, index) => {
        const propertySlug = prop.alias.toLowerCase().replace(/\s+/g, '-');
        sampleAliases.push({
          id: `prop-${prop.id}`,
          email: emailIngestService.generatePropertyAlias(propertySlug),
          type: 'property',
          target: prop.alias,
          tenantToken: 'mock-token-123',
          isActive: index === 0, // First property active by default
          created: new Date(Date.now() - (index + 1) * 86400000)
        });
      });

      // Enhanced email logs with H3 counters
      const sampleLogs: EmailLog[] = [
        {
          id: 'log-1',
          date: new Date(Date.now() - 3600000),
          from: 'facturacion@iberdrola.es',
          subject: 'Factura electricidad - Marzo 2024',
          alias: emailIngestService.generateGlobalAlias(),
          attachmentCount: 1,
          status: 'procesado',
          documentsCreated: 1,
          documentsIgnored: 0,
          documentsDuplicated: 0
        },
        {
          id: 'log-2',
          date: new Date(Date.now() - 7200000),
          from: 'noreply@gasnatural.com',
          subject: 'Recordatorio de pago',
          alias: emailIngestService.generatePropertyAlias('madrid-centro'),
          attachmentCount: 0,
          status: 'sin-adjuntos',
          documentsCreated: 0,
          documentsIgnored: 0,
          documentsDuplicated: 0
        },
        {
          id: 'log-3',
          date: new Date(Date.now() - 10800000),
          from: 'spam@suspicious.com',
          subject: 'Oferta especial',
          alias: emailIngestService.generatePersonalAlias(),
          attachmentCount: 2,
          status: 'rechazado',
          reason: 'remitente no autorizado',
          documentsCreated: 0,
          documentsIgnored: 0,
          documentsDuplicated: 0
        }
      ];

      setAliases(sampleAliases);
      setEmailLogs(sampleLogs);

      // Load whitelist configuration
      emailIngestService.setWhitelist([], false);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Error cargando datos iniciales');
    }
  };

  // Issue 1: Copy alias to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Email copiado al portapapeles');
  };

  // Issue 1: Generate new property alias
  const generatePropertyAlias = (propertyId: string) => {
    const property = properties.find(p => p.id.toString() === propertyId);
    if (!property) return;

    const propertySlug = property.alias.toLowerCase().replace(/\s+/g, '-');
    const newAlias: EmailAlias = {
      id: `prop-${Date.now()}`,
      email: emailIngestService.generatePropertyAlias(propertySlug),
      type: 'property',
      target: property.alias,
      tenantToken: 'mock-token-123',
      isActive: true,
      created: new Date()
    };

    setAliases(prev => [...prev, newAlias]);
    toast.success('Alias de inmueble generado correctamente');
  };

  // Issue 2: Whitelist management functions
  const addToWhitelist = () => {
    if (!newWhitelistEmail.trim()) return;
    
    if (whitelist.includes(newWhitelistEmail.trim())) {
      toast.error('El email ya está en la lista blanca');
      return;
    }

    const updatedWhitelist = [...whitelist, newWhitelistEmail.trim()];
    setWhitelist(updatedWhitelist);
    emailIngestService.setWhitelist(updatedWhitelist, whitelistEnabled);
    setNewWhitelistEmail('');
    toast.success('Email añadido a la lista blanca');
  };

  const removeFromWhitelist = (email: string) => {
    const updatedWhitelist = whitelist.filter(e => e !== email);
    setWhitelist(updatedWhitelist);
    emailIngestService.setWhitelist(updatedWhitelist, whitelistEnabled);
    toast.success('Email eliminado de la lista blanca');
  };

  const toggleWhitelist = () => {
    const newEnabled = !whitelistEnabled;
    setWhitelistEnabled(newEnabled);
    emailIngestService.setWhitelist(whitelist, newEnabled);
    toast.success(`Lista blanca ${newEnabled ? 'activada' : 'desactivada'}`);
  };

  // H3 requirement - Navigate to inbox with filter for specific email log
  const handleViewInInbox = (emailLogId: string) => {
    // Navigate to inbox with a filter parameter to show only documents from this email log
    window.location.href = `/inbox?emailLog=${emailLogId}`;
  };

  const regenerateAlias = (aliasId: string) => {
    setAliases(prev => prev.map(alias => {
      if (alias.id === aliasId) {
        let newEmail: string;
        switch (alias.type) {
          case 'global':
            newEmail = emailIngestService.generateGlobalAlias();
            break;
          case 'personal':
            newEmail = emailIngestService.generatePersonalAlias();
            break;
          case 'property':
            const propertySlug = alias.target?.toLowerCase().replace(/\s+/g, '-') || 'property';
            newEmail = emailIngestService.generatePropertyAlias(propertySlug);
            break;
          default:
            newEmail = alias.email;
        }
        return { ...alias, email: newEmail };
      }
      return alias;
    }));
    toast.success('Alias regenerado correctamente');
  };

  const toggleAliasStatus = (aliasId: string) => {
    setAliases(prev => prev.map(alias => {
      if (alias.id === aliasId) {
        const newStatus = !alias.isActive;
        toast.success(`Alias ${newStatus ? 'activado' : 'desactivado'}`);
        return { ...alias, isActive: newStatus };
      }
      return alias;
    }));
  };

  // Issue 3: Mock email testing functionality
  const handleMockEmailTest = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.eml') && !file.name.endsWith('.zip')) {
      toast.error('Por favor selecciona un archivo .eml o .zip válido');
      return;
    }

    try {
      // Simulate email processing
      const result = await emailIngestService.processEmail({
        from: 'prueba@ejemplo.com',
        subject: `Test con ${file.name}`,
        alias: emailIngestService.generateGlobalAlias(),
        attachments: [file],
        headers: { 'test-header': 'test-value' }
      });

      // Add to email logs
      setEmailLogs(prev => [{ ...result, isMock: true }, ...prev]);

      // Issue 7: Show summary toast
      const { documentsCreated, documentsIgnored, documentsDuplicated } = result;
      toast.success(
        `📧 Email procesado: ${documentsCreated} creados, ${documentsIgnored} ignorados, ${documentsDuplicated} duplicados`,
        { duration: 5000 }
      );

    } catch (error) {
      console.error('Error processing mock email:', error);
      toast.error('Error procesando email de prueba');
    }

    // Reset file input
    event.target.value = '';
  };

  // Filter functions
  const filteredAliases = aliases.filter(alias => {
    const matchesSearch = alias.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alias.target?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alias.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredEmailLogs = emailLogs.filter(log => {
    const matchesSearch = log.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.alias.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PageLayout title="Email entrante" subtitle={subtitle}>
      <div className="space-y-8">
        {/* Issue 1: Email Aliases Section */}
        <div className="bg-white shadow-sm border border-neutral-200">
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-6 h-6 text-brand-navy" />
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Alias de correo</h2>
                  <p className="text-sm text-neutral-600">
                    Direcciones únicas para recibir documentos por email
                  </p>
                </div>
              </div>
              
              {/* Property alias generator */}
              {properties.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    className="border border-neutral-200 px-3 py-2 text-sm"
                    onChange={(e) => e.target.value && generatePropertyAlias(e.target.value)}
                    value=""
                  >
                    <option value="">Generar alias para inmueble...</option>
                    {properties.map(prop => (
                      <option key={prop.id} value={prop.id}>
                        {prop.alias}
                      </option>
                    ))}
                  </select>
                  <Plus className="w-4 h-4 text-neutral-400" />
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {filteredAliases.map((alias) => (
                <div key={alias.id} className="flex items-center justify-between p-4 border border-neutral-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 text-xs font-medium ${
                        alias.type === 'global' ? 'bg-primary-100 text-primary-800' :
                        alias.type === 'property' ? 'bg-success-100 text-success-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {alias.type === 'global' ? 'Global' : 
                         alias.type === 'property' ? 'Inmueble' : 'Personal'}
                      </div>
                      
                      {alias.isActive ? (
                        <CheckCircle className="w-4 h-4 text-success-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-error-500" />
                      )}
                    </div>
                    
                    <div className="mt-2">
                      <div className="font-mono text-sm text-neutral-700">{alias.email}</div>
                      {alias.target && (
                        <div className="text-xs text-neutral-500 mt-1">
                          Destino: {alias.target}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(alias.email)}
                      className="p-2 text-neutral-500 hover:text-brand-navy"
                      title="Copiar email"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => regenerateAlias(alias.id)}
                      className="p-2 text-neutral-500 hover:text-warning-600"
                      title="Regenerar alias"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => toggleAliasStatus(alias.id)}
                      className={`p-2 ${
                        alias.isActive 
                          ? 'text-success-600 hover:text-success-700' 
                          : 'text-error-500 hover:text-error-600'
                      }`}
                      title={alias.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {alias.isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Issue 2: Security & Whitelist Section */}
        <div className="bg-white shadow-sm border border-neutral-200">
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-brand-navy" />
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Seguridad</h2>
                <p className="text-sm text-neutral-600">
                  Lista blanca de remitentes y configuración de seguridad
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Whitelist toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-neutral-900">Lista blanca de remitentes</h3>
                <p className="text-sm text-neutral-600">
                  Solo aceptar emails de remitentes autorizados
                </p>
              </div>
              <button
                onClick={toggleWhitelist}
                className={`flex items-center gap-2 px-4 py-2 ${
                  whitelistEnabled 
                    ? 'bg-success-100 text-success-800'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {whitelistEnabled ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {whitelistEnabled ? 'Activada' : 'Desactivada'}
              </button>
            </div>

            {/* Add to whitelist */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="ejemplo@dominio.com"
                  value={newWhitelistEmail}
                  onChange={(e) => setNewWhitelistEmail(e.target.value)}
                  className="flex-1 border border-neutral-200 px-3 py-2 text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && addToWhitelist()}
                />
                <button
                  onClick={addToWhitelist}
                  className="px-4 py-2 bg-brand-navy"
                >
                  Añadir
                </button>
              </div>

              {/* Whitelist items */}
              {whitelist.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-neutral-700">Remitentes autorizados:</h4>
                  {whitelist.map((email, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50">
                      <span className="text-sm text-neutral-700">{email}</span>
                      <button
                        onClick={() => removeFromWhitelist(email)}
                        className="p-1 text-error-500 hover:text-error-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Security limits info */}
            <div className="btn-secondary-horizon atlas-atlas-atlas-atlas-atlas-btn-primary ">
              <h4 className="text-sm font-medium text-primary-900 mb-2">Límites de seguridad</h4>
              <ul className="text-xs text-primary-800 space-y-1">
                <li>• Máximo {EMAIL_LIMITS.MAX_ATTACHMENTS} adjuntos por email</li>
                <li>• Máximo {EMAIL_LIMITS.MAX_ATTACHMENT_SIZE / (1024*1024)}MB por adjunto</li>
                <li>• Validación SPF, DKIM y DMARC (registrada en logs)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Issue 7: Email Logs Section */}
        <div className="bg-white shadow-sm border border-neutral-200">
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-brand-navy" />
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Registro de emails</h2>
                  <p className="text-sm text-neutral-600">
                    Historial de emails recibidos y procesados
                  </p>
                </div>
              </div>

              {/* Issue 3: Mock email testing */}
              <div className="flex items-center gap-2">
                <label className="cursor-pointer px-4 py-2 bg-warning-100 text-orange-800">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Probar con .eml/.zip
                  <input
                    type="file"
                    accept=".eml,.zip"
                    onChange={handleMockEmailTest}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Search and filters */}
          <div className="p-4 border-b border-neutral-200 bg-neutral-50">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar por remitente, asunto o alias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 text-sm"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="all">Todos los estados</option>
                <option value="procesado">Procesado</option>
                <option value="sin-adjuntos">Sin adjuntos</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {filteredEmailLogs.map((log) => (
                <div key={log.id} className="border border-neutral-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`px-2 py-1 text-xs font-medium ${
                          log.status === 'procesado' ? 'bg-success-100 text-success-800' :
                          log.status === 'sin-adjuntos' ? 'bg-warning-100 text-yellow-800' :
                          'bg-error-100 text-error-800'
                        }`}>
                          {log.status === 'procesado' ? 'Procesado' :
                           log.status === 'sin-adjuntos' ? 'Sin adjuntos' : 'Rechazado'}
                        </div>
                        
                        {log.isMock && (
                          <div className="px-2 py-1 text-xs font-medium bg-warning-100 text-orange-800">
                            Test
                          </div>
                        )}

                        <span className="text-xs text-neutral-500">
                          {log.date.toLocaleString('es-ES')}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm font-medium text-neutral-900">
                          De: {log.from}
                        </div>
                        <div className="text-sm text-neutral-700">
                          Asunto: {log.subject}
                        </div>
                        <div className="text-xs text-neutral-500 font-mono">
                          Alias: {log.alias}
                        </div>
                        
                        {/* Issue 3: Document counters */}
                        <div className="text-xs text-neutral-600 mt-2">
                          📎 {log.attachmentCount} adjuntos • 
                          ✅ {log.documentsCreated || 0} creados • 
                          ❌ {log.documentsIgnored || 0} ignorados • 
                          🔄 {log.documentsDuplicated || 0} duplicados
                        </div>

                        {log.reason && (
                          <div className="text-xs text-error-600 mt-1">
                            Motivo: {log.reason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Issue 3: View in inbox link */}
                    {log.status === 'procesado' && (
                      <button
                        onClick={() => handleViewInInbox(log.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-brand-navy"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver en Inbox
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredEmailLogs.length === 0 && (
                <div className="text-center py-8 text-neutral-500">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No se encontraron registros de email</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions Section */}
        <div className="bg-white shadow-sm border border-neutral-200">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full p-6 text-left flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Info className="w-6 h-6 text-brand-navy" />
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">
                  Instrucciones de configuración
                </h2>
                <p className="text-sm text-neutral-600">
                  Cómo configurar el reenvío automático desde tu proveedor de email
                </p>
              </div>
            </div>
            <div className={`transform transition-transform ${showInstructions ? 'rotate-180' : ''}`}>
              ▼
            </div>
          </button>

          {showInstructions && (
            <div className="px-6 pb-6">
              <div className="border-t border-neutral-200 pt-6">
                <h3 className="font-semibold text-neutral-900 mb-4">
                  Configuración de reenvío automático
                </h3>
                
                <div className="space-y-6 text-sm text-neutral-700">
                  <div>
                    <h4 className="font-medium text-neutral-900 mb-2">Gmail</h4>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>Ve a Configuración → Filtros y direcciones bloqueadas</li>
                      <li>Haz clic en "Crear un filtro nuevo"</li>
                      <li>En "De", escribe la dirección del proveedor (ej: facturacion@iberdrola.es)</li>
                      <li>Haz clic en "Crear filtro"</li>
                      <li>Marca "Reenviar a" y selecciona tu alias de ATLAS</li>
                      <li>Haz clic en "Crear filtro"</li>
                    </ol>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-neutral-900 mb-2">Outlook</h4>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>Ve a Configuración → Correo → Reglas</li>
                      <li>Haz clic en "Agregar nueva regla"</li>
                      <li>Establece condición: "De" contiene el email del proveedor</li>
                      <li>Establece acción: "Reenviar a" tu alias de ATLAS</li>
                      <li>Guarda la regla</li>
                    </ol>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4">
                    <h4 className="font-medium text-amber-900 mb-2">⚠️ Importante</h4>
                    <ul className="text-amber-800 space-y-1">
                      <li>• Los alias incluyen un token único no adivinable por seguridad</li>
                      <li>• Solo se procesan adjuntos en formatos soportados (PDF, imágenes, CSV, XLS, ZIP, EML)</li>
                      <li>• Los documentos se clasifican automáticamente según el tipo de alias</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default EmailEntrante;