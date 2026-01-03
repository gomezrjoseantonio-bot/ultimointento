import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../../../../components/common/PageLayout';
import ContractsNuevo from '../../../horizon/inmuebles/contratos/components/ContractsNuevo';
import { Contract } from '../../../../services/db';
import { getContract } from '../../../../services/contractService';
import toast from 'react-hot-toast';

const ContratosNuevoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const contractId = searchParams.get('id');

  useEffect(() => {
    const fetchContract = async () => {
      if (!contractId) {
        setEditingContract(null);
        return;
      }

      try {
        setLoading(true);
        const contract = await getContract(Number(contractId));
        if (!contract) {
          toast.error('No se encontró el contrato solicitado');
          navigate('/contratos/lista');
          return;
        }
        setEditingContract(contract);
      } catch (error) {
        console.error('Error loading contract', error);
        toast.error('Error al cargar el contrato');
        navigate('/contratos/lista');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [contractId, navigate]);

  const handleContractCreated = () => {
    toast.success('Contrato guardado correctamente');
    navigate('/contratos/lista');
  };

  const handleCancel = () => {
    navigate('/contratos/lista');
  };

  return (
    <PageLayout
      title={contractId ? 'Editar contrato de alquiler' : 'Nuevo contrato de alquiler'}
      subtitle="Completa los datos del inquilino, los términos económicos y prepara el documento listo para firmar."
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 border-2 border-brand-navy border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <ContractsNuevo
          editingContract={editingContract ?? undefined}
          onContractCreated={handleContractCreated}
          onCancel={handleCancel}
        />
      )}
    </PageLayout>
  );
};

export default ContratosNuevoPage;
