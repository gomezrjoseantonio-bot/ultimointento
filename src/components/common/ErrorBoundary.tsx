import React, { Component, ErrorInfo, ReactNode } from 'react';
import { XCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI or default error UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-lg w-full">
            <div className="flex items-center mb-4">
              <XCircle className="h-8 w-8 text-red-500 mr-3" />
              <h2 className="text-xl font-semibold text-red-900">
                Error inesperado
              </h2>
            </div>
            
            <p className="text-red-700 mb-6">
              Ha ocurrido un error inesperado. Esto puede deberse a un problema temporal.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <details className="mb-6">
                <summary className="text-sm text-red-600 cursor-pointer mb-2">
                  Detalles del error (desarrollo)
                </summary>
                <pre className="text-xs bg-red-100 p-3 rounded overflow-auto text-red-800">
                  {this.state.error?.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center px-4 py-2 bg-atlas-blue text-white rounded-md hover:bg-atlas-blue-dark transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recargar página
              </button>
              
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;