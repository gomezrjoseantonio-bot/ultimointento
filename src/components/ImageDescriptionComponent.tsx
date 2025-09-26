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
          <div className="btn-primary-horizon p-3">
            <Eye className="h-6 w-6 text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Describe esta imagen
        </h2>
        <p className="text-gray-600">
          Sube una imagen y obtendrás una descripción detallada usando inteligencia artificial
        </p>
      </div>

      {/* File Upload Area */}
      {!selectedImage ? (
        <div 
          className="border-2 border-dashed border-gray-300 p-8 text-center hover:border-gray-400 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-gray-100 p-4">
              <Upload className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Selecciona una imagen
              </p>
              <p className="text-sm text-gray-500">
                O arrastra y suelta aquí
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Formatos soportados: JPG, PNG, GIF, WebP, BMP (máx. 10MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Image Preview */
        <div className="border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ImageIcon className="h-5 w-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">
                {selectedImage.name}
              </span>
              {metadata && (
                <span className="text-xs text-gray-500">
                  ({formatFileSize(metadata.fileSize)})
                </span>
              )}
            </div>
            <button
              onClick={handleClearImage}
              className="text-gray-400 hover:text-gray-600"
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
        <div className="bg-gray-50 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Opciones de descripción</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Idioma
              </label>
              <select
                value={options?.language || 'es'}
                onChange={(e) => setOptions({...options, language: e.target.value as 'es' | 'en'})}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estilo
              </label>
              <select
                value={options?.style || 'detailed'}
                onChange={(e) => setOptions({...options, style: e.target.value as 'detailed' | 'brief' | 'technical'})}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="detailed">Detallado</option>
                <option value="brief">Breve</option>
                <option value="technical">Técnico</option>
              </select>
            </div>

            {/* Max Length */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitud máx.
              </label>
              <select
                value={options?.maxLength || 500}
                onChange={(e) => setOptions({...options, maxLength: parseInt(e.target.value)})}
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            onClick={handleDescribeImage}
            disabled={isProcessing}
            className="btn-primary-horizon btn-primary-horizon disabled: px-6 py-2 font-medium flex items-center space-x-2"
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
        <div className="bg-white border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Descripción generada</h3>
            <div className="flex items-center space-x-2">
              {metadata?.processingTime && (
                <span className="text-xs text-gray-500">
                  {metadata.processingTime} ms
                </span>
              )}
              <button
                onClick={handleCopyDescription}
                className="text-gray-400 hover:text-gray-600"
                title="Copiar descripción"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4">
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          </div>

          {metadata && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
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