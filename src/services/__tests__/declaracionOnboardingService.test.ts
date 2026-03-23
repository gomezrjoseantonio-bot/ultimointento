import { initDB } from '../db';
import type { ExtraccionCompleta } from '../aeatParserService';
import {
  analizarDeclaracion,
  analizarDeclaracionParaOnboarding,
  ejecutarImportacion,
} from '../declaracionOnboardingService';

const createExtraccion = (): ExtraccionCompleta => ({
  exito: true,
  errores: [],
  warnings: [],
  meta: {
    ejercicio: 2024,
    modelo: '100',
    nif: '12345678Z',
    nombre: 'Ada Lovelace',
    fechaPresentacion: '2025-06-30',
    esRectificativa: false,
  },
  declaracion: {
    personal: {
      nif: '12345678Z',
      nombre: 'Ada Lovelace',
      comunidadAutonoma: 'Madrid',
      estadoCivil: 'soltera',
      fechaNacimiento: '1990-01-01',
    },
    trabajo: {
      retribucionesDinerarias: 0,
      retribucionEspecie: 0,
      ingresosACuenta: 0,
      contribucionesPPEmpresa: 0,
      totalIngresosIntegros: 0,
      cotizacionSS: 0,
      rendimientoNetoPrevio: 0,
      otrosGastosDeducibles: 0,
      rendimientoNeto: 0,
      rendimientoNetoReducido: 0,
      retencionesTrabajoTotal: 0,
    },
    inmuebles: [
      {
        orden: 1,
        referenciaCatastral: 'REF-001',
        direccion: 'Calle Mayor 1, Madrid',
        porcentajePropiedad: 100,
        uso: 'arrendamiento',
        esAccesorio: false,
        derechoReduccion: true,
        nifArrendatario1: '11111111H',
        fechaContrato: '2024-01-01',
        diasArrendado: 365,
        diasDisposicion: 0,
        rentaImputada: 0,
        ingresosIntegros: 12000,
        arrastresRecibidos: 0,
        arrastresAplicados: 0,
        interesesFinanciacion: 1500,
        gastosReparacion: 0,
        gastos0105_0106Aplicados: 0,
        arrastresGenerados: 500,
        gastosComunidad: 0,
        gastosServicios: 0,
        gastosSuministros: 0,
        gastosSeguros: 0,
        gastosTributos: 0,
        amortizacionMuebles: 0,
        tipoAdquisicion: 'onerosa',
        fechaAdquisicion: '2020-01-10',
        valorCatastral: 100000,
        valorCatastralConstruccion: 70000,
        porcentajeConstruccion: 70,
        importeAdquisicion: 150000,
        gastosAdquisicion: 10000,
        mejoras: 0,
        baseAmortizacion: 0,
        amortizacionInmueble: 0,
        rendimientoNeto: 0,
        reduccion: 0,
        rendimientoNetoReducido: 0,
      },
    ],
    actividades: [],
    capitalMobiliario: {
      interesesCuentas: 50,
      otrosRendimientos: 0,
      totalIngresosIntegros: 50,
      rendimientoNeto: 50,
      rendimientoNetoReducido: 50,
      retencionesCapital: 0,
    },
    gananciasPerdidas: {
      gananciasNoTransmision: 0,
      perdidasNoTransmision: 0,
      saldoNetoGeneral: 0,
      gananciasTransmision: 0,
      perdidasTransmision: 0,
      saldoNetoAhorro: 0,
      compensacionPerdidasAnteriores: 0,
      perdidasPendientes: [],
    },
    planPensiones: {
      aportacionesTrabajador: 0,
      contribucionesEmpresariales: 0,
      totalConDerecho: 0,
      reduccionAplicada: 0,
    },
    basesYCuotas: {
      baseImponibleGeneral: 0,
      baseImponibleAhorro: 0,
      baseLiquidableGeneral: 0,
      baseLiquidableAhorro: 0,
      cuotaIntegraEstatal: 0,
      cuotaIntegraAutonomica: 0,
      cuotaIntegra: 0,
      cuotaLiquidaEstatal: 0,
      cuotaLiquidaAutonomica: 0,
      cuotaLiquida: 0,
      cuotaResultante: 0,
      retencionesTotal: 0,
      cuotaDiferencial: 0,
      resultadoDeclaracion: -100,
    },
  },
  casillasRaw: { '0105': 1500, '1221': 500 },
  inmueblesDetalle: [],
  arrastres: {
    gastos0105_0106: [{
      referenciaCatastral: 'REF-001',
      ejercicioOrigen: 2024,
      pendienteInicio: 0,
      aplicadoEstaDeclaracion: 0,
      pendienteFuturo: 500,
      generadoEsteEjercicio: 500,
    }],
    perdidasAhorro: [{
      tipo: 'ahorro',
      ejercicioOrigen: 2022,
      pendienteInicio: 1000,
      aplicado: 250,
      pendienteFuturo: 750,
    }],
    gastosInmuebleDetalle: [],
  },
  paginasProcesadas: 3,
  totalCasillas: 42,
});

