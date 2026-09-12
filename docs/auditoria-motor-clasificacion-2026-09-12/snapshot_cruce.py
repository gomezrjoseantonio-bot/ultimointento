# -*- coding: utf-8 -*-
"""
CAPA STORES · cruce de la clasificación con el volcado real de la base de Jose
(docs/audit-inputs/atlas-snapshot-20260426-10.json · 26 abr 2026 · 59 stores).
Para cada movimiento ya clasificado añade:
  store_cuenta     · la cuenta del fichero en `accounts` (id · alias · IBAN) o «NO ESTÁ»
  store_inmueble   · el inmueble de `properties` (id · alias) al que se ata
  store_prestamo   · el préstamo de `prestamos` (nombre · principal · cuota del cuadro · diferencia con el banco)
  store_inversion  · la posición de `inversiones`
  store_resuelve   · qué pendiente cierra el store
  store_falta      · por qué el store NO lo cierra (qué dato le falta al store)
"""
import json, re

SNAP = '/home/user/ultimointento/docs/audit-inputs/atlas-snapshot-20260426-10.json'
S = json.load(open(SNAP))['stores']

ACC = {a['id']: a for a in S['accounts']}
PROP = {p['id']: p for p in S['properties']}
CUOTAS = {}  # prestamoId -> cuota del cuadro (keyval planPagos)
for kv in S['keyval']:
    if isinstance(kv, dict) and 'prestamoId' in kv and kv.get('periodos'):
        per = [p for p in kv['periodos'] if p.get('cuota')]
        if per: CUOTAS[kv['prestamoId']] = round(per[min(5, len(per) - 1)]['cuota'], 2)
PREST = []
for p in S['prestamos']:
    PREST.append(dict(id=p['id'], nombre=p['nombre'], principal=p['principalInicial'], cuenta=int(p.get('cuentaCargoId') or 0),
                      cuota=CUOTAS.get(p['id']), inmuebleId=(p.get('garantias') or [{}])[0].get('inmuebleId'), numeroContrato=p.get('numeroContrato')))
INV = {i['nombre']: i for i in S['inversiones']}

# cuentas de los ficheros → store
CUENTA_FICHERO = {
    'SANTANDER_PDF': None,   # ES54 0049 0052 6221 1043 8676 · NO está en accounts (la del store es ES61 …2715)
    'UNICAJA_PDF': 4, 'SABADELL_XLS': 5, 'ING_XLS': 2, 'BBVA_XLSX': 3,
}
# inmueble deducido del texto → id de properties
INM_TXT2ID = [
    (r'Fuertes Acevedo', [1]), (r'Tenderina 64, 4ºD', [4]), (r'Tenderina 64, 4ºI', [5]), (r'Tenderina 48', [3]),
    (r'Manresa', [6, 8]), (r'Sant Fruit', [2]), (r'Oviedo \(arras', [3]),
    (r'mandato …0900|mandato …1000|mandato …1100', [4, 5, 7]),
]
def alias(pid): return f"#{pid} {PROP[pid]['alias']}" if pid in PROP else f'#{pid}'

def prestamo_por_cuota(importe, cuenta_id):
    a = abs(importe); best = None
    for p in PREST:
        if p['cuota'] is None: continue
        d = abs(p['cuota'] - a)
        if d <= 0.6 and (best is None or d < best[1]): best = (p, d)
    return best

