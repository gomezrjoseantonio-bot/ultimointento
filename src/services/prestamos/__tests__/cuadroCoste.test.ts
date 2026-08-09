// El cuadro no puede volver a costar 50 ms.
//
// Generar un cuadro de 240 cuotas costaba **50 ms**, y Financiación lo genera
// varias veces cada vez que se abre: la pantalla tardaba una eternidad y no se
// veía por qué, porque el bucle del cuadro es aritmética sencilla.
//
// El coste estaba en la TAE. `tir` busca el tipo por bisección y en CADA una de
// sus vueltas recalculaba la distancia de cada flujo a la firma —dos cadenas
// ISO partidas por flujo—, cuando esa distancia no depende del tipo que se está
// probando. Un cuadro de 240 cuotas pedía ~96.000 parseos de fecha para
// calcular un número.
//
// Este caso es un guardarraíl, no una medida: el umbral va MUY holgado
// —cinco veces lo medido— porque una máquina de integración es lenta e
// irregular, y un test que falla por ruido se acaba desactivando. Lo que
// atrapa es una vuelta atrás de un orden de magnitud, que es lo que pasó.

import { generarCuadro } from '../cuadro';
import type { Prestamo } from '../../../types/prestamos';

const unicaja = (): Prestamo =>
  ({
    id: 'u',
    nombre: 'Hipoteca Unicaja',
    principalInicial: 85000,
    plazoMesesTotal: 240,
    fechaFirma: '2023-08-25',
    fechaPrimerCargo: '2023-09-25',
    diaCargoMes: 25,
    tipo: 'MIXTO',
    tipoNominalAnualMixtoFijo: 2.6,
    tramoFijoMeses: 36,
    indice: 'EURIBOR',
    valorIndiceActual: 2.85,
    diferencial: 1.75,
    baseCalculoIntereses: 'ACT/365',
    esquemaPrimerRecibo: 'NORMAL',
  }) as unknown as Prestamo;

it('un cuadro de 240 cuotas se genera en milisegundos, no en decenas', () => {
  const prestamo = unicaja();
  // Calentar · la primera pasa mide el compilador, no el código.
  for (let i = 0; i < 5; i++) generarCuadro(prestamo);

  const arranque = process.hrtime.bigint();
  const vueltas = 20;
  for (let i = 0; i < vueltas; i++) generarCuadro(prestamo);
  const ms = Number(process.hrtime.bigint() - arranque) / 1e6 / vueltas;

  expect(ms).toBeLessThan(35);
});
