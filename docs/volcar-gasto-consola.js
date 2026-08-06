// ============================================================================
// ¿POR QUÉ ESTE GASTO NO SALE EN NINGUNA LISTA? · snippet de consola · SÓLO LEE
// ============================================================================
//
// La lista de gastos se construye desde el CATÁLOGO: un grupo por familia, y
// cada gasto cae en el suyo. Los grupos vacíos se descartan… y con ellos se iba
// cualquier gasto cuya familia no fuera de ese catálogo, porque no encajaba en
// ninguno.
//
// Las familias de los dos catálogos NO coinciden:
//   inmueble → tributos · comunidad · suministros · SEGUROS · gestion · …
//   personal → vivienda · suministros · dia_a_dia · suscripciones · SEGUROS_CUOTAS · otros
//
// Un gasto creado desde la pestaña de un inmueble nace con la familia del
// catálogo de inmuebles. Si además se manda a PERSONAL (el seguro de vida que
// no va con la hipoteca · §4), su familia no existe en el catálogo de destino.
//
// Esto dice, para un gasto concreto, si le pasa eso.
// ============================================================================

(async () => {
  const ID = 15;   // <-- el id del gasto a examinar

  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('AtlasHorizonDB');   // sin versión · no migra
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const uno = (store, id) => new Promise(res => {
    if (!db.objectStoreNames.contains(store)) return res(undefined);
    const r = db.transaction(store, 'readonly').objectStore(store).get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(undefined);
  });

  const c = await uno('compromisosRecurrentes', ID);
  const L = [];

  if (!c) {
    L.push(`No existe el gasto #${ID}.`);
  } else {
    // Misma regla que `inferFamilia` en groupingHelpers.ts · si el gasto trae
    // `tipoFamilia`, MANDA sobre cualquier inferencia por tipo.
    const familia = c.tipoFamilia
      ? c.tipoFamilia
      : c.ambito === 'personal'
        ? ({ suministro: 'suministros', suscripcion: 'suscripciones', seguro: 'seguros_cuotas',
             cuota: 'seguros_cuotas', impuesto: 'otros' }[c.tipo] || 'otros')
        : ({ impuesto: 'tributos', suministro: 'suministros', seguro: 'seguros',
             comunidad: 'comunidad' }[c.tipo] || 'otros');

    const FAM_PERSONAL = ['vivienda', 'suministros', 'dia_a_dia', 'suscripciones', 'seguros_cuotas', 'otros'];
    const FAM_INMUEBLE = ['tributos', 'comunidad', 'suministros', 'seguros', 'gestion',
                          'reparacion', 'servicios', 'mobiliario', 'otros'];
    const destino = c.ambito === 'personal' ? FAM_PERSONAL : FAM_INMUEBLE;
    const encaja = destino.includes(familia);

    L.push(`Gasto #${ID} · «${c.alias}» · ${c.estado}`);
    L.push(`  ámbito       : ${c.ambito}${c.inmuebleId ? ` (inmueble ${c.inmuebleId})` : ''}`);
    L.push(`  tipo         : ${c.tipo}   subtipo: ${c.subtipo ?? '—'}`);
    L.push(`  tipoFamilia  : ${c.tipoFamilia ?? '(sin poner · se infiere del tipo)'}`);
    L.push(`  categoria    : ${c.categoria ?? '—'}`);
    L.push('');
    L.push(`  familia con la que se agrupa : «${familia}»`);
    L.push(`  familias del catálogo destino: ${destino.join(' · ')}`);
    L.push('');
    L.push(encaja
      ? `  ✓ Encaja · se pinta en el grupo «${familia}» de ${c.ambito === 'personal' ? 'Personal › Gastos' : 'la ficha del inmueble'}.`
      : `  ✗ NO ENCAJA · su familia «${familia}» no existe en el catálogo de ${c.ambito}.\n` +
        '    Antes del arreglo esto lo dejaba fuera de TODOS los grupos: el gasto\n' +
        '    seguía vivo y emitiendo previsiones, pero no había fila donde verlo,\n' +
        '    editarlo ni borrarlo. Con el arreglo cae en «Sin clasificar».');

    if (c.categoria && c.ambito === 'personal' && String(c.categoria).startsWith('inmueble.')) {
      L.push('');
      L.push('  ⚠ La categoría es de INMUEBLE pero el ámbito es PERSONAL · el gasto');
      L.push('    se creó desde la pestaña de un inmueble y se mandó a personal.');
    }

    L.push('');
    L.push('  registro completo:');
    L.push('  ' + JSON.stringify(c));
  }

  db.close();
  const txt = L.join('\n');
  console.log(txt);
  if (typeof copy === 'function') {
    copy(txt);
    console.log('%c✓ Copiado al portapapeles', 'color:#16a34a;font-weight:bold');
  }
  return txt;
})();
