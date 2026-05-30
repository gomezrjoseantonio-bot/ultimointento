// V78.1 (fix post-deploy H1) · tests de self-heal de modoExplotacion + limpieza de huérfanos.
//
// Reproduce el estado roto de producción de Jose: una property con
// `alquilerPorHabitaciones.activo:true` pero SIN `modoExplotacion`, y un Contract creado por
// error desde XML AEAT ("Fuertes Acevedo") sobre ese inmueble. Verifica que al abrir la DB:
//   · self-heal puebla `modoExplotacion='por_habitaciones'` (del boolean legacy)
//   · la limpieza elimina los Contracts huérfanos xml_aeat + sus treasuryEvents
//   · salva importe (acumulado) y NIFs (dni+cotitulares) al bote del (inmueble·año)
//   · NO toca contratos legítimos (piso_completo) ni contratos no-xml_aeat
import 'fake-indexeddb/auto';
import { openDB } from 'idb';

const DB_NAME = 'AtlasHorizonDB';

async function seedV77(properties: any[], contracts: any[], treasuryEvents: any[]) {
  const legacy = await openDB(DB_NAME, 77, {
    upgrade(db) {
      db.createObjectStore('properties', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('treasuryEvents', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('keyval');
    },
  });
  for (const p of properties) await legacy.put('properties', p);
  for (const c of contracts) await legacy.put('contracts', c);
  for (const e of treasuryEvents) await legacy.put('treasuryEvents', e);
  legacy.close();
}

describe('V78.1 · self-heal modoExplotacion + limpieza huérfanos', () => {
  beforeEach(() => {
    jest.resetModules();
    (globalThis as any).indexedDB = new IDBFactory();
  });

  it('puebla modoExplotacion, borra huérfanos xml_aeat + eventos, y salva importe/NIFs al bote', async () => {
    await seedV77(
      [
        // FA32 · estado roto de Jose: boolean true, sin modoExplotacion
        { id: 4, alias: 'FA32', alquilerPorHabitaciones: { activo: true } },
        // Inmueble piso completo legítimo
        { id: 1, alias: 'CB', modoExplotacion: 'piso_completo' },
        // Inmueble por habitaciones con contrato manual (no xml_aeat)
        { id: 5, alias: 'Hab', modoExplotacion: 'por_habitaciones' },
      ],
      [
        // Huérfano 1 · FA32 · xml_aeat · NIFs atrapados (dni + cotitular)
        {
          id: 10, inmuebleId: 4, estadoContrato: 'activo', rentaMensual: 713,
          inquilino: { nombre: '', apellidos: '', dni: 'Y5617860D', telefono: '', email: '', cotitulares: ['71682787K'] },
          ejerciciosFiscales: { 2024: { estado: 'declarado', importeDeclarado: 8550, dias: 365, fuente: 'xml_aeat' } },
        },
        // Huérfano 2 · FA32 · xml_aeat · mismo (inmueble·año) → acumula en el bote
        {
          id: 11, inmuebleId: 4, estadoContrato: 'activo', rentaMensual: 927,
          inquilino: { nombre: '', apellidos: '', dni: '11111111H', telefono: '', email: '', cotitulares: [] },
          ejerciciosFiscales: { 2024: { estado: 'declarado', importeDeclarado: 11125, dias: 200, fuente: 'xml_aeat' } },
        },
        // Legítimo piso_completo xml_aeat → NO se toca
        {
          id: 20, inmuebleId: 1, estadoContrato: 'activo',
          inquilino: { nombre: '', apellidos: '', dni: 'X', telefono: '', email: '' },
          ejerciciosFiscales: { 2024: { estado: 'declarado', importeDeclarado: 4000, dias: 365, fuente: 'xml_aeat' } },
        },
        // Manual (sin fuente xml_aeat) en inmueble por_habitaciones → NO se toca
        {
          id: 21, inmuebleId: 5, estadoContrato: 'activo',
          inquilino: { nombre: '', apellidos: '', dni: 'Z', telefono: '', email: '' },
        },
      ],
      [
        { id: 100, type: 'income', sourceType: 'contrato', sourceId: 10, amount: 713 },
        { id: 101, type: 'income', sourceType: 'contrato', sourceId: 11, amount: 927 },
        { id: 102, type: 'income', sourceType: 'contrato', sourceId: 20, amount: 333 },
      ],
    );

    const { initDB } = require('../db');
    const { boteAnualService } = require('../boteAnualService');
    const db = await initDB();

    // self-heal · FA32 poblado desde el boolean
    expect((await db.get('properties', 4)).modoExplotacion).toBe('por_habitaciones');

    // huérfanos eliminados
    expect(await db.get('contracts', 10)).toBeUndefined();
    expect(await db.get('contracts', 11)).toBeUndefined();
    // legítimos intactos
    expect(await db.get('contracts', 20)).toBeDefined();
    expect(await db.get('contracts', 21)).toBeDefined();

    // treasuryEvents en cascada solo de los huérfanos
    expect(await db.get('treasuryEvents', 100)).toBeUndefined();
    expect(await db.get('treasuryEvents', 101)).toBeUndefined();
    expect(await db.get('treasuryEvents', 102)).toBeDefined();

    // bote FA32 2024 · importe acumulado 8550+11125 · NIFs salvados (dni+cotitular de ambos)
    const bote = await boteAnualService.getBote(4, 2024);
    expect(bote).toBeDefined();
    expect(bote.importeDeclarado).toBe(19675);
    expect(bote.nifsDetectados.sort()).toEqual(['11111111H', '71682787K', 'Y5617860D']);
    expect(bote.estado).toBe('pendiente_total');

    // No se creó bote para el inmueble piso_completo legítimo
    expect(await boteAnualService.getBote(1, 2024)).toBeUndefined();
  });
});
