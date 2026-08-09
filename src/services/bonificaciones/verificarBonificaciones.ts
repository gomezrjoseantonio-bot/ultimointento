// ============================================================================
// Qué demuestran los movimientos de cada bonificación · VOCABULARIO §6 ter
// ============================================================================
//
// El REPARTO: qué función contesta cada tipo de condición, y la tabla de las
// que todavía no sabe contestar nadie. La forma de la respuesta está en
// `cumplimiento`, la de la pregunta en `pruebas`.
//
// Aquí viven las condiciones que se prueban con movimientos de la cuenta —la
// tarjeta (§3.6), la nómina, los recibos, las pólizas y la alarma—. Las de
// inversión están en `reglasDeInversion`: son otra forma, porque tienen dos
// pruebas distintas y una de ellas no es un movimiento.
//
// Añadir una es quitar su fila de `SIN_FUENTE` y escribir su función. Esa tabla
// es, literalmente, la lista de lo que falta.
//
// Puro: no lee la base ni el reloj. Quien llame pasa los movimientos y el día.
// ============================================================================

import type { Bonificacion, ReglaBonificacion } from '../../types/prestamos';
import { gastoDeLaTarjeta } from '../gastoPorTarjeta';
import type { CobroDeUnMes } from './cobrosDeNomina';
import { cobrosDeLaCuenta } from './cobrosDeNomina';
import { recibosDeLaCuenta } from './recibosDomiciliados';
import { bonificaHipoteca } from '../tarjetasReglas';
import { letraAlcanza } from '../prestamos/certificadoDelInmueble';
import { deLaCuenta, delTipo, primaTotal, queSuenanA } from './gastosDomiciliados';
import { porAportaciones, porFondos } from './reglasDeInversion';
import type { Cumplimiento, Ventana } from './cumplimiento';
import { ventanaDeEvaluacion, veredictoDelImporte } from './cumplimiento';
import type { MovimientosQuePrueban } from './pruebas';
import { centimos, cuentaDondeMira, noVerificable } from './pruebas';

/**
 * Lo que todavía no se puede mirar, y por qué · §6 ter.
 *
 * Exhaustiva a propósito, como las tablas de `metodoDePago`: un tipo de regla
 * nuevo no compila hasta que alguien decida qué se dice de él. Un `switch` con
 * `default` lo dejaría pasar en silencio, que es como se llega a «nadie las
 * mira» sin que nadie lo decidiera.
 */
const SIN_FUENTE: Record<
  Exclude<
    ReglaBonificacion['tipo'],
    | 'TARJETA'
    | 'NOMINA'
    | 'RECIBOS'
    | 'SEGUROS'
    | 'SEGURO_HOGAR'
    | 'SEGURO_VIDA'
    | 'PLAN_PENSIONES'
    | 'FONDOS'
    | 'ALARMA'
    | 'CERTIFICADO_ENERGETICO'
  >,
  string
> = {
  OTRA: 'una condición escrita a mano no dice qué hay que mirar',
};

/**
 * La condición de tarjeta · §3.6.
 *
 * Dos reglas del vocabulario mandan aquí, y las dos son de las que se pagan en
 * el recibo si se ignoran:
 *
 *   - **Solo cuenta la tarjeta DEL BANCO que bonifica.** Las de fuera nunca.
 *   - Se demuestra con lo **cobrado**, no con lo que esperas gastar: solo
 *     periodos ya cerrados (§3.5).
 */
