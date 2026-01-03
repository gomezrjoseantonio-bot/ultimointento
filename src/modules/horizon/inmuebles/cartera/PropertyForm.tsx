import React from 'react';
import InmuebleFormCompact from '../../../../components/inmuebles/InmuebleFormCompact';

interface PropertyFormProps {
  mode: 'create' | 'edit';
}

const PropertyForm: React.FC<PropertyFormProps> = ({ mode }) => {
  return <InmuebleFormCompact mode={mode} />;
};

export default PropertyForm;