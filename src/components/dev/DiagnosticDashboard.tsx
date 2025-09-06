import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { telemetry } from '../../services/telemetryService';
import { isQADashboardEnabled, isTelemetryEnabled } from '../../config/envFlags';

interface DiagnosticEvent {
  documentId: string;
  documentType: string;
  fileName: string;
  event: 'PARSED' | 'ROUTED' | 'OCR_DONE' | 'MOVEMENT_CREATED' | 'ERROR';
  destination?: string;
  metadata?: Record<string, any>;
}

export default function DiagnosticDashboard() {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if QA dashboard is enabled
    if (!isQADashboardEnabled() || !isTelemetryEnabled()) {
      return;
    }

    const loadEvents = () => {
      const diagnosticEvents = telemetry.getDiagnosticEvents(20);
      setEvents(diagnosticEvents);
    };

    // Load initial events
    loadEvents();

    // Refresh every 5 seconds
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  // Don't render if not enabled
  if (!isQADashboardEnabled() || !isTelemetryEnabled()) {
    return null;
  }

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'PARSED': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'ROUTED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'OCR_DONE': return <CheckCircle className="w-4 h-4 text-purple-500" />;
      case 'MOVEMENT_CREATED': return <CheckCircle className="w-4 h-4 text-indigo-500" />;
      case 'ERROR': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getEventColor = (event: string) => {
    switch (event) {
      case 'PARSED': return 'bg-blue-50 border-blue-200';
      case 'ROUTED': return 'bg-green-50 border-green-200';
      case 'OCR_DONE': return 'bg-purple-50 border-purple-200';
      case 'MOVEMENT_CREATED': return 'bg-indigo-50 border-indigo-200';
      case 'ERROR': return 'bg-red-50 border-red-200';
      default: return 'bg-neutral-50 border-neutral-200';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2 px-3 py-2 bg-neutral-800 text-white rounded-lg shadow-lg hover:bg-neutral-700 transition-colors flex items-center gap-2"
      >
        <Activity className="w-4 h-4" />
        <span className="text-xs font-medium">Diagnóstico</span>
        {events.length > 0 && (
          <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            {events.length}
          </span>
        )}
      </button>

      {/* Events Panel */}
      {isVisible && (
        <div className="w-96 max-h-96 bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Eventos de Diagnóstico (5 min)
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Últimos {events.length} eventos del sistema
            </p>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-4 text-center text-neutral-500 text-sm">
                No hay eventos recientes
              </div>
            ) : (
              <div className="space-y-0">
                {events.map((event, index) => (
                  <div
                    key={index}
                    className={`p-3 border-b border-neutral-100 last:border-b-0 ${getEventColor(event.event)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getEventIcon(event.event)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-neutral-900">
                            EVENT:{event.event}
                          </span>
                          <span className="text-neutral-500">
                            {event.documentType}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-700 mt-1 truncate">
                          {event.fileName}
                        </div>
                        {event.destination && (
                          <div className="text-xs text-neutral-600 mt-1">
                            → {event.destination}
                          </div>
                        )}
                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="text-xs text-neutral-500 mt-1">
                            {Object.entries(event.metadata)
                              .slice(0, 2)
                              .map(([key, value]) => (
                                <span key={key} className="mr-2">
                                  {key}: {String(value)}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500">
            Flags: AUTO_ROUTE ✅ | AUTO_OCR ✅ | BANK_IMPORT ✅
          </div>
        </div>
      )}
    </div>
  );
}