function porTarjeta(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'TARJETA' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre };

  if (b.tarjetaExigidaId == null) {
    return noVerificable(b, 'no dice con qué tarjeta se cumple');
  }

  const tarjeta = movimientos.tarjetas.find((t) => t.id === b.tarjetaExigidaId);
  if (!tarjeta || tarjeta.id == null) {
    return noVerificable(b, 'la tarjeta que exige ya no está');
  }

  // Esto SÍ es verificable, y la respuesta es que no: una tarjeta de fuera no
  // bonifica por mucho que se gaste con ella. Decir «no se puede comprobar»
  // mandaría a gastar más para arreglar algo que no se arregla gastando.
  if (!bonificaHipoteca(tarjeta)) {
    return {
      ...base,
      veredicto: 'no_cumple',
      motivo: `«${tarjeta.alias}» es de fuera, y las de fuera nunca bonifican`,
    };
  }

  if (regla.importeMinimo == null || regla.importeMinimo <= 0) {
    // Del crédito se conoce el recibo del periodo, que es la suma — no las
    // compras una a una (§3.5). Contar operaciones necesita otro dato.
    if (regla.movimientosMesMin != null && regla.movimientosMesMin > 0) {
      return noVerificable(b, 'cuenta operaciones, y de la tarjeta solo se conoce el total del periodo');
    }
    return noVerificable(b, 'no dice cuánto hay que gastar');
  }

  const cerrado = gastoDeLaTarjeta(movimientos.periodosDeTarjeta, tarjeta.id, {
    ...ventana,
    soloCerrados: true,
  });
  const todo = gastoDeLaTarjeta(movimientos.periodosDeTarjeta, tarjeta.id, ventana);

  return {
    ...base,
    veredicto: veredictoDelImporte(cerrado, regla.importeMinimo),
    ventana,
    medido: centimos(cerrado),
    exigido: regla.importeMinimo,
    sinCobrar: centimos(todo - cerrado),
  };
}

/**
 * Lo que hay guardado no siempre tiene la forma que dice el tipo.
 *
 * `regla` y `lookbackMeses` son obligatorios en `Bonificacion`, pero hay
 * préstamos anteriores a que existieran —el asistente los rellena al abrirlos,
 * y esto no pasa por el asistente: la ficha del préstamo lee de la base—. Sin
 * esta comprobación, una bonificación vieja no da un resultado raro: rompe la
 * pantalla entera al leer `.tipo` de un `undefined`.
 *
 * Y no se les pone un valor por defecto: una ventana inventada diría «no
 * cumples» de algo medido en otro plazo. No saber en cuántos meses se mide es
 * exactamente no poder comprobarlo.
 */
function loQueFaltaParaMirarla(b: Bonificacion): string | null {
  if (b.regla?.tipo == null) return 'no dice qué hay que demostrar';
  if (!Number.isFinite(b.lookbackMeses) || b.lookbackMeses <= 0) {
    return 'no dice en cuántos meses se mide';
  }
  return null;
}

/**
 * La condición de SEGUROS · §6 ter.
 *
 * Aquí ponía «un seguro se prueba con su póliza, no con un movimiento», y era
 * falso: **un seguro se domicilia** *(Jose · 6 ago 2026, «ya sea agrario o
 * medio pensionista»)*. La prueba lleva todo este tiempo en tesorería.
 *
 * Las tres formas que usan los bancos, con una sola cuenta:
 *
 *   · **¿la tienes?** · hay una póliza activa cargando en su cuenta
 *   · **¿cuántas?** · `minimoPolizas`
 *   · **¿por cuánto?** · `primaAnualMinima` contra lo proyectado a doce meses
 *
 * Y responde el primer día, no en diciembre: lo previsto cuenta porque un
 * compromiso activo es un contrato, no una esperanza. Negarse a contestar por
 * prudencia sería un modo de fallo, no un valor por defecto — la tercera
 * respuesta está para lo que de verdad no se sabe.
 */
