// H8: OCR Queue Status Component
import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { 
  QueueJob, 
  subscribeToOCRQueue, 
  retryOCRJob, 
  getOCRMetrics 
} from '../../services/ocrQueueService';

interface QueueStatusComponentProps {
  className?: string;
}

const QueueStatusComponent: React.FC<QueueStatusComponentProps> = ({ className = '' }) => {
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Subscribe to queue changes
    const unsubscribe = subscribeToOCRQueue((newJobs) => {
      setJobs(newJobs);
    });

    // Update metrics periodically
    const updateMetrics = () => {
      setMetrics(getOCRMetrics());
    };
    
    updateMetrics();
    const intervalId = setInterval(updateMetrics, 10000); // Every 10 seconds

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  const handleRetry = (jobId: string) => {
    if (retryOCRJob(jobId)) {
      console.info('OCR job retried:', jobId);
    }
  };

  const getStatusIcon = (status: QueueJob['status']) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'PROCESSING':
        return <RefreshCw className="w-4 h-4 text-primary-500 animate-spin" />;
      case 'OK':
        return <CheckCircle className="w-4 h-4 text-success-500" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-error-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: QueueJob['status']) => {
    const baseClasses = "inline-flex px-2 py-1 text-xs font-medium";
    
    switch (status) {
      case 'PENDING':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case 'PROCESSING':
        return `${baseClasses} bg-primary-100 text-primary-800`;
      case 'OK':
        return `${baseClasses} bg-success-100 text-success-800`;
      case 'ERROR':
        return `${baseClasses} bg-error-100 text-error-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-600`;
    }
  };

  const activeJobs = jobs.filter(job => ['PENDING', 'PROCESSING'].includes(job.status));
  const recentJobs = jobs.slice(-5); // Show last 5 jobs

  if (activeJobs.length === 0 && !isExpanded) {
    return null; // Hide when no active jobs
  }

  return (
    <div className={`bg-white border shadow-sm ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            {activeJobs.length > 0 && <RefreshCw className="w-4 h-4 text-primary-500 animate-spin" />}
            <span className="text-sm font-medium text-gray-900">
              Cola OCR
            </span>
          </div>
          
          {metrics && (
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>{metrics.pending} pendientes</span>
              <span>•</span>
              <span>{metrics.processing} procesando</span>
              {metrics.avgDurationMs > 0 && (
                <>
                  <span>•</span>
                  <span>~{Math.round(metrics.avgDurationMs / 1000)}s promedio</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {activeJobs.length > 0 && (
            <span className="btn-primary-horizon inline-flex px-2 py-1 text-xs font-medium text-primary-800">
              {activeJobs.length} activos
            </span>
          )}
          <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          {/* Recent jobs list */}
          {recentJobs.length > 0 && (
            <div className="p-3 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Trabajos recientes</h4>
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job.status)}
                    <span className="text-sm text-gray-900 truncate max-w-40">
                      {job.filename}
                    </span>
                    <span className={getStatusBadge(job.status)}>
                      {job.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {job.status === 'ERROR' && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="btn-danger text-xs px-2 py-1 bg-error-100 text-error-700 rounded hover:"
                      >
                        Reintentar
                      </button>
                    )}
                    
                    {job.status === 'OK' && job.result && (
                      <span className="text-xs text-gray-500">
                        {job.result.fields.length} campos
                      </span>
                    )}
                    
                    {job.attempt > 1 && (
                      <span className="text-xs text-warning-600">
                        Intento {job.attempt}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error details */}
          {metrics?.recentErrors && metrics.recentErrors.length > 0 && (
            <div className="p-3 border-t bg-error-50">
              <h4 className="text-sm font-medium text-error-700 mb-2">Errores recientes</h4>
              <div className="space-y-1">
                {metrics.recentErrors.slice(0, 3).map((error: any, index: number) => (
                  <div key={index} className="text-xs text-error-600">
                    <span className="font-medium">{error.filename}:</span> {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics summary */}
          {metrics && (
            <div className="p-3 border-t bg-gray-50">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Total:</span>
                  <span className="ml-1 font-medium">{metrics.total}</span>
                </div>
                <div>
                  <span className="text-gray-500">Completados:</span>
                  <span className="ml-1 font-medium text-success-600">{metrics.completed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Fallidos:</span>
                  <span className="ml-1 font-medium text-error-600">{metrics.failed}</span>
                </div>
                <div>
                  <span className="text-gray-500">Duración promedio:</span>
                  <span className="ml-1 font-medium">
                    {metrics.avgDurationMs > 0 ? `${Math.round(metrics.avgDurationMs / 1000)}s` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QueueStatusComponent;