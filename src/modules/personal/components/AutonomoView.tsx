import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AutonomoView: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate('/gestion/personal/nueva-actividad');
  }, [navigate]);

  return null;
};

export default AutonomoView;
