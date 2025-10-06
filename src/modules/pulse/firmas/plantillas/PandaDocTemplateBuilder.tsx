import React, { useMemo, useState } from 'react';
import PageLayout from '../../../../components/common/PageLayout';
import { PandaDocConnectionResponse, testPandaDocConnection } from '../../../../services/pandadocService';

interface FieldConfig {
  label: string;
  type: 'text' | 'date' | 'number' | 'signature';
  required: boolean;
  role: string;
  helperText?: string;
}

const defaultContractText = `CONTRATO DE ARRENDAMIENTO\n\nEntre {{propietario_nombre}} con DNI {{propietario_dni}} y {{inquilino_nombre}} con DNI {{inquilino_dni}} se acuerda el arrendamiento de la vivienda situada en {{direccion_vivienda}}.\n\nLa duración del contrato será de {{duracion_meses}} meses con fecha de inicio {{fecha_inicio}} y renta mensual de {{renta_mensual}} euros.\n\nEl pago se realizará mediante domiciliación en la cuenta {{iban_inquilino}}.\n\nFirmado en {{ciudad_firma}} a {{fecha_firma}}.`;

const fieldTypeOptions: Array<{ value: FieldConfig['type']; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'date', label: 'Fecha' },
  { value: 'number', label: 'Numérico' },
  { value: 'signature', label: 'Firma' }
];

const prettifyFieldName = (token: string) =>
  token
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(\w)/g, (match) => match.toUpperCase());