function porSeguros(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'SEGUROS' | 'SEGURO_HOGAR' | 'SEGURO_VIDA' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre, ventana };

  if (!movimientos.segurosDomiciliados) {
    return noVerificable(b, 'no hay gastos recurrentes dados de alta donde mirar la póliza');
  }

  // La cuenta del banco que bonifica · un seguro domiciliado en otro no le
  // entra a él, igual que la tarjeta de fuera no cuenta (§3.6).
  const cuentaId = cuentaDondeMira(b, movimientos);
  if (cuentaId == null) {
    return noVerificable(b, 'no dice en qué cuenta hay que domiciliar la póliza');
  }

  const todas = deLaCuenta(movimientos.segurosDomiciliados, cuentaId);
  // «Seguro de hogar» y «seguro de vida» piden UNO CONCRETO · «seguros» a secas
  // vale con cualquiera, que es lo que dicen los anexos que cuentan pólizas.
  const que = regla.tipo === 'SEGURO_HOGAR' ? 'hogar' : regla.tipo === 'SEGURO_VIDA' ? 'vida' : null;
  const suyas = que ? delTipo(todas, que) : todas;

  if (suyas.length === 0) {
    // Con pólizas en la cuenta pero ninguna que diga de qué es, no se puede
    // decir que no: puede ser justo la que pide y no lo pone. Es la tercera
    // respuesta, usada para lo que de verdad no se sabe.
    if (que && todas.length > 0) {
      return noVerificable(
        b,
        `hay ${todas.length} ${todas.length === 1 ? 'póliza domiciliada' : 'pólizas domiciliadas'} en esa cuenta, pero ninguna dice ser de ${que}`
      );
    }
    return {
      ...base,
      veredicto: 'no_cumple',
      motivo: que
        ? `no hay ningún seguro de ${que} domiciliado en esa cuenta`
        : 'no hay ningún seguro domiciliado en esa cuenta',
    };
  }

  // El % del capital que asegura la vida NO se ve en tesorería · el recibo dice
  // lo que cuesta, no por cuánto cubre. Con la cifra pedida, decir «cumple»
  // porque hay una póliza domiciliada sería afirmar lo que no se sabe: hay
  // vidas por el 50 % del capital que no dan la bonificación. La respuesta
  // honesta dice lo que SÍ consta y dónde se acaba lo que ATLAS ve.
  if (regla.tipo === 'SEGURO_VIDA' && regla.capitalAseguradoPct) {
    return noVerificable(
      b,
      `hay seguro de vida domiciliado, pero el recibo no dice si cubre el ${regla.capitalAseguradoPct} % del capital`
    );
  }

  // ¿Cuántas? · el anexo puede pedir dos o tres pólizas.
  const minimoPolizas = regla.tipo === 'SEGUROS' ? regla.minimoPolizas : undefined;
  if (minimoPolizas && suyas.length < minimoPolizas) {
    return {
      ...base,
      veredicto: 'no_cumple',
      medido: suyas.length,
      exigido: minimoPolizas,
      motivo: `${suyas.length} de las ${minimoPolizas} pólizas que pide`,
    };
  }

  // ¿Por cuánto? · contra la prima proyectada del año, no contra lo cobrado.
  const minimoPrima =
    regla.tipo === 'SEGUROS'
      ? regla.primaAnualMinima
      : regla.tipo === 'SEGURO_HOGAR'
        ? regla.primaAnual
        : undefined;
  if (minimoPrima && minimoPrima > 0) {
    const total = primaTotal(suyas);
    return {
      ...base,
      veredicto: veredictoDelImporte(total, minimoPrima),
      medido: total,
      exigido: minimoPrima,
      motivo: `${suyas.length === 1 ? 'la póliza suma' : `${suyas.length} pólizas suman`} ${total.toFixed(2)} € al año`,
    };
  }

  return {
    ...base,
    veredicto: 'cumple',
    medido: primaTotal(suyas),
    motivo:
      suyas.length === 1
        ? `${suyas[0].alias} · domiciliado en esa cuenta`
        : `${suyas.length} pólizas domiciliadas en esa cuenta`,
  };
}

/**
 * La condición de ALARMA · la séptima forma.
 *
 * Aquí ponía «la alarma se prueba con su contrato, no con un movimiento», y era
 * el mismo error que con los seguros: *«la alarma es un gasto recurrente que se
 * puede crear siempre asociada a la cuenta»* *(Jose · 8 ago 2026)*. La prueba
 * está donde está la del seguro — en el recibo que le pasas al banco.
 *
 * La diferencia es que el modelo no la tipifica: no hay `TipoCompromiso`
 * `'alarma'`, así que se reconoce por la palabra, en el subtipo o en el alias.
 * Y de ahí sale la tercera respuesta, que aquí es la importante: con recibos en
 * esa cuenta y ninguno que diga ser la alarma, ATLAS **no sabe** si la tienes
 * dada de alta con otro nombre. Un «no cumples» ahí mandaría a contratar una
 * alarma que ya está contratada.
 */
