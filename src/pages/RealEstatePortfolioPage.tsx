import React, { useState, useEffect } from 'react';
import { initDB, Property } from '../services/db';
import PropertyForm from '../components/properties/PropertyForm';
import PropertyCard from '../components/properties/PropertyCard';
import PropertyDetails from '../components/properties/PropertyDetails';

const RealEstatePortfolioPage: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadProperties = async () => {
      setLoading(true);
      const db = await initDB();
      const properties = await db.getAll('properties');
      setProperties(properties);
      setLoading(false);
    };
    
    loadProperties();
  }, []);
  
  const handleAddProperty = async (property: Omit<Property, 'id'>) => {
    const db = await initDB();
    const id = await db.add('properties', property);
    const newProperty = { ...property, id };
    setProperties([...properties, newProperty]);
    setShowAddForm(false);
  };
  
  const handleUpdateProperty = async (updatedProperty: Property) => {
    const db = await initDB();
    await db.put('properties', updatedProperty);
    
    setProperties(properties.map(p => 
      p.id === updatedProperty.id ? updatedProperty : p
    ));
    
    setSelectedProperty(updatedProperty);
  };
  
  const handleDeleteProperty = async (id: number) => {
    const db = await initDB();
    await db.delete('properties', id);
    
    setProperties(properties.filter(p => p.id !== id));
    
    if (selectedProperty && selectedProperty.id === id) {
      setSelectedProperty(null);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Real Estate Portfolio</h1>
        
        <button
          className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-md"
          onClick={() => setShowAddForm(true)}
        >
          Add Property
        </button>
      </div>
      
      {showAddForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-medium text-gray-800">Add New Property</h2>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          </div>
          
          <PropertyForm onSubmit={handleAddProperty} />
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-navy-600"></div>
        </div>
      ) : properties.length === 0 && !showAddForm ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <h2 className="text-xl font-medium text-gray-800 mb-2">No Properties Yet</h2>
          <p className="text-gray-500 mb-4">Add your first property to get started tracking your real estate investments.</p>
          <button
            className="bg-navy-600 hover:bg-navy-700 text-white px-4 py-2 rounded-md"
            onClick={() => setShowAddForm(true)}
          >
            Add Your First Property
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              isSelected={selectedProperty?.id === property.id}
              onSelect={() => setSelectedProperty(property)}
            />
          ))}
        </div>
      )}
      
      {selectedProperty && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <PropertyDetails 
            property={selectedProperty}
            onUpdate={handleUpdateProperty}
            onDelete={handleDeleteProperty}
          />
        </div>
      )}
    </div>
  );
};

export default RealEstatePortfolioPage;