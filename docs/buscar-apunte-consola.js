// ============================================================================
// ¿Dónde vive este apunte y por qué está duplicado? · SNIPPET DE CONSOLA
// ============================================================================
//
// NO es un script de node: se pega tal cual en la consola del navegador, con la
// aplicación abierta. Vive en `docs/` y no en `scripts/` justamente por eso —
// `scripts/` lo barre el detector de código muerto, que exige que todo fichero
// de ahí sea alcanzable desde una raíz (un `npm run`), y esto no se ejecuta
// nunca desde node. Hace lo mismo que `src/services/__buscarApunteAudit.ts`
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

  // ── 5 · LÍNEAS FISCALES MATERIALIZADAS DE MÁS ─────────────────────────
  // `computeFiscalSummary` no sólo lee: ESCRIBE una línea por mes del
  // ejercicio que se le pregunte. La proyección pide ~20 años, así que el
  // store se llena de ejercicios que aún no existen. No se ven en ninguna
  // pantalla porque lo fiscal se mira un año cada vez.
  const fechaImposible = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return false;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3];
  };
  const limite = new Date().getFullYear() + 1;
  const firma = g => `${g.inmuebleId}|${g.ejercicio}|${norm(g.concepto)}|${cts(g.importe)}`;
  const cuentaFirma = new Map();
  for (const g of gastosInm) cuentaFirma.set(firma(g), (cuentaFirma.get(firma(g)) || 0) + 1);

  const porEj = new Map();
  let fImp = 0, ejFut = 0, dupEx = 0, ejMax = null;
  const muestra = [];
  for (const g of gastosInm) {
    porEj.set(g.ejercicio, (porEj.get(g.ejercicio) || 0) + 1);
    if (ejMax == null || g.ejercicio > ejMax) ejMax = g.ejercicio;
    const a = [];
    if (fechaImposible(g.fecha)) { a.push('fecha_imposible'); fImp++; }
    if (g.ejercicio > limite) { a.push('ejercicio_futuro'); ejFut++; }
    if ((cuentaFirma.get(firma(g)) || 0) > 1) { a.push('duplicado_exacto'); dupEx++; }
    if (a.length && muestra.length < 15) {
      muestra.push(`  #${g.id} ${g.fecha} · ${eur(g.importe)} · inmueble ${g.inmuebleId} · ${g.concepto} · [${a.join(', ')}]`);
    }
  }
  L.push(`\n5 · LÍNEAS FISCALES · ${gastosInm.length} en total · hasta el ejercicio ${ejMax ?? '—'}`);
  L.push(`  fechas imposibles: ${fImp}`);
  L.push(`  ejercicios futuros (materializados por la proyección): ${ejFut}`);
  L.push(`  duplicados exactos: ${dupEx}`);
  L.push(`  por ejercicio: ${[...porEj.entries()].sort((a, b) => a[0] - b[0]).map(([e, n2]) => `${e}:${n2}`).join('  ')}`);
  L.push(...muestra);

  db.close();
  const txt = L.join('\n');
  console.log(txt);

  // `copy()` es una ayuda de DevTools, no del lenguaje: existe cuando esto se
  // pega en la consola y NO existe si el fichero se carga como script. Por eso
  // va comprobado y envuelto — que falte no puede tumbar el informe, que ya
  // está impreso arriba.
  if (typeof copy === 'function') {
    copy(txt);
    console.log('%c✓ Informe copiado al portapapeles · pégalo tal cual', 'color:#16a34a;font-weight:bold');
  }

  // Se devuelve además del log: así el texto queda en [[PromiseResult]] y se
  // puede recuperar aunque la consola esté llena de ruido.
  return txt;
})();
