import React from 'react';
import { Property } from '../../services/db';

interface PropertyDetailsProps {
  property: Property;
  onUpdate?: (updatedProperty: Property) => void;
  onDelete?: (id: number) => void;
}

const PropertyDetails: React.FC<PropertyDetailsProps> = ({ property, onUpdate, onDelete }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{property.alias}</h2>
        <p className="text-gray-600">{property.address}</p>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Square Meters</label>
          <p className="mt-1 text-lg">{property.squareMeters} m²</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Bedrooms</label>
          <p className="mt-1 text-lg">{property.bedrooms}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Bathrooms</label>
          <p className="mt-1 text-lg">{property.bathrooms}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Purchase Date</label>
          <p className="mt-1 text-lg">{property.purchaseDate}</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Acquisition Costs</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-gray-500">Acquisition costs details - coming soon</p>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetails;