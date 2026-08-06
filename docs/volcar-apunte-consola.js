// ============================================================================
// VOLCAR UN APUNTE EN CRUDO · snippet de consola · SÓLO LEE
// ============================================================================
//
// Para cuando en Tesorería ves una línea y no hay ficha detrás: el gasto se
// borró, o nunca existió, o el enlace apunta a un sitio que ya no está. La
// búsqueda por texto no sirve aquí porque el nombre que se ve en pantalla
// («Vida») puede no ser el que se guardó, así que este busca por IMPORTE y
// FECHA, que es lo que uno tiene delante.
//
// Enseña el registro ENTERO, sin recortar. Es lo único que contesta «¿de dónde
// sale esto?»: el `sourceType` dice qué motor lo emitió y el `sourceId` a qué
// ficha apuntaba. Con esos dos datos ya se sabe qué pantalla debería mostrarlo
// y por qué no lo hace.
//
// Se pega tal cual en la consola del navegador, con la aplicación abierta.
// ============================================================================

(async () => {
  // Lo que ves en pantalla. Deja IMPORTE y pon FECHA a null para buscar sólo
  // por importe en cualquier mes.
  const IMPORTE = 39.86;
  const FECHA = null;        // p.ej. '2026-08-15' · null = cualquier fecha

  const cts = n => Math.round(Math.abs(Number(n) || 0) * 100);
  const objetivo = cts(IMPORTE);

  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('AtlasHorizonDB');   // sin versión · no migra
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const all = name => new Promise(res => {
    if (!db.objectStoreNames.contains(name)) return res([]);
    const r = db.transaction(name, 'readonly').objectStore(name).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });

  const [eventos, gastos, cuentas] = await Promise.all([
    all('treasuryEvents'), all('compromisosRecurrentes'), all('accounts'),
  ]);

  const encontrados = eventos.filter(e =>
    cts(e.amount) === objetivo && (!FECHA || (e.predictedDate || '').startsWith(FECHA))
  );

  const L = [`Eventos de ${IMPORTE} €${FECHA ? ` en ${FECHA}` : ''}: ${encontrados.length}`, ''];

  for (const e of encontrados) {
    const sid = Number(e.sourceId);
    const gasto = gastos.find(g => Number(g.id) === sid);
    const cuenta = cuentas.find(c => Number(c.id) === Number(e.accountId));

    L.push(`── evento #${e.id} · ${e.predictedDate} · ${e.amount} € · ${e.status}`);
    L.push(`   descripción : ${e.description}`);
    L.push(`   origen      : ${e.sourceType} : ${JSON.stringify(e.sourceId)}  (tipo ${typeof e.sourceId})`);
    L.push(`   cuenta      : ${e.accountId} ${cuenta ? `(${cuenta.name || cuenta.alias || cuenta.bank || ''})` : '· NO EXISTE esa cuenta'}`);
    L.push(`   gasto detrás: ${gasto ? `#${gasto.id} «${gasto.alias}» · ${gasto.estado} · ámbito ${gasto.ambito}` : '✗ NINGUNO · no hay ficha que lo explique'}`);

    // El tipo del `sourceId` decide si el borrado puede alcanzarlo:
    // `borrarEventosFuturosCompromiso` busca con `IDBKeyRange.only(número)` y
    // las claves de IndexedDB son estrictas de tipo.
    if (typeof e.sourceId === 'string') {
      L.push('   ⚠ sourceId es TEXTO · el borrado busca por número y nunca lo encuentra');
    }
    if (e.descartado) L.push('   · descartado (no debería pintarse)');
    if (e.executedMovementId != null) L.push(`   · conciliado con el movimiento ${e.executedMovementId}`);
    L.push('   registro completo:');
    L.push('   ' + JSON.stringify(e));
    L.push('');
  }

  if (!encontrados.length) {
    L.push('Nada con ese importe. Prueba a quitar FECHA, o mira si el importe');
    L.push('que ves en pantalla es una SUMA de varias líneas del mismo día.');
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