def enriquecer(r, c):
    """r = fila del movimiento · c = su clasificación (dict) · muta c."""
    f = r['fichero']; T = r['T']; a = r['importe']
    out = dict(store_cuenta='', store_inmueble='', store_prestamo='', store_inversion='', store_resuelve='', store_falta='')
    # ── cuenta
    cid = CUENTA_FICHERO.get(f)
    if cid: out['store_cuenta'] = f"#{cid} {ACC[cid]['alias']} {ACC[cid]['iban']}"
    elif f == 'SANTANDER_PDF': out['store_cuenta'] = 'NO ESTÁ en accounts (el store tiene Santander ES61 0049 0052 6322 1041 2715, otra cuenta)'
    # ── inmueble por el texto
    inm = c.get('inmueble') or ''
    ids = next((v for pat, v in INM_TXT2ID if re.search(pat, inm)), None)
    if ids:
        out['store_inmueble'] = ' | '.join(alias(i) for i in ids)
        if len(ids) == 1:
            out['store_resuelve'] = 'STORE:inmuebles · el piso del texto existe en properties'
        else:
            out['store_falta'] = f'properties tiene {len(ids)} unidades candidatas y ningún mandato/CUPS que diga cuál es · {" · ".join(alias(i) for i in ids)}'
    # ── préstamo por cuota (+ cuenta)
    if c.get('familia') == 'prestamo_hipoteca' or c.get('familia') == 'disposicion_prestamo':
        cancel = re.search(r'CANCELAC|SOBRANTE', T)
        if 'CETELEM' in T:
            out['store_falta'] = 'prestamos NO tiene el préstamo Cetelem (contrato 40070968660905) · no existe en el store'
        elif 'BANKINTER CONSUMER' in T:
            p = next(x for x in PREST if x['nombre'] == 'Bankintercard')
            out['store_prestamo'] = f"{p['nombre']} · {p['principal']} € · cuota cuadro {p['cuota']} vs banco {abs(a):.2f}"
            out['store_resuelve'] = 'STORE:prestamos · «Bankintercard» 30.000 · cuota 351,43 exacta' if not cancel else 'STORE:prestamos · cancelación del «Bankintercard» (15.000 + 9.750)'
            out['store_falta'] = 'prestamos no guarda nº de contrato (H3498890) · casa solo por importe'
        elif '0004821' in T or 'OPERACIONES DE PRESTAMOS' in T:
            p = next(x for x in PREST if 'Manresa' in x['nombre'])
            out['store_prestamo'] = f"{p['nombre']} · {p['principal']} € · cuenta cargo #{p['cuenta']} (Santander …2715)"
            out['store_inmueble'] = alias(6); out['store_resuelve'] = 'STORE:prestamos · hipoteca de Manresa (73.800) cancelada con la venta'
            out['store_falta'] = 'prestamos no guarda nº de contrato (0004821 103) y su cuenta de cargo es la Santander …2715, no la del PDF'
        elif 'SOBRANTE' in T:
            p = next(x for x in PREST if 'Tenderina 48' in x['nombre'])
            out['store_prestamo'] = f"{p['nombre']} · {p['principal']} €"; out['store_inmueble'] = alias(3)
            out['store_resuelve'] = 'STORE:prestamos · sobrante de la hipoteca de Tenderina 48 (97.300)'
        elif 'DISPOSICI' in T:
            p = next((x for x in PREST if x['nombre'] == 'Prestamo Sabadell' and abs(x['principal'] - abs(a)) < 1), None)
            if p:
                out['store_prestamo'] = f"{p['nombre']} · {p['principal']} €"; out['store_resuelve'] = f'STORE:prestamos · disposición = principal {p["principal"]} exacto'
            out['store_falta'] = 'prestamos no guarda nº de contrato (8078782349 / 8078716546)'
        else:
            b = prestamo_por_cuota(a, cid)
            if b:
                p, d = b
                out['store_prestamo'] = f"{p['nombre']} · {p['principal']} € · cuota cuadro {p['cuota']:.2f} vs banco {abs(a):.2f} (Δ {d:.2f})"
                pid = {'Tenderina 48 1 5 Dr Oviedo': 3, 'Tenderina 64 4 Dr Oviedo': 4, 'Buigas': 2, 'Fuertes Acevedo 32 1 2 Dr Oviedo': 1, 'Sant Joan D En Coll 53 B 3 6 Manresa': 6}.get(p['nombre'])
                if pid: out['store_inmueble'] = alias(pid)
                out['store_resuelve'] = f'STORE:prestamos · casa por cuota (Δ {d:.2f} €) → {p["nombre"]}' + (f' → {alias(pid)}' if pid else ' (personal)')
                if d > 0.005: out['store_falta'] = f'el cuadro del store ({p["cuota"]:.2f}) NO coincide al céntimo con el banco ({abs(a):.2f}) · `cuotasDePrestamo.ts` exige importe exacto → hoy NO casaría · y prestamos no guarda nº de contrato'
                else: out['store_falta'] = 'prestamos no guarda nº de contrato · casa solo por importe+fecha'
            else:
                out['store_falta'] = 'ningún préstamo del store con esa cuota'
    # ── inversiones
    if 'SMARTFLIP' in T or (c.get('regla', '').startswith('X1') and '212128856' in T):
        i = INV['Smartflip']
        out['store_inversion'] = f"inversiones #{i['id']} Smartflip · aportación {i['total_aportado']} € el 30/12/2025 · 10 % anual · retención 19 % → 750 − 142,50 = 607,50/mes"
        out['store_resuelve'] = 'STORE:inversiones · la posición existe · 607,50 = 90.000 × 10 % / 12 × 0,81 EXACTO (corrige mi inferencia de 60.000 al 12,15 %)'
        if a < 0: out['store_falta'] = 'el store dice 90.000 en UNA aportación desde la cuenta #1 (Santander …2715); el banco muestra 4 × 15.000 desde Sabadell · los otros 30.000 salen de una cuenta no aportada'
    if 'ABRDN' in T:
        out['store_falta'] = 'inversiones tiene 2 fondos por NIF (A86436011, A87409728) sin nombre · no se puede saber si abrdn SICAV es uno de ellos'
    # ── comunidad · el IRPF confirma el mandato …1200
    if c.get('familia') == 'comunidad' and '004300001200' in T:
        out['store_inmueble'] = alias(3)
        out['store_resuelve'] = 'STORE:gastosInmueble (IRPF) · comunidad 2024 de Tenderina 48 = 963,12 = 80,26 × 12 EXACTO → el mandato …1200 es Tenderina 48'
        out['store_falta'] = ''
    if c.get('familia') == 'comunidad' and re.search(r'0063000009|0063000010|0063000011', T):
        out['store_falta'] = 'properties tiene 3 unidades en Tenderina 64 (#4 4ºD · #5 4ºI · #7 5º1, accesoria de #4) = los 3 mandatos CCPP, pero sin mandato en el store no se sabe cuál es cuál'
    # ── alquiler / fianza · contratos
    if c.get('familia') in ('alquiler', 'fianza'):
        if not out['store_falta']:
            out['store_falta'] = 'contracts (6, importados del IRPF) tienen inquilino VACÍO y renta = anual/12 (713 · 330 · 1.476 · 597 · 604 · 420) · no sirven para nombre → habitación'
    # ── traspasos · cuentas
    if c.get('familia') == 'traspaso':
        if c.get('regla', '').startswith('T2'):
            out['store_resuelve'] = 'STORE:accounts · el destino probable es la cuenta #1 Santander ES61 0049 0052 6322 1041 2715 (la única Santander del store · no está entre los 9 ficheros)'
        elif c.get('regla', '').startswith('T5'):
            out['store_resuelve'] = 'STORE:accounts · el ordenante es la cuenta #1 Santander …2715 del store'
        elif c.get('regla', '').startswith('T4'):
            out['store_falta'] = 'accounts no tiene ninguna cuenta de ahorro · candidatas no aportadas: #6 Abanca · #7 Bankinter · #8 Revolut'
        elif c.get('subtipo') == 'a_tarjeta':
            out['store_falta'] = 'no hay store `tarjetas` en el snapshot (0 tarjetas) · no se puede atar a una tarjeta propia'
    # ── seguros
    if c.get('familia') == 'seguros_alarmas':
        out['store_falta'] = 'no hay store de pólizas · el IRPF (gastosInmueble) solo da el total anual de «seguro» por piso (2024: FA32 242,79 · Sant Fruitós 393,16 · T48 319,75 · T64 4D 176,04 · T64 4I 100,54 · Manresa 257,91)'
        if 'NATIONALE' in T: out['store_inmueble'] = alias(2); out['store_resuelve'] = 'IRPF · seguro Sant Fruitós 393,16 (2024) ≈ 440 (2026) · misma cuenta que su hipoteca (ING)'
    # ── suministros · IRPF
    if c.get('familia') == 'suministro' and f == 'SABADELL_XLS':
        out['store_falta'] = 'compromisosRecurrentes está VACÍO (0) · el IRPF da el total anual de suministro por piso (2024: FA32 1.930 · T48 1.427 · T64 4D 704 · T64 4I 680) pero no el mandato'
    # ── nómina
    if c.get('familia') == 'nomina':
        out['store_falta'] = 'nominas dice: empleador Orange · 95.178 brutos · 14 pagas → la nómina real no son 600/900 € en ING · esa nómina llega a una cuenta no aportada'
    # ── proveedores IRPF
    if c.get('familia') in ('reparacion_mantenimiento', 'reforma_mejora', 'gestion'):
        out['store_falta'] = (out['store_falta'] + ' · ' if out['store_falta'] else '') + 'proveedores (11 NIF del IRPF, sin nombre) no coincide con ningún acreedor de los extractos'
    c.update(out)
    return c