function porAlarma(
  b: Bonificacion,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre, ventana };

  if (!movimientos.gastosDomiciliados) {
    return noVerificable(b, 'no hay gastos recurrentes dados de alta donde mirar la alarma');
  }

  const cuentaId = cuentaDondeMira(b, movimientos);
  if (cuentaId == null) {
    return noVerificable(b, 'no dice en qué cuenta hay que domiciliar la alarma');
  }

  const enLaCuenta = deLaCuenta(movimientos.gastosDomiciliados, cuentaId);
  const alarmas = queSuenanA(enLaCuenta, 'alarma');

  if (alarmas.length > 0) {
    return {
      ...base,
      veredicto: 'cumple',
      medido: primaTotal(alarmas),
      motivo: `${alarmas[0].alias} · domiciliada en esa cuenta`,
    };
  }

  if (enLaCuenta.length > 0) {
    return noVerificable(
      b,
      `hay ${enLaCuenta.length} ${enLaCuenta.length === 1 ? 'recibo domiciliado' : 'recibos domiciliados'} en esa cuenta, pero ninguno dice ser la alarma`
    );
  }

  // Sin un solo recibo en esa cuenta el silencio sí es un «no»: la alarma se
  // paga todos los meses, y si no se carga ahí no le entra a este banco.
  return {
    ...base,
    veredicto: 'no_cumple',
    motivo: 'no hay ningún recibo domiciliado en esa cuenta',
  };
}

/**
 * La condición de CERTIFICADO ENERGÉTICO · la octava, y la única sin dinero.
 *
 * *«Si se tiene o no se tiene se dice una vez · podemos implementarlo en el
 * alta del piso»* *(Jose · 8 ago 2026)*. Aquí ponía «la letra la dice el
 * certificado del inmueble, no la tesorería», que era verdad y por eso mismo
 * estaba mal: la conclusión correcta no era darse por vencido, era ir a
 * preguntárselo al inmueble.
 *
 * Tres respuestas, y las tres importan:
 *
 *   · nadie lo ha dicho todavía → no se puede comprobar
 *   · el inmueble no tiene certificado → no cumple, y se sabe
 *   · lo tiene → se compara con la letra que pida el anexo, si pide alguna
 */
function porCertificado(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'CERTIFICADO_ENERGETICO' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre, ventana };
  const letra = movimientos.letraEnergetica;

  if (letra == null) {
    return noVerificable(b, 'no consta si el inmueble tiene certificado energético');
  }
  if (letra === 'NO') {
    return { ...base, veredicto: 'no_cumple', motivo: 'el inmueble no tiene certificado energético' };
  }

  // Sin letra pedida, la condición es tenerlo · y lo tiene.
  if (!regla.letraMinima?.trim()) {
    return { ...base, veredicto: 'cumple', motivo: `certificado energético ${letra}` };
  }

  const alcanza = letraAlcanza(letra, regla.letraMinima);
  if (alcanza == null) {
    return noVerificable(
      b,
      `el anexo pide «${regla.letraMinima.trim()}», que no es una letra del certificado`
    );
  }

  return {
    ...base,
    veredicto: alcanza ? 'cumple' : 'no_cumple',
    motivo: `el inmueble tiene ${letra} y pide al menos ${regla.letraMinima.trim().toUpperCase()}`,
  };
}

/**
 * Los meses que CUENTAN para demostrar algo, con su importe ya normalizado.
 *
 * Un mes `cerrado` cuenta con lo que entró. Un mes cerrado A MANO cuenta
 * también, pero **con cero**: cerrarlo es precisamente decir que lo que quedaba
 * abierto no se ha producido (§6 quater). Lo demás no cuenta: una bonificación
 * se demuestra con lo cobrado, no con lo previsto.
 *
 * Vive aquí porque las dos ramas de la condición de ingresos —la nómina y los
 * recurrentes— tienen que aplicar la MISMA regla. Escrita dos veces, bastaba
 * tocar una para que las dos ramas contaran distinto el mismo mes.
 */
