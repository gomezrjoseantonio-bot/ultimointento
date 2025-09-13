import React from 'react';
import InmuebleWizard from '../../../../components/inmuebles/InmuebleWizard';

interface PropertyFormProps {
  mode: 'create' | 'edit';
}

const PropertyForm: React.FC<PropertyFormProps> = ({ mode }) => {
  return <InmuebleWizard mode={mode} />;
};

export default PropertyForm;