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
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Upload,
  Info,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EmailAlias {
  id: string;
  email: string;
  type: 'global' | 'property' | 'room';
  target?: string; // property ID or room ID
  isActive: boolean;
  lastUsed?: Date;
  created: Date;
}

interface EmailLog {
  id: string;
  date: Date;
  from: string;
  subject: string;
  alias: string;
  attachmentCount: number;
  status: 'procesado' | 'sin-adjuntos' | 'rechazado';
  reason?: string;
  isMock?: boolean;
}

const EmailEntrante: React.FC = () => {
  const { currentModule } = useTheme();
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInstructions, setShowInstructions] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const subtitle = currentModule === 'horizon' 
    ? 'Gestión de correo entrante para recepción automática de facturas en Horizon.'
    : 'Gestión de correo entrante para recepción automática de documentos en Pulse.';

  // Initialize with sample data
  useEffect(() => {
    const sampleAliases: EmailAlias[] = [
      {
        id: 'global-1',
        email: 'facturas-atlas-5f8k2d@inbound.atlas.app',
        type: 'global',
        isActive: true,
        created: new Date(Date.now() - 86400000), // 1 day ago
        lastUsed: new Date(Date.now() - 3600000) // 1 hour ago
      },
      {
        id: 'prop-1',
        email: 'inmueble-madrid-a7x9m3@inbound.atlas.app',
        type: 'property',
        target: 'Piso Madrid Centro',
        isActive: true,
        created: new Date(Date.now() - 172800000), // 2 days ago
      },
      {
        id: 'room-1',
        email: 'habitacion-bcn-k2n8w5@inbound.atlas.app',
        type: 'room',
        target: 'Habitación A - Barcelona',
        isActive: false,
        created: new Date(Date.now() - 259200000), // 3 days ago
      }
    ];

    const sampleLogs: EmailLog[] = [
      {
        id: 'log-1',
        date: new Date(Date.now() - 3600000),
        from: 'facturacion@iberdrola.es',
        subject: 'Factura electricidad - Marzo 2024',
        alias: 'facturas-atlas-5f8k2d@inbound.atlas.app',
        attachmentCount: 1,
        status: 'procesado'
      },
      {
        id: 'log-2',
        date: new Date(Date.now() - 7200000),
        from: 'noreply@gasnatural.com',
        subject: 'Recordatorio de pago',
        alias: 'inmueble-madrid-a7x9m3@inbound.atlas.app',
        attachmentCount: 0,
        status: 'sin-adjuntos'
      },
      {
        id: 'log-3',
        date: new Date(Date.now() - 10800000),
        from: 'administracion@comunidad-barcelona.es',
        subject: 'Liquidación gastos comunidad',
        alias: 'habitacion-bcn-k2n8w5@inbound.atlas.app',
        attachmentCount: 2,
        status: 'rechazado',
        reason: 'alias inactivo'
      }
    ];

    setAliases(sampleAliases);
    setEmailLogs(sampleLogs);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Email copiado al portapapeles');
  };

  const regenerateAlias = (aliasId: string) => {
    setAliases(prev => prev.map(alias => {
      if (alias.id === aliasId) {
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const newEmail = alias.email.replace(/@.*/, `@inbound.atlas.app`).replace(/-[a-z0-9]+@/, `-${randomSuffix}@`);
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

  const handleMockEmailTest = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.eml') && !file.name.endsWith('.zip')) {
      toast.error('Por favor selecciona un archivo .eml o .zip válido');
      return;
    }

    // Simulate processing
    const mockLog: EmailLog = {
      id: `mock-${Date.now()}`,
      date: new Date(),
      from: 'prueba@ejemplo.com',
      subject: `Test con archivo ${file.name}`,
      alias: aliases[0]?.email || 'test@inbound.atlas.app',
      attachmentCount: file.name.endsWith('.zip') ? 3 : 1,
      status: 'procesado',
      isMock: true
    };

    setEmailLogs(prev => [mockLog, ...prev]);
    toast.success('Email de prueba procesado correctamente');
    
    // Reset file input
    event.target.value = '';
  };

  const filteredLogs = emailLogs.filter(log => {
    const matchesSearch = log.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'procesado':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'sin-adjuntos':
        return <Info className="w-4 h-4 text-yellow-600" />;
      case 'rechazado':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'procesado': return 'Procesado';
      case 'sin-adjuntos': return 'Sin adjuntos';
      case 'rechazado': return 'Rechazado';
      default: return status;
    }
  };

  const emailTemplate = `Estimado proveedor,

Le escribo para solicitar que incluya la siguiente dirección de correo en copia (CC) para el envío de facturas:

facturas-atlas-5f8k2d@inbound.atlas.app

Esta dirección está configurada únicamente para el procesamiento de documentos adjuntos. Por favor, mantenga mi dirección personal como contacto principal para cualquier otra comunicación.

Muchas gracias por su colaboración.

Saludos cordiales,
[Su nombre]`;

  return (
    <PageLayout title="Email entrante" subtitle={subtitle}>
      <div className="space-y-8">
        
        {/* How to Connect Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Cómo conectar tus facturas</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recommended Method */}
            <div className="border border-green-200 rounded-lg p-5 bg-green-50">
              <div className="flex items-start gap-3 mb-4">
                <Mail className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">Recomendado — Reenvío desde tu correo</h3>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    <CheckCircle className="w-3 h-3" />
                    Método preferido
                  </div>
                </div>
              </div>
              <p className="text-sm text-green-800 mb-4">
                Crea una regla en tu correo (Gmail/Outlook) que reenvíe automáticamente las facturas de cada 
                proveedor a tu alias de ATLAS. Así no pierdes nada y las facturas entran solas en la Bandeja de Documentos.
              </p>
              <button
                onClick={() => setShowInstructions(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Ver instrucciones
              </button>
            </div>

            {/* Alternative Method */}
            <div className="border border-blue-200 rounded-lg p-5 bg-blue-50">
              <div className="flex items-start gap-3 mb-4">
                <Copy className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Alternativa — Proveedor en copia (CC)</h3>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    <Info className="w-3 h-3" />
                    Opción B
                  </div>
                </div>
              </div>
              <p className="text-sm text-blue-800 mb-4">
                Pide a tu proveedor que añada tu alias de ATLAS en copia para el envío de facturas. 
                No sustituyas tu email personal, ya que esta dirección solo procesa adjuntos.
              </p>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Plantilla de email
              </button>
            </div>
          </div>
        </div>

        {/* Email Aliases Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Tus direcciones de envío (aliases)</h2>
          
          <div className="space-y-4">
            {aliases.map((alias) => (
              <div key={alias.id} className="border border-neutral-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${alias.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-medium text-neutral-900">
                          {alias.type === 'global' && 'Alias Global'}
                          {alias.type === 'property' && `Inmueble: ${alias.target}`}
                          {alias.type === 'room' && `Habitación: ${alias.target}`}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        alias.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {alias.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-neutral-600 font-mono break-all mb-2">
                      {alias.email}
                    </p>
                    
                    <div className="text-xs text-neutral-500">
                      Creado: {alias.created.toLocaleDateString()}
                      {alias.lastUsed && (
                        <span className="ml-4">
                          Último uso: {alias.lastUsed.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    
                    {alias.type !== 'global' && !alias.isActive && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        Esta dirección procesa solo adjuntos. Mantén tu email personal en tu proveedor para otras comunicaciones.
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(alias.email)}
                      className="p-2 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => regenerateAlias(alias.id)}
                      className="p-2 text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="Regenerar"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleAliasStatus(alias.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        alias.isActive
                          ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                          : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                      }`}
                      title={alias.isActive ? 'Desactivar' : 'Activar'}
                    >
                      {alias.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mock Testing Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Prueba sin proveedores (mock)</h2>
          <p className="text-neutral-600 mb-4">
            Sube un archivo .eml o .zip de ejemplo para simular la llegada de un correo y crear documentos 
            en la Bandeja de Documentos como si fuera un correo real.
          </p>
          
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".eml,.zip"
              onChange={handleMockEmailTest}
              className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
            />
            <Upload className="w-5 h-5 text-neutral-400" />
          </div>
        </div>

        {/* Email Log Section */}
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-6">Registro de correos recibidos</h2>
          
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Buscar por remitente o asunto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="sm:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="procesado">Procesado</option>
                  <option value="sin-adjuntos">Sin adjuntos</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Log Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 font-medium text-neutral-700">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700">De</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700">Asunto</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700">Alias</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700">Adjuntos</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      <div>
                        {log.date.toLocaleDateString()}
                        <div className="text-xs text-neutral-500">
                          {log.date.toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-900">
                      {log.from}
                      {log.isMock && (
                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          MOCK
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-900 max-w-xs truncate">
                      {log.subject}
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600 font-mono text-xs">
                      {log.alias.split('@')[0]}@...
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-600">
                      {log.attachmentCount}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className={`${
                          log.status === 'procesado' ? 'text-green-700' :
                          log.status === 'sin-adjuntos' ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {getStatusText(log.status)}
                        </span>
                        {log.reason && (
                          <span className="text-xs text-neutral-500">
                            ({log.reason})
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-8 text-neutral-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'No se encontraron registros con los filtros aplicados'
                : 'No hay registros de correos recibidos'
              }
            </div>
          )}

          <div className="mt-4 text-xs text-neutral-500">
            Conservamos este registro 90 días.
          </div>
        </div>

        {/* Instructions Modal */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Configurar reenvío automático de correos
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
                      <li>Añade condición "El remitente es" con la dirección del proveedor</li>
                      <li>Añade acción "Reenviar a" con tu alias de ATLAS</li>
                      <li>Guarda la regla</li>
                    </ol>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Plantilla para solicitar copia de facturas
                </h3>
                
                <textarea
                  value={emailTemplate}
                  readOnly
                  className="w-full h-64 p-3 border border-neutral-200 rounded-lg text-sm resize-none bg-neutral-50"
                />
                
                <div className="mt-4 flex gap-2 justify-end">
                  <button
                    onClick={() => setShowTemplateModal(false)}
                    className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(emailTemplate);
                      toast.success('Plantilla copiada al portapapeles');
                      setShowTemplateModal(false);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Copiar plantilla
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default EmailEntrante;