describe('declaracionOnboardingService', () => {
  beforeEach(async () => {
    const db = await initDB();
    await Promise.all([
      db.clear('properties'),
      db.clear('prestamos'),
      db.clear('contracts'),
      db.clear('accounts'),
      db.clear('ejerciciosFiscales'),
      db.clear('personalData'),
      db.clear('autonomos'),
      db.clear('rentaMensual'),
    ]);
  });

  it('detecta inmuebles nuevos, préstamo, contrato y arrastres cuando la app está vacía', async () => {
    const resultado = await analizarDeclaracion(createExtraccion());

    expect(resultado.inmuebles.nuevos).toHaveLength(1);
    expect(resultado.inmuebles.actualizar).toHaveLength(0);
    expect(resultado.prestamos).toHaveLength(1);
    expect(resultado.prestamos[0].yaExisteEnAtlas).toBe(false);
    expect(resultado.contratos).toHaveLength(1);
    expect(resultado.contratos[0].yaExisteEnAtlas).toBe(false);
    expect(resultado.arrastres.gastos0105_0106).toHaveLength(1);
    expect(resultado.arrastres.perdidasAhorro).toHaveLength(1);
    expect(resultado.resumen.totalEntidadesNuevas).toBe(3);
  });

  it('expone un alias explícito para el flujo de onboarding histórico', async () => {
    const resultado = await analizarDeclaracionParaOnboarding(createExtraccion());

    expect(resultado.inmuebles.nuevos).toHaveLength(1);
    expect(resultado.contratos[0].yaExisteEnAtlas).toBe(false);
  });

  it('crea entidades y guarda la declaración cuando el usuario confirma la importación', async () => {
    const db = await initDB();
    await db.add('accounts', {
      id: 1,
      alias: 'Cuenta principal',
      iban: 'ES6600491500051234567892',
      activa: true,
      isActive: true,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const resultado = await analizarDeclaracion(createExtraccion());
    const resumen = await ejecutarImportacion(resultado, {
      crearInmueblesNuevos: true,
      actualizarInmueblesExistentes: true,
      crearPrestamos: true,
      crearContratos: true,
      importarArrastres: true,
      guardarDeclaracion: true,
    });

    const [properties, prestamos, contracts, ejercicio] = await Promise.all([
      db.getAll('properties'),
      db.getAll('prestamos'),
      db.getAll('contracts'),
      db.get('ejerciciosFiscales', 2024),
    ]);

    expect(resumen.exito).toBe(true);
    expect(resumen.inmueblesCreados).toBe(1);
    expect(resumen.prestamosCreados).toBe(1);
    expect(resumen.contratosCreados).toBe(1);
    expect(resumen.arrastresImportados).toBeGreaterThanOrEqual(1);
    expect(resumen.declaracionGuardada).toBe(true);
    expect(properties).toHaveLength(1);
    expect(prestamos).toHaveLength(1);
    expect(contracts).toHaveLength(1);
    expect(ejercicio?.estado).toBe('declarado');
  });
});