function mesesQueCuentan(todos: CobroDeUnMes[], mesesCerrados?: string[]): CobroDeUnMes[] {
  const cerrados = new Set(mesesCerrados ?? []);
  return todos
    .filter((m) => m.estado === 'cerrado' || cerrados.has(m.mes))
    .map((m) => (m.estado === 'cerrado' ? m : { ...m, importe: 0 }));
}

/**
 * ¿Cumple por la rama de los INGRESOS RECURRENTES?
 *
 * Devuelve un cumplimiento solo si la rama existe y **se cumple**; si no,
 * `null` y manda la nómina. Es una disyunción: basta con una de las dos, y
 * fallar por aquí no es fallar.
 *
 * Se suma lo que entra en la cuenta del banco durante la ventana, venga de
 * donde venga: alquileres, dividendos, lo que sea. Qué meses cuentan y con qué
 * importe lo decide `mesesQueCuentan`, la misma regla que aplica la nómina —los
 * cerrados a mano entran con cero, que es lo que significa cerrarlos—.
 */
function cumplePorIngresosRecurrentes(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'NOMINA' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban,
  cuentaId: number
): Cumplimiento | null {
  const minimo = regla.minimoAnualRecurrente;
  if (!Number.isFinite(minimo) || (minimo as number) <= 0) return null;
  if (!movimientos.ingresosRecurrentes?.length) return null;

  const meses = mesesQueCuentan(
    cobrosDeLaCuenta(movimientos.ingresosRecurrentes, cuentaId, ventana),
    movimientos.mesesCerrados
  );
  const total = centimos(meses.reduce((s, m) => s + m.importe, 0));

  if (veredictoDelImporte(total, minimo as number) !== 'cumple') return null;

  return {
    bonificacionId: b.id,
    nombre: b.nombre,
    veredicto: 'cumple',
    ventana,
    exigido: minimo as number,
    medido: total,
    // «meses mirados», no «meses cobrados»: entre ellos puede haber alguno
    // cerrado a mano, que cuenta con cero porque ese mes no entró nada. Decir
    // «cobrados» de un mes vacío es afirmar un hecho que no ocurrió.
    motivo: `por ingresos recurrentes en esa cuenta · ${meses.length} meses mirados`,
  };
}

/**
 * La condición de nómina · §6 ter.
 *
 * Lo que el banco mira es **lo que le entra a él**: la nómina domiciliada en su
 * cuenta, por encima del mínimo, **todos los meses**. Por eso el veredicto sale
 * del mes más flojo y no del total: un semestre con 7.200 € no cumple «1.200 €
 * al mes» si un mes vino vacío y otro doble.
 *
 * Y solo cuenta lo cobrado, como en la tarjeta (§3.5): lo que aún no ha entrado
 * no demuestra nada.
 */
