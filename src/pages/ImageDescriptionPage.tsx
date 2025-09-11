import React from 'react';
import ImageDescriptionComponent from '../components/ImageDescriptionComponent';

const ImageDescriptionPage: React.FC = () => {
  const handleDescriptionGenerated = (description: string, metadata?: any) => {
    console.log('Description generated:', description);
    console.log('Metadata:', metadata);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <ImageDescriptionComponent 
          onDescriptionGenerated={handleDescriptionGenerated}
        />
      </div>
    </div>
  );
};

export default ImageDescriptionPage;