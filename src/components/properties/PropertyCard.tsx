import React from 'react';
import { Property } from '../../services/db';

interface PropertyCardProps {
  property: Property;
  isSelected?: boolean;
  onSelect: () => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, isSelected, onSelect }) => {
  return (
    <div 
      className={`bg-white p-4 rounded-lg shadow border hover:shadow-md cursor-pointer transition-shadow ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      <h3 className="text-lg font-semibold text-gray-900">{property.alias}</h3>
      <p className="text-sm text-gray-600 mb-2">{property.address}</p>
      <div className="grid grid-cols-2 gap-2 text-sm text-gray-500">
        <span>{property.squareMeters} m²</span>
        <span>{property.bedrooms} bed, {property.bathrooms} bath</span>
      </div>
    </div>
  );
};

export default PropertyCard;