RESUMEN_STORES = [
    ('accounts', 8, 'Santander ES61…2715 · ING · BBVA · Unicaja · Sabadell · Abanca · Bankinter · Revolut', 'La cuenta Santander del PDF (ES54…8676) NO está. 4 de las 8 cuentas del store no están entre los 9 ficheros (Santander …2715, Abanca, Bankinter, Revolut).'),
    ('properties', 8, '#1 Fuertes Acevedo 32 · #2 Carles Buigas 15 (Sant Fruitós) · #3 Tenderina 48 · #4 Tenderina 64 4ºD · #5 Tenderina 64 4ºI · #6 Sant Joan d\'en Coll 53 (Manresa) · #7 Tenderina 64 5º1 (accesoria de #4) · #8 Vic 178 garaje (accesorio de #6)', 'Los 7 inmuebles que deduje del texto son los 8 del store (el garaje de Manresa iba con la venta: «58797 y 58891 RP Manresa» = 2 fincas). Pero `state` sigue «activo» en #3 (vendido nov-25), #6 y #8 (vendidos mar-26): el store no se actualizó.'),
    ('prestamos', 13, 'FA32 52.500 · T48 97.300 · Manresa 73.800 · Santander personal 17.675 y 50.000 · T64 4D 85.000 · Buigas 97.500 · Sabadell 24.500 y 16.500 · BBVA 26.000 · Bankintercard 30.000 · ING 47.000 · EVO 20.000', 'NINGUNO tiene nº de contrato → el paso «identificador» de la app no puede casar por nº. Casan por cuota: 3 exactas (Sabadell 204,91 · BBVA 285,40 · BCF 351,43), 4 con diferencia de céntimos (T48 407,69 vs 407,49 · T64 4D 454,57 vs 454,66 · Buigas 329,52 vs 329,97 · Sabadell 304,25 vs 304,26) que `cuotasDePrestamo.ts` rechaza. Cetelem no existe. 5 préstamos se cargan en cuentas no aportadas. La garantía del préstamo «Tenderina 64 4 Dr» apunta al inmueble #3 (Tenderina 48): dato erróneo.'),
    ('contracts', 6, '1 por inmueble, importados del IRPF', 'Inquilino VACÍO en los 6 · renta = anual/12 · sin habitación. No permiten «nombre del ordenante → habitación». El casador `rentas.ts` (nombre + renta vigente) no casaría nada.'),
    ('inversiones', 12, 'Smartflip 90.000 (10 %, ret. 19 %) · Unihouser · 2 fondos por NIF · crypto · planes de pensiones (Orange, SP500)', 'Smartflip resuelve EXACTO los 607,50/mes (750 − 19 %). Corrige mi lectura desde el fichero (60.000 al 12,15 %): 30.000 salieron de una cuenta no aportada. abrdn SICAV no identificable.'),
    ('proveedores', 11, 'NIF del IRPF (reparación · mejora · gestión) · sin nombre', 'Cero coincidencias con los acreedores de los extractos (Iberdrola, Wekiwi, Visalia, Gana, Simyo…). Son contratistas de obras, no proveedores recurrentes.'),
    ('gastosInmueble (IRPF 2022-2024)', 109, 'totales anuales por piso y tipo (comunidad · suministro · seguro · IBI · intereses · gestión)', 'Sirven para CONFIRMAR: comunidad T48 2024 = 963,12 = 80,26 × 12 → el mandato …1200 es Tenderina 48. Para el resto solo dan el orden de magnitud por piso.'),
    ('compromisosRecurrentes · movementLearningRules · tarjetas · movements', 0, '—', 'Vacíos. En abril de 2026 la app no tenía ni un movimiento bancario importado, ni un recurrente, ni una regla aprendida. El motor de la app, con este store, sigue clasificando por reglas duras.'),
    ('nominas', 1, 'Orange · 95.178 brutos · 14 pagas · seguro de vida 14,08/mes', 'La nómina real no está en ninguno de los 9 ficheros. ING «Nomina recibida» 600/900 no es la nómina de Orange.'),
]
