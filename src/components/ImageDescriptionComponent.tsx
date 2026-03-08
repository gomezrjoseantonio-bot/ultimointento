import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Eye, Loader2, X, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  imageDescriptionService, 
  ImageDescriptionService,
  ImageDescriptionRequest, 
  ImageDescriptionResponse 
} from '../services/imageDescriptionService';

interface ImageDescriptionComponentProps {
  onDescriptionGenerated?: (description: string, metadata?: ImageDescriptionResponse['metadata']) => void;
  className?: string;
}

const ImageDescriptionComponent: React.FC<ImageDescriptionComponentProps> = ({
  onDescriptionGenerated,
  className = ''
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [metadata, setMetadata] = useState<ImageDescriptionResponse['metadata'] | null>(null);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<ImageDescriptionRequest['options']>({
    language: 'es',
    style: 'detailed',
    maxLength: 500
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ImageDescriptionService.isImageFile(file)) {
      toast.error('Por favor selecciona un archivo de imagen válido');
      return;
    }

    setSelectedImage(file);
    setDescription('');
    setMetadata(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDescribeImage = async () => {
    if (!selectedImage) {
      toast.error('Por favor selecciona una imagen primero');
      return;
    }

    setIsProcessing(true);
    
    try {
      const request: ImageDescriptionRequest = {
        file: selectedImage,
        options
      };

      const response = await imageDescriptionService.describeImage(request);

      if (response.success && response.description) {
        setDescription(response.description);
        setMetadata(response.metadata);
        
        if (onDescriptionGenerated) {
          onDescriptionGenerated(response.description, response.metadata);
        }
        
        toast.success('¡Descripción generada exitosamente!');
      } else {
        toast.error(response.error || 'Error generando descripción');
      }
    } catch (error) {
      toast.error('Error procesando la imagen');
      console.error('Image description error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setDescription('');
    setMetadata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyDescription = async () => {
    if (!description) return;
    
    try {
      await navigator.clipboard.writeText(description);
      setCopied(true);
      toast.success('Descripción copiada al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Error copiando al portapapeles');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="rounded-[var(--r-md)] bg-[var(--n-100)] p-3">
            <Eye className="h-6 w-6 text-[var(--blue)]" />
          </div>
        </div>
        <h2 className="mb-2 text-2xl font-semibold text-[var(--n-900)]">
          Describe esta imagen
        </h2>
        <p className="text-[var(--n-500)]">
          Sube una imagen y obtendrás una descripción detallada usando inteligencia artificial
        </p>
      </div>

      {/* File Upload Area */}
      {!selectedImage ? (
        <button
          type="button"
          className="w-full rounded-[var(--r-md)] border-2 border-dashed border-[var(--n-300)] p-8 text-center transition-all duration-150 ease-in-out hover:border-[var(--n-500)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-[var(--r-md)] bg-[var(--n-100)] p-4">
              <Upload className="h-8 w-8 text-[var(--n-500)]" />
            </div>
            <div>
              <p className="text-lg font-medium text-[var(--n-900)]">
                Selecciona una imagen
              </p>
              <p className="text-sm text-[var(--n-500)]">
                O arrastra y suelta aquí
              </p>
              <p className="mt-2 text-xs text-[var(--n-500)]">
                Formatos soportados: JPG, PNG, GIF, WebP, BMP (máx. 10MB)
              </p>
            </div>
          </div>
        </button>
      ) : (
        /* Image Preview */
        <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--n-200)]">
          <div className="flex items-center justify-between border-b border-[var(--n-200)] bg-[var(--n-50)] px-4 py-3">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5 text-[var(--n-500)]" />
              <span className="text-sm font-medium text-[var(--n-900)]">
                {selectedImage.name}
              </span>
              {metadata && (
                <span className="text-xs text-[var(--n-500)]">
                  ({formatFileSize(metadata.fileSize)})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearImage}
              aria-label="Eliminar imagen seleccionada"
              className="min-h-11 min-w-11 text-[var(--n-500)] transition-all duration-150 ease-in-out hover:text-[var(--n-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {imagePreview && (
            <div className="p-4">
              <img
                src={imagePreview}
                alt="Vista previa"
                className="max-w-full max-h-64 mx-auto shadow-sm"
                style={{ objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Options */}
      {selectedImage && (
        <div className="rounded-[var(--r-md)] bg-[var(--n-50)] p-4">
          <h3 className="mb-3 font-medium text-[var(--n-900)]">Opciones de descripción</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Language */}
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--n-700)]">
                Idioma
              </label>
              <select
                value={options?.language || 'es'}
                onChange={(e) => setOptions({...options, language: e.target.value as 'es' | 'en'})}
                className="w-full rounded-[var(--r-md)] border border-[var(--n-300)] px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline focus:outline-2 focus:outline-[var(--blue)] focus:outline-offset-2 focus:shadow-[0_0_0_4px_var(--focus-ring)]"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Style */}
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--n-700)]">
                Estilo
              </label>
              <select
                value={options?.style || 'detailed'}
                onChange={(e) => setOptions({...options, style: e.target.value as 'detailed' | 'brief' | 'technical'})}
                className="w-full rounded-[var(--r-md)] border border-[var(--n-300)] px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline focus:outline-2 focus:outline-[var(--blue)] focus:outline-offset-2 focus:shadow-[0_0_0_4px_var(--focus-ring)]"
              >
                <option value="detailed">Detallado</option>
                <option value="brief">Breve</option>
                <option value="technical">Técnico</option>
              </select>
            </div>

            {/* Max Length */}
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--n-700)]">
                Longitud máx.
              </label>
              <select
                value={options?.maxLength || 500}
                onChange={(e) => setOptions({...options, maxLength: parseInt(e.target.value)})}
                className="w-full rounded-[var(--r-md)] border border-[var(--n-300)] px-3 py-2 text-sm focus:border-[var(--blue)] focus:outline focus:outline-2 focus:outline-[var(--blue)] focus:outline-offset-2 focus:shadow-[0_0_0_4px_var(--focus-ring)]"
              >
                <option value={200}>200 caracteres</option>
                <option value={500}>500 caracteres</option>
                <option value={1000}>1000 caracteres</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      {selectedImage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleDescribeImage}
            disabled={isProcessing}
            className="flex items-center space-x-2 rounded-[var(--r-md)] bg-[var(--blue)] px-6 py-2 font-medium text-[var(--white)] transition-all duration-150 ease-in-out hover:bg-[var(--blue-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Eye className="h-5 w-5" />
                <span>Describir imagen</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Description Result */}
      {description && (
        <div className="rounded-[var(--r-md)] border border-[var(--n-200)] bg-[var(--white)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--n-900)]">Descripción generada</h3>
            <div className="flex items-center space-x-2">
              {metadata?.processingTime && (
                <span className="text-xs text-[var(--n-500)]">
                  {metadata.processingTime}ms
                </span>
              )}
              <button
                type="button"
                onClick={handleCopyDescription}
                aria-label="Copiar descripción generada"
                className="min-h-11 min-w-11 text-[var(--n-500)] transition-all duration-150 ease-in-out hover:text-[var(--n-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2"
                title="Copiar descripción"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-success-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          
          <div className="rounded-[var(--r-md)] bg-[var(--n-50)] p-4">
            <p className="whitespace-pre-wrap leading-relaxed text-[var(--n-800)]">
              {description}
            </p>
          </div>

          {metadata && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-[var(--n-500)] md:grid-cols-4">
              <div>
                <span className="font-medium">Tamaño:</span> {formatFileSize(metadata.fileSize)}
              </div>
              <div>
                <span className="font-medium">Tipo:</span> {metadata.mimeType}
              </div>
              {metadata.dimensions && (
                <div>
                  <span className="font-medium">Dimensiones:</span> {metadata.dimensions.width}×{metadata.dimensions.height}
                </div>
              )}
              {metadata.processingTime && (
                <div>
                  <span className="font-medium">Tiempo:</span> {metadata.processingTime}ms
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageDescriptionComponent;