function porNomina(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'NOMINA' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre };

  // `!b.cuentaExigidaId` y no `== null`: la cuenta se guarda como texto y el
  // selector deja `''` al no elegir ninguna — y `Number('')` es 0, un id que
  // parece válido. Se habría mirado la cuenta cero.
  const cuentaId = cuentaDondeMira(b, movimientos);
  if (cuentaId == null) {
    return noVerificable(b, 'no dice en qué cuenta hay que domiciliarla');
  }
  if (!Number.isFinite(regla.minimoMensual) || regla.minimoMensual <= 0) {
    return noVerificable(b, 'no dice cuánto tiene que entrar al mes');
  }

  // LA OTRA RAMA · «o ingresos recurrentes por importe anual igual o superior a
  // 30.000 euros netos». No exige nómina ninguna: valen alquileres, dividendos,
  // lo que entre. Se mira PRIMERO porque basta con una de las dos, y mirando
  // solo la nómina se le decía que no cumple a quien sí cumple —la madre del
  // cordero de §6 ter—.
  const porRecurrentes = cumplePorIngresosRecurrentes(b, regla, ventana, movimientos, cuentaId);
  if (porRecurrentes) return porRecurrentes;

  // Sin una sola nómina en toda la tesorería, el silencio no es un «no»: es que
  // ATLAS no sabe de ninguna. Distinto de tenerla domiciliada en otro banco,
  // que sí es incumplir y se ve más abajo.
  if (movimientos.cobrosDeNomina.length === 0) {
    return noVerificable(b, 'no hay ninguna nómina dada de alta');
  }

  const todos = cobrosDeLaCuenta(movimientos.cobrosDeNomina, cuentaId, ventana);
  const meses = mesesQueCuentan(todos, movimientos.mesesCerrados);
  const sinCerrar = todos.length - meses.length;

  if (meses.length === 0) {
    // Con cobros en esa cuenta y ninguno cerrado, decir «no ha entrado
    // ninguna» sería una acusación falsa: la nómina SÍ está domiciliada ahí.
    // Y el motivo no dice «sin conciliar» porque no se sabe: puede que el
    // cargo esté por cuadrar o que sencillamente aún no haya pasado. Lo único
    // cierto es que no consta cobrada — la misma tercera respuesta de §6 ter.
    if (todos.length > 0) {
      return noVerificable(b, 'todavía no consta cobrada ninguna nómina de esa cuenta');
    }
    return {
      ...base,
      veredicto: 'no_cumple',
      ventana,
      exigido: regla.minimoMensual,
      motivo: 'no ha entrado ninguna nómina en esa cuenta',
    };
  }

  // El mes más flojo es el que decide: basta uno por debajo para perderla.
  //
  // Contar y juzgar con la MISMA función · escrita a mano, la holgura de medio
  // céntimo viviría en dos sitios y bastaría tocar uno para que la línea dijera
  // «6 de 6 meses» junto a un «no cumple».
  const llega = (importe: number) => veredictoDelImporte(importe, regla.minimoMensual) === 'cumple';
  const peor = Math.min(...meses.map((m) => m.importe));
  const queLlegan = meses.filter((m) => llega(m.importe)).length;

  return {
    ...base,
    veredicto: veredictoDelImporte(peor, regla.minimoMensual),
    ventana,
    medido: centimos(peor),
    exigido: regla.minimoMensual,
    mensual: { conMovimiento: meses.length, queLlegan, sinCerrar },
  };
}

/**
 * La condición de recibos domiciliados · §6 ter.
 *
 * «Tener domiciliados al menos N recibos». Lo que cuenta es **cuántos
 * distintos** —tres recibos son tres servicios, no el de la luz tres meses— y,
 * como la nómina, se mide **mes a mes**: el mes con menos recibos es el que
 * decide, porque basta uno flojo para que la revisión la tumbe.
 */
