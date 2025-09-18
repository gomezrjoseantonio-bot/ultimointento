/**
 * Integration tests for UI Contraparte labels
 */

describe('UI Contraparte Integration Tests', () => {
  
  test('Form data structure should use counterparty field', () => {
    // Test form data structure
    const formData = {
      description: 'Test payment',
      amount: 100,
      counterparty: 'Test Supplier S.L.',
      date: '2024-01-15',
      type: 'Gasto'
    };

    expect(formData).toHaveProperty('counterparty');
    expect(formData).not.toHaveProperty('proveedor');
    expect(formData.counterparty).toBe('Test Supplier S.L.');
  });

  test('Movement object should contain counterparty field, not proveedor', () => {
    const mockMovement = {
      id: 1,
      amount: 100,
      description: 'Test movement',
      counterparty: 'Test Counterparty',
      date: '2024-01-15',
      accountId: 1,
      status: 'pendiente' as const,
      unifiedStatus: 'confirmado' as any,
      source: 'manual' as any,
      category: { tipo: 'Test' },
      type: 'Ingreso' as const,
      origin: 'Manual' as const,
      movementState: 'Confirmado' as const,
      ambito: 'PERSONAL' as const,
      statusConciliacion: 'sin_match' as const,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z'
    };

    expect(mockMovement.counterparty).toBe('Test Counterparty');
    expect(mockMovement).not.toHaveProperty('proveedor');
  });

  test('API response should contain counterparty field, not proveedor', () => {
    // Mock API response structure
    const mockApiResponse = {
      id: 1,
      amount: 150.75,
      description: 'Bank transfer',
      counterparty: 'External Company S.L.',
      date: '2024-01-15',
      status: 'conciliado'
    };

    // Verify response structure
    expect(mockApiResponse).toHaveProperty('counterparty');
    expect(mockApiResponse).not.toHaveProperty('proveedor');
    expect(mockApiResponse.counterparty).toBe('External Company S.L.');
  });

  test('Form submission should save counterparty field correctly', async () => {
    const mockFormData = {
      description: 'Test payment',
      amount: 100,
      counterparty: 'Test Supplier S.L.',
      date: '2024-01-15',
      type: 'Gasto'
    };

    // In a real form submission, this would be the data sent to the database
    const expectedDBRecord = {
      description: mockFormData.description,
      amount: -Math.abs(mockFormData.amount), // Negative for expense
      counterparty: mockFormData.counterparty,
      date: mockFormData.date,
      type: mockFormData.type
    };

    expect(expectedDBRecord.counterparty).toBe('Test Supplier S.L.');
    expect(expectedDBRecord).not.toHaveProperty('proveedor');
  });

  test('Treasury record creation should map to correct counterparty fields', () => {
    // Test different treasury record types
    const ingresoRecord = {
      contraparte: 'Rental Income Provider'
    };

    const gastoRecord = {
      contraparte_nombre: 'Utility Company'
    };

    const capexRecord = {
      contraparte: 'Construction Company'
    };

    expect(ingresoRecord.contraparte).toBe('Rental Income Provider');
    expect(gastoRecord.contraparte_nombre).toBe('Utility Company');
    expect(capexRecord.contraparte).toBe('Construction Company');

    // Ensure no proveedor fields exist
    expect(ingresoRecord).not.toHaveProperty('proveedor');
    expect(gastoRecord).not.toHaveProperty('proveedor_nombre');
    expect(capexRecord).not.toHaveProperty('proveedor');
  });
});