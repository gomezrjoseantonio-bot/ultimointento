// ============================================================================
// ¿Dónde vive este apunte y por qué está duplicado? · SNIPPET DE CONSOLA
// ============================================================================
//
// NO es un script de node: se pega tal cual en la consola del navegador, con la
// aplicación abierta. Hace lo mismo que `src/services/__buscarApunteAudit.ts`
// pero SIN depender del código de la app, porque el diagnóstico hace falta en
// el navegador de producción — que es donde están los datos— y ahí sólo corre
// lo que ya esté desplegado.
//
// Abre IndexedDB SIN número de versión a propósito: pedir una versión concreta
// dispararía una migración, y una herramienta de diagnóstico no puede cambiar
// aquello que viene a medir.
//
// SÓLO LEE. No borra ni modifica nada.
// ============================================================================

(async () => {
  const TERMINO = 'seguro';   // <-- cambia esto si quieres ('vida', 'ing', ...)

  const norm = s => (s ?? '').toString().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const hit = (t, ...xs) => xs.some(x => norm(x).includes(norm(t)));
  const cts = n => Math.round(Math.abs(Number(n) || 0) * 100);
  const eur = n => n == null ? '—' : new Intl.NumberFormat('es-ES',
    { style: 'currency', currency: 'EUR' }).format(n);

  // Sin versión: abre la que haya y NO dispara ninguna migración.
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('AtlasHorizonDB');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

  const all = name => new Promise(res => {
    if (!db.objectStoreNames.contains(name)) return res([]);
    const r = db.transaction(name, 'readonly').objectStore(name).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => res([]);
  });

  const [gastos, eventos, movs, gastosInm] = await Promise.all([
    all('compromisosRecurrentes'), all('treasuryEvents'),
    all('movements'), all('gastosInmueble'),
  ]);

  const impMes = c => {
    const i = c.importe; if (!i) return null;
    if (i.modo === 'fijo') return i.importe ?? null;
    if (i.modo === 'variable') return i.importeMedio ?? null;
    if (i.modo === 'porTramos') return i.tramos?.length ? i.tramos[i.tramos.length - 1].importe : null;
    return null;
  };

  const L = [];
  L.push(`Buscando «${TERMINO}»  ·  ${gastos.length} gastos · ${eventos.length} eventos · ${movs.length} movimientos`);

  // ── 1 · DÓNDE ESTÁ ────────────────────────────────────────────────────
  L.push('\n1 · DÓNDE ESTÁ');
  let n = 0;
  for (const c of gastos) {
    if (!hit(TERMINO, c.alias, c.proveedor?.nombre, c.conceptoBancario, c.subtipo)) continue;
    n++;
    const grupo = c.estado === 'preparado' ? ' › «Preparados»'
      : c.estado === 'baja' ? ' › «Dados de baja»' : '';
    const pant = c.ambito === 'inmueble'
      ? (c.inmuebleId == null ? 'NINGUNA (ambito=inmueble SIN inmuebleId)'
        : `Inmuebles › inmueble ${c.inmuebleId} › Gastos${grupo}`)
      : `Personal › Gastos${grupo}`;
    L.push(`  [gasto #${c.id}] ${c.alias} · ${eur(impMes(c))}/mes · ${c.estado} · cuenta ${c.cuentaCargo}`);
    L.push(`      ámbito=${c.ambito}${c.inmuebleId ? ` inmueble=${c.inmuebleId}` : ''} · método=${c.metodoPago}${c.tarjetaId ? ` tarjeta=${c.tarjetaId}` : ''}`);
    L.push(`      concepto banco: "${c.conceptoBancario ?? ''}"`);
    L.push(`      se ve en: ${pant}`);
  }
  for (const e of eventos) {
    if (!hit(TERMINO, e.description, e.proveedor, e.providerName, e.counterparty, e.categoryLabel)) continue;
    n++;
    const pant = e.descartado ? 'NINGUNA (descartado)'
      : e.sourceType === 'tarjeta_recibo' ? 'Tesorería › «Recibo tarjeta …» (agregado)'
      : 'Tesorería › Previsiones/Movimientos';
    L.push(`  [evento #${e.id}] ${e.description} · ${eur(e.amount)} · ${e.predictedDate} · ${e.status}`);
    L.push(`      origen ${e.sourceType}:${e.sourceId} · cuenta ${e.accountId} · se ve en: ${pant}`);
  }
  for (const m of movs) {
    if (!hit(TERMINO, m.description, m.counterparty, m.providerName)) continue;
    n++;
    L.push(`  [movimiento #${m.id}] ${m.description} · ${eur(m.amount)} · ${m.date} · cuenta ${m.accountId}`);
  }
  for (const g of gastosInm) {
    if (!hit(TERMINO, g.concepto, g.proveedorNombre, g.categoryKey, g.subtypeKey)) continue;
    n++;
    L.push(`  [gastoInmueble #${g.id}] ${g.concepto} · ${eur(g.importe)} · ${g.fecha} · inmueble ${g.inmuebleId}`);
  }
  if (!n) L.push('  Nada con ese texto. Prueba con menos letras.');

  // ── 2 · DADO DE ALTA DOS VECES (el punto ciego) ───────────────────────
  const prev = new Map();
  for (const e of eventos) {
    if (e.sourceType !== 'gasto_recurrente' && e.sourceType !== 'opex_rule') continue;
    if (e.descartado) continue;
    const s = Number(e.sourceId); if (!Number.isFinite(s)) continue;
    prev.set(s, (prev.get(s) || 0) + 1);
  }
  const porClave = new Map();
  for (const c of gastos) {
    if (c.id == null || c.estado === 'baja') continue;
    const i = impMes(c);
    const k = [norm(c.alias), i != null ? cts(i) : 'sin-importe', c.patron?.tipo ?? 'sin-patron'].join('|');
    (porClave.get(k) || porClave.set(k, []).get(k)).push(c);
  }
  L.push('\n2 · DADO DE ALTA DOS VECES');
  let d = 0;
  for (const filas of porClave.values()) {
    if (filas.length < 2) continue;
    if (!filas.some(f => hit(TERMINO, f.alias, f.proveedor?.nombre))) continue;
    d++;
    L.push(`  «${filas[0].alias}» · ${eur(impMes(filas[0]))}/mes · ${filas.length} altas`);
    for (const f of filas) {
      L.push(`      #${f.id} · ámbito=${f.ambito}${f.inmuebleId ? `/${f.inmuebleId}` : ''} · ${f.estado} · cuenta ${f.cuentaCargo} · concepto "${f.conceptoBancario ?? ''}" · ${prev.get(f.id) || 0} previsiones vivas`);
    }
  }
  if (!d) L.push('  No hay dos gastos que sean el mismo.');

  // ── 3 · MISMO CARGO POR DOS MOTORES ───────────────────────────────────
  const porCargo = new Map();
  for (const e of eventos) {
    if (e.descartado || e.type !== 'expense') continue;
    const p = (e.predictedDate || '').slice(0, 7); if (!p) continue;
    const k = `${p}|${e.accountId ?? 'x'}|${cts(e.amount)}`;
    (porCargo.get(k) || porCargo.set(k, []).get(k)).push(e);
  }
  L.push('\n3 · MISMO CARGO POR DOS MOTORES DISTINTOS');
  let x = 0;
  for (const [k, g] of porCargo) {
    if (g.length < 2) continue;
    if (new Set(g.map(e => `${e.sourceType}|${e.sourceId}`)).size < 2) continue;
    if (!g.some(e => hit(TERMINO, e.description, e.providerName, e.counterparty))) continue;
    x++;
    const [p, cu] = k.split('|');
    L.push(`  ${p} · cuenta ${cu} · ${eur(Math.abs(g[0].amount))}`);
    for (const e of g) L.push(`      #${e.id} ${e.sourceType}:${e.sourceId} · ${e.status} · ${e.description}`);
  }
  if (!x) L.push('  Ninguno.');

  // ── 4 · EVENTOS SIN GASTO QUE LOS EXPLIQUE ────────────────────────────
  const vivos = new Set(gastos.map(c => Number(c.id)));
  L.push('\n4 · EVENTOS SIN GASTO QUE LOS EXPLIQUE');
  let h = 0;
  for (const e of eventos) {
    if (e.sourceType !== 'gasto_recurrente' && e.sourceType !== 'opex_rule') continue;
    const s = Number(e.sourceId);
    if (!Number.isFinite(s) || vivos.has(s)) continue;
    if (!hit(TERMINO, e.description, e.providerName, e.counterparty)) continue;
    h++;
    L.push(`  #${e.id} ${e.predictedDate} · ${eur(e.amount)} · ${e.status} · ${e.description} (gasto ${s} ya no existe)`);
  }
  if (!h) L.push('  Ninguno.');

  db.close();
  console.log(L.join('\n'));
})();