function porRecibos(
  b: Bonificacion,
  regla: Extract<ReglaBonificacion, { tipo: 'RECIBOS' }>,
  ventana: Ventana,
  movimientos: MovimientosQuePrueban
): Cumplimiento {
  const base = { bonificacionId: b.id, nombre: b.nombre, unidad: 'recibos' as const };

  const cuentaId = cuentaDondeMira(b, movimientos);
  if (cuentaId == null) {
    return noVerificable(b, 'no dice en qué cuenta hay que domiciliarlos');
  }
  if (!Number.isFinite(regla.minimoRecibos) || regla.minimoRecibos <= 0) {
    return noVerificable(b, 'no dice cuántos recibos hacen falta');
  }

  // Un conteo · `Math.ceil` y no `round` porque el umbral es un MÍNIMO: «al
  // menos 2,5 recibos» se cumple con tres, no con dos. El asistente ya guarda
  // enteros, así que para un dato sano esto no cambia nada; protege del que se
  // haya guardado a mano, que si no acabaría dicho «2,5 recibos» en pantalla.
  const exigidos = Math.ceil(regla.minimoRecibos);

  const todos = recibosDeLaCuenta(movimientos.recibosDomiciliados, cuentaId, ventana);
  const meses = todos.filter((m) => m.estado === 'cerrado');
  const sinCerrar = todos.length - meses.length;

  if (meses.length === 0) {
    // Hay cargos en esa cuenta y ninguno consta todavía · no es que no los
    // tengas domiciliados. Igual que en la nómina, no se afirma por qué: puede
    // estar por conciliar o puede no haber pasado aún.
    if (todos.length > 0) {
      return noVerificable(b, 'todavía no consta cargado ningún recibo de esa cuenta');
    }
    // Sin nada, ni previsto ni cobrado, el silencio SÍ es un «no»: a diferencia
    // de la nómina, no hace falta dar de alta nada para que ATLAS vea un recibo
    // domiciliado — sale de los gastos recurrentes, que es de donde sale toda
    // la tesorería.
    return {
      ...base,
      veredicto: 'no_cumple',
      ventana,
      medido: 0,
      exigido: exigidos,
      motivo: 'no se ha cargado ningún recibo en esa cuenta',
    };
  }

  const llega = (cuantos: number) => cuantos >= exigidos;
  const peor = Math.min(...meses.map((m) => m.cuantos));

  return {
    ...base,
    veredicto: llega(peor) ? 'cumple' : 'no_cumple',
    ventana,
    medido: peor,
    exigido: exigidos,
    mensual: {
      conMovimiento: meses.length,
      queLlegan: meses.filter((m) => llega(m.cuantos)).length,
      sinCerrar,
    },
  };
}

function verificarUna(
  b: Bonificacion,
  movimientos: MovimientosQuePrueban,
  hasta: string
): Cumplimiento {
  const falta = loQueFaltaParaMirarla(b);
  if (falta) return noVerificable(b, falta);

  const ventana = ventanaDeEvaluacion(hasta, b.lookbackMeses);
  if (b.regla.tipo === 'PLAN_PENSIONES') return porAportaciones(b, b.regla, ventana, movimientos);
  if (b.regla.tipo === 'FONDOS') return porFondos(b, b.regla, ventana, movimientos);
  if (b.regla.tipo === 'TARJETA') return porTarjeta(b, b.regla, ventana, movimientos);
  if (b.regla.tipo === 'NOMINA') return porNomina(b, b.regla, ventana, movimientos);
  if (b.regla.tipo === 'RECIBOS') return porRecibos(b, b.regla, ventana, movimientos);
  if (b.regla.tipo === 'ALARMA') return porAlarma(b, ventana, movimientos);
  if (b.regla.tipo === 'CERTIFICADO_ENERGETICO') {
    return porCertificado(b, b.regla, ventana, movimientos);
  }
  if (
    b.regla.tipo === 'SEGUROS' ||
    b.regla.tipo === 'SEGURO_HOGAR' ||
    b.regla.tipo === 'SEGURO_VIDA'
  ) {
    return porSeguros(b, b.regla, ventana, movimientos);
  }

  // `hasOwnProperty` y no `SIN_FUENTE[...]` a secas: un tipo guardado que ya no
  // esté en la tabla daría un motivo `undefined`, y el usuario leería
  // «No se puede comprobar · undefined».
  const conocido = Object.prototype.hasOwnProperty.call(SIN_FUENTE, b.regla.tipo);
  return noVerificable(b, conocido ? SIN_FUENTE[b.regla.tipo] : 'no se reconoce qué mirar');
}

/**
 * Qué dicen los movimientos de cada bonificación del préstamo, a día `hasta`.
 *
 * Las que el usuario no contrató (`INACTIVO`) quedan fuera: enseñar «no
 * cumples» de algo que nunca se pidió es ruido, y el ruido acaba tapando la que
 * sí importa.
 */
export function verificarBonificaciones(
  bonificaciones: Bonificacion[] | undefined,
  movimientos: MovimientosQuePrueban,
  hasta: string
): Cumplimiento[] {
  return (bonificaciones ?? [])
    .filter((b) => b.estado !== 'INACTIVO')
    .map((b) => verificarUna(b, movimientos, hasta));
}