const getDefaultFieldConfig = (token: string): FieldConfig => ({
  label: prettifyFieldName(token),
  type: token.includes('fecha') ? 'date' : token.includes('firma') ? 'signature' : token.includes('renta') || token.includes('importe') ? 'number' : 'text',
  required: true,
  role: token.includes('propietario') ? 'propietario' : 'inquilino',
  helperText: undefined
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const PandaDocTemplateBuilder: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [connectionResult, setConnectionResult] = useState<PandaDocConnectionResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState('Contrato de Alquiler Residencial');
  const [contractText, setContractText] = useState(defaultContractText);
  const [fieldConfigs, setFieldConfigs] = useState<Record<string, FieldConfig>>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [copyError, setCopyError] = useState<string | null>(null);

  const tokens = useMemo(() => {
    const regex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(contractText))) {
      found.add(match[1]);
    }
    return Array.from(found);
  }, [contractText]);

  const highlightedContractHtml = useMemo(() => {
    const safeText = escapeHtml(contractText).replace(/\n/g, '<br />');
    return safeText.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, token) => {
      return `<span class="bg-teal-50 text-brand-teal font-semibold px-1 rounded">{{${token}}}</span>`;
    });
  }, [contractText]);

  const resolvedFieldConfigs = useMemo(() => {
    return tokens.map((token) => {
      const existing = fieldConfigs[token];
      return {
        token,
        config: existing ? { ...getDefaultFieldConfig(token), ...existing } : getDefaultFieldConfig(token)
      };
    });
  }, [tokens, fieldConfigs]);

  const templateDefinition = useMemo(() => {
    const fields = resolvedFieldConfigs.map(({ token, config }) => ({
      name: token,
      label: config.label,
      type: config.type,
      required: config.required,
      role: config.role,
      helperText: config.helperText
    }));

    const sampleData = resolvedFieldConfigs.reduce<Record<string, string>>((acc, { token, config }) => {
      switch (config.type) {
        case 'date':
          acc[token] = '2024-01-01';
          break;
        case 'number':
          acc[token] = '1000';
          break;
        case 'signature':
          acc[token] = '{{Firma}}';
          break;
        default:
          acc[token] = config.label;
      }
      return acc;
    }, {});

    return {
      name: templateName,
      body: contractText,
      fields,
      sampleData
    };
  }, [templateName, contractText, resolvedFieldConfigs]);

  const handleUpdateField = (token: string, partial: Partial<FieldConfig>) => {
    setFieldConfigs((prev) => ({
      ...prev,
      [token]: {
        ...getDefaultFieldConfig(token),
        ...prev[token],
        ...partial
      }
    }));
  };

  const handleTestConnection = async () => {
    setIsTestingApi(true);
    setTestError(null);
    setConnectionResult(null);

    try {
      const result = await testPandaDocConnection(apiKey);
      if (!result.ok) {
        setTestError(result.message || 'No se pudo validar la conexión con PandaDoc');
      }
      setConnectionResult(result);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Error desconocido al probar la API');
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleCopyTemplate = async () => {
    setCopyError(null);

    try {
      await navigator.clipboard.writeText(JSON.stringify(templateDefinition, null, 2));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      setCopyStatus('idle');
      setCopyError('No se pudo copiar el JSON al portapapeles');
    }
  };

  return (
    <PageLayout
      title="Plantillas PandaDoc"
      subtitle="Configura la conexión y construye plantillas con campos dinámicos para contratos de alquiler"
    >
      <div className="space-y-8">
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900">1. Probar conexión con PandaDoc</h2>
          <p className="mt-2 text-sm text-gray-500">
            Utiliza una API Key del entorno gratuito de PandaDoc para validar que la comunicación funciona antes de generar contratos.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="pandadoc-api-key">
                API Key de PandaDoc
              </label>
              <input
                id="pandadoc-api-key"
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-teal focus:ring-brand-teal"
                placeholder="api_key_..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                La API Key se utiliza únicamente para esta prueba y no se almacena.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={!apiKey || isTestingApi}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-teal px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isTestingApi ? 'Comprobando...' : 'Probar conexión'}
            </button>
          </div>

          {connectionResult && (
            <div className={`mt-6 rounded-lg border p-4 ${connectionResult.ok ? 'border-teal-200 bg-teal-50 text-teal-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
              {connectionResult.ok ? (
                <div>
                  <p className="font-semibold">Conexión verificada correctamente.</p>
                  <p className="mt-1 text-sm">
                    Se pudo acceder a la cuenta {connectionResult.accountName ? <span className="font-medium">{connectionResult.accountName}</span> : 'de PandaDoc'}.
                  </p>
                  {connectionResult.rateLimited && (
                    <p className="mt-2 text-xs text-yellow-800">
                      Advertencia: la API devolvió un estado de limitación de peticiones. Intenta espaciar las pruebas si sucede frecuentemente.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-semibold">No se pudo validar la API Key.</p>
                  <p className="mt-1 text-sm">{connectionResult.message || 'Revisa la clave proporcionada e inténtalo nuevamente.'}</p>
                  {connectionResult.status && (
                    <p className="mt-1 text-xs text-red-700">Código HTTP: {connectionResult.status}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {testError && !connectionResult?.ok && (
            <p className="mt-4 text-sm text-red-600">{testError}</p>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900">2. Define el texto base del contrato</h2>
          <p className="mt-2 text-sm text-gray-500">
            Copia el contenido del contrato y utiliza llaves dobles{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">{'{{'}campo{'}}'}</code> para marcar los campos dinámicos.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="template-name">
                Nombre de la plantilla
              </label>
              <input
                id="template-name"
                type="text"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-teal focus:ring-brand-teal"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="contract-body">
                Texto del contrato
              </label>
              <textarea
                id="contract-body"
                className="mt-1 w-full min-h-[220px] rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-brand-teal focus:ring-brand-teal"
                value={contractText}
                onChange={(event) => setContractText(event.target.value)}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700">Vista previa con campos resaltados</p>
              <div className="mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: highlightedContractHtml }} />
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900">3. Configura los campos detectados</h2>
          {tokens.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              Añade campos con el formato {'{{'}campo{'}}'} dentro del texto para configurarlos aquí.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {resolvedFieldConfigs.map(({ token, config }) => (
                <div key={token} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {'{{'}{token}{'}}'}
                      </p>
                      <p className="text-xs text-gray-500">Rol sugerido: {config.role}</p>
                    </div>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-brand-teal">Campo detectado</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600">Etiqueta visible</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-teal focus:ring-brand-teal"
                        value={config.label}
                        onChange={(event) => handleUpdateField(token, { label: event.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600">Tipo de campo</label>
                      <select
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-teal focus:ring-brand-teal"
                        value={config.type}
                        onChange={(event) => handleUpdateField(token, { type: event.target.value as FieldConfig['type'] })}
                      >
                        {fieldTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">Rol</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-teal focus:ring-brand-teal"
                          value={config.role}
                          onChange={(event) => handleUpdateField(token, { role: event.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <input
                          id={`required-${token}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
                          checked={config.required}
                          onChange={(event) => handleUpdateField(token, { required: event.target.checked })}
                        />
                        <label htmlFor={`required-${token}`} className="text-xs text-gray-600">
                          Requerido
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600">Ayuda contextual (opcional)</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-teal focus:ring-brand-teal"
                        value={config.helperText || ''}
                        onChange={(event) => handleUpdateField(token, { helperText: event.target.value || undefined })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900">4. Exporta la configuración</h2>
          <p className="mt-2 text-sm text-gray-500">
            Copia la configuración generada y utilízala para crear la plantilla en PandaDoc mediante su API o interfaz.
          </p>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Resumen</p>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li><span className="font-semibold text-gray-700">Plantilla:</span> {templateDefinition.name}</li>
                <li><span className="font-semibold text-gray-700">Campos detectados:</span> {tokens.length}</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={handleCopyTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-teal px-4 py-2 text-sm font-semibold text-brand-teal transition-colors hover:bg-teal-50"
            >
              {copyStatus === 'copied' ? '¡Copiado!' : 'Copiar JSON de la plantilla'}
            </button>
          </div>

          {copyError && <p className="mt-2 text-sm text-red-600">{copyError}</p>}

          <pre className="mt-4 max-h-80 overflow-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-xs text-teal-100">
            {JSON.stringify(templateDefinition, null, 2)}
          </pre>
        </section>
      </div>
    </PageLayout>
  );
};

export default PandaDocTemplateBuilder;
