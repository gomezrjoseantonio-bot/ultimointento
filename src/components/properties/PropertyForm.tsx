import React, { useState } from 'react';
import { Property } from '../../services/db';

interface PropertyFormProps {
  onSubmit: (property: Omit<Property, 'id'>) => void;
  onCancel: () => void;
}

const PropertyForm: React.FC<PropertyFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Omit<Property, 'id'>>({
    address: '',
    alias: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '',
    squareMeters: 0,
    bedrooms: 0,
    bathrooms: 0,
    cadastralReference: '',
    transmissionRegime: 'usada',
    state: 'activo',
    acquisitionCosts: {
      price: 0,
      itp: 0,
      notary: 0,
      registry: 0,
      management: 0,
      psi: 0,
      realEstate: 0,
      other: [],
    },
    documents: []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">Alias</label>
        <input
          type="text"
          value={formData.alias}
          onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
          required
        />
      </div>

      <div className="flex space-x-4">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save Property
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default PropertyForm;