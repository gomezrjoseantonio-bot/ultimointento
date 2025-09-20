import React, { useState } from 'react';
import { Property } from '../../services/db';

interface PropertyFormProps {
  onSubmit: (property: Omit<Property, 'id'>) => Promise<void>;
  onCancel: () => void;
}

const PropertyForm: React.FC<PropertyFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    alias: '',
    address: '',
    postalCode: '',
    province: '',
    municipality: '',
    ccaa: '',
    purchaseDate: '',
    cadastralReference: '',
    squareMeters: 0,
    bedrooms: 1,
    bathrooms: 1,
    transmissionRegime: 'usada' as const,
    state: 'activo' as const,
    notes: '',
    acquisitionCosts: {
      price: 0,
      notary: 0,
      registry: 0,
      management: 0,
      other: []
    },
    documents: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting property:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Property Alias
        </label>
        <input
          type="text"
          value={formData.alias}
          onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))}
          className="btn-secondary-horizon w-full "
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          className="btn-secondary-horizon w-full "
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Square Meters
          </label>
          <input
            type="number"
            value={formData.squareMeters}
            onChange={(e) => setFormData(prev => ({ ...prev, squareMeters: parseInt(e.target.value) || 0 }))}
            className="btn-secondary-horizon w-full "
            min="1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purchase Price (€)
          </label>
          <input
            type="number"
            value={formData.acquisitionCosts.price}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              acquisitionCosts: { 
                ...prev.acquisitionCosts, 
                price: parseFloat(e.target.value) || 0 
              }
            }))}
            className="btn-secondary-horizon w-full "
            min="0"
            step="0.01"
            required
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 border border-neutral-300 disabled={isSubmitting}"
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary-horizon px-4 py-2 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding...' : 'Add Property'}
        </button>
      </div>
    </form>
  );
};

export default PropertyForm;