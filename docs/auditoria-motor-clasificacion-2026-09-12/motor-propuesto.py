# -*- coding: utf-8 -*-
"""
MOTOR DE CLASIFICACIÓN PROPUESTO (auditoría · 12 sep 2026)
Clasifica los 9 ficheros reales con reglas en CAPAS, de lo más universal a lo más dependiente del cliente.
Cada línea sale con: ejes (naturaleza · familia · subtipo · método · ámbito · inmueble · sentido),
la REGLA que la decidió, la FUENTE (qué hizo falta para decidirla), la CONFIANZA, el ESTADO y lo PENDIENTE.

FUENTES (lo que pide Jose: qué se resolvió solo con el fichero y qué hubo que ir a buscar fuera):
  FICHERO            · solo con lo que trae el fichero (palabras del banco, signo, nombre del titular, el texto libre)
  CRUCE_CUENTAS      · cruzando los 9 ficheros entre sí (una salida de una cuenta = una entrada en otra)
  RECURRENCIA        · la misma contraparte + importe repitiéndose mes a mes dentro del propio fichero
  IDENTIFICADOR      · un nº de préstamo / tarjeta / mandato SEPA / NIF que trae el fichero. La familia sale del fichero;
                       «cuál de mis préstamos / pisos» necesita el STORE que se indica
  CATALOGO_NACIONAL  · hizo falta saber QUÉ ES la entidad (NIF/nombre → proveedor → familia). Hoy no existe en la app; lo aporté yo
  EXTERNO            · hizo falta conocimiento de fuera del fichero y de fuera de un catálogo (qué es Smartflip, qué es una plusvalía,
                       que Sant Joan d'en Coll está en Manresa…)
  USUARIO            · solo el usuario puede decirlo · NO CLASIFICABLE con lo que hay
"""
import csv, re, collections, datetime, unicodedata, json

def norm(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s.upper()).strip()

def d(s): return datetime.datetime.strptime(s, '%d/%m/%Y').date()

TITULAR = ['GOMEZ RAMIREZ JOSE ANTONIO', 'JOSE ANTONIO GOMEZ RAMIREZ', 'JOSE ANTONIO GOMEZ RA', 'JOSE ANTONIO GOM', 'JOSE ANTONIO GOMEZ',
           'JOS ANTONIO G MEZ RAM REZ', 'JOSE ANTONIO']

def es_titular(t):
    t = norm(t)
    return any(n in t for n in TITULAR)

# ──────────────────────────────────────────────────────────────────────────────
# CATÁLOGO NACIONAL (la pieza que NO existe en la app · E2.6) · lo que yo tuve que saber
# clave: patrón sobre el texto normalizado o NIF · valor: qué es, familia, subtipo, ámbito sugerido, y de dónde lo sé
# ──────────────────────────────────────────────────────────────────────────────
CATALOGO = [
    # NIF (Sabadell Referencia 1) → proveedor
    dict(nif='A95554630', nombre='Iberdrola Comercialización de Último Recurso', familia='suministro', subtipo='luz', ambito='inmueble',
         nota='NIF real en Referencia 1 · el texto dice "IBERDROLA GAS 10x" · CUR = tarifa regulada · confirmar luz/gas con la factura'),
    dict(nif='B67686782', nombre='Wekiwi SL', familia='suministro', subtipo='luz', ambito='inmueble', nota='comercializadora de luz · 6 mandatos = 6 puntos de suministro'),
    dict(nif='B99340564', nombre='Doméstica Energía (Visalia)', familia='suministro', subtipo='gas', ambito='inmueble', nota='comercializadora de gas · 6 mandatos'),
    dict(nif='B98717457', nombre='Gana Energía', familia='suministro', subtipo=None, ambito='inmueble', nota='vende luz y gas · el subtipo lo dice el texto (LUZ/GAS)'),
    dict(nif='A65067332', nombre='Comercializadora Regulada Gas & Power', familia='suministro', subtipo='gas', ambito='inmueble', nota='TUR gas (Naturgy regulada)'),
    dict(nif='000000000ZZZ', nombre='PayPal Europe', familia='compra_online', subtipo=None, ambito='personal', nota='PayPal no da NIF español · el comercio real está en el extracto de PayPal'),
    # Nombre → proveedor
    dict(pat=r'\bSIMYO\b', nombre='Simyo', familia='suministro', subtipo='telefonia', ambito='personal', nota='OMV móvil'),
    dict(pat=r'\bDIGI SPAIN', nombre='Digi Spain Telecom', familia='suministro', subtipo='internet', ambito='inmueble', nota='fibra/móvil · en pisos por habitaciones suele ser el wifi del piso'),
    dict(pat=r'\bORANGE\b', nombre='Orange Espagne', familia='suministro', subtipo='telefonia', ambito='personal', nota='telefonía'),
    dict(pat=r'FCC AQUALI', nombre='FCC Aqualia (agua Oviedo)', familia='suministro', subtipo='agua', ambito='inmueble', nota='concesionaria del agua de Oviedo · dos recibos cada vez = dos contratos'),
    dict(pat=r'CANAL ISABEL', nombre='Canal de Isabel II (agua Madrid)', familia='suministro', subtipo='agua', ambito='inmueble', nota='agua de la Comunidad de Madrid · implica un inmueble en Madrid'),
    dict(pat=r'CURENERG', nombre='Curenergía (Iberdrola CUR)', familia='suministro', subtipo='luz', ambito='inmueble', nota='comercializador de último recurso'),
    dict(pat=r'BIP\s+DRIVE', nombre='Bip&Drive', familia='transporte', subtipo='peajes', ambito='personal', nota='telepeaje Via-T · también parkings'),
    dict(pat=r'GC RE TUIO|\bTUIO\b', nombre='Tuio (seguro hogar)', familia='seguros_alarmas', subtipo='hogar', ambito='inmueble', nota='insurtech de seguro de hogar · 5,95 €/mes'),
    dict(pat=r'BANKINTER CONSUMER', nombre='Bankinter Consumer Finance', familia='prestamo_hipoteca', subtipo=None, ambito='personal', nota='financiera de consumo'),
    dict(pat=r'\bCETELEM\b', nombre='Banco Cetelem', familia='prestamo_hipoteca', subtipo=None, ambito='personal', nota='financiera de consumo'),
    dict(pat=r'\bCASER\b', nombre='Caser Seguros', familia='seguros_alarmas', subtipo=None, ambito='inmueble', nota='aseguradora · el abono es un extorno/indemnización'),
    dict(pat=r'NATIONALE NEDERLANDEN', nombre='Nationale-Nederlanden Generales', familia='seguros_alarmas', subtipo=None, ambito='personal', nota='aseguradora · generales = hogar/auto · 440 €/año'),
    dict(pat=r'PLAN UNI SEGUR', nombre='Unicaja · Plan Uni Seguro', familia='seguros_alarmas', subtipo=None, ambito='inmueble', nota='seguro vinculado a Unicaja · dos primas (37,24 y 21,97) = dos pólizas · la de 21,97 desaparece en sep-2025'),
    dict(pat=r'APPLE\.?COM', nombre='Apple', familia='suscripciones', subtipo='cloud', ambito='personal', nota='0,99 = iCloud · 34,99 = servicio Apple'),
    dict(pat=r'\bPAYPAL\b', nombre='PayPal Europe', familia='compra_online', subtipo=None, ambito='personal', nota='comercio opaco'),
    dict(pat=r'\bREVOLUT\b', nombre='Revolut', familia='traspaso', subtipo='a_tarjeta', ambito='personal', nota='recarga de tarjeta propia (regla 6 de la app)'),
    dict(pat=r'FEEBBO|MEDUX', nombre='Feebbo Solutions (panel Medux)', familia='otros_ingresos', subtipo=None, ambito='personal', nota='panel de estudios de mercado · paga 10 €/mes al panelista'),
    dict(pat=r'SMARTFLIP', nombre='Smartflip Developments Investments (Smart Yield)', familia='inversion', subtipo='prestamo_p2p', ambito='personal', nota='plataforma de préstamos a promotores · producto Smart Yield'),
    dict(pat=r'ABRDN SICAV', nombre='abrdn SICAV I – Japanese equity', familia='aportacion', subtipo='fondo', ambito='personal', nota='suscripción de fondo de inversión'),
    dict(pat=r'MOVILIDAD MMD', nombre='Movilidad MMD (Madrid)', familia='transporte', subtipo='otros', ambito='personal', nota='micro-cargos 0,14/0,50 · movilidad compartida'),
    dict(pat=r'MINOAUTOS', nombre='Minoautos Multimarca SL (concesionario)', familia='transporte', subtipo='otros', ambito='personal', nota='compra de vehículo · "resto Ibiza 8055LXT"'),
    dict(pat=r'MOTORES Y RECTIFICADOS', nombre='Motores y Rectificados Valencia SL (taller)', familia='reparacion_mantenimiento', subtipo='vehiculo', ambito='personal', nota='rectificado de motores = taller mecánico'),
    dict(pat=r'OVETUS ABOGADOS', nombre='Ovetus Abogados & Consultores', familia='gestion', subtipo='abogado', ambito='inmueble', nota='despacho de Oviedo · conciliación judicial'),
    dict(pat=r'FINQUES CANDAL|FINCAS CANDAL', nombre='Gestió i Administració de Finques Candal (Manresa)', familia='gestion', subtipo='otros', ambito='inmueble', nota='administrador de fincas / agencia · Manresa'),
    dict(pat=r'4A AVENIDA', nombre='4A Avenida Servicios Inmobiliarios', familia='gestion', subtipo='otros', ambito='inmueble', nota='agencia inmobiliaria'),
    dict(pat=r'ALISSER REAL ESTATE', nombre='Alisser Real Estate SL', familia='alquiler', subtipo=None, ambito='inmueble', nota='operador que alquila pisos enteros a Jose (Tenderina 48 hasta oct-25 · Fuertes Acevedo 32 desde abr-26)'),
    dict(pat=r'UNICAJA TRAMITACIONES', nombre='Unicaja Tramitaciones SA (gestoría)', familia='gestion', subtipo='gestoria', ambito='inmueble', nota='gestoría de Unicaja · provisión de fondos y su devolución'),
    dict(pat=r'AJUNTAMENT|AYUNTAMIEN|AJ\. SANT FRUITOS', nombre='Ayuntamiento', familia='impuestos_tasas', subtipo='otros_tributos', ambito='inmueble', nota='tributo municipal (IBI/basura/plusvalía) · el subtipo exacto lo dice el recibo'),
]

# ──────────────────────────────────────────────────────────────────────────────
# INMUEBLES que se deducen del TEXTO de los ficheros (sin store) · para atribuir
# ──────────────────────────────────────────────────────────────────────────────
INMUEBLES_TXT = [
    (r'FUERTES ACEVEDO|ACEVEDO|ACV32|4-ACEVEDO', 'C/ Fuertes Acevedo 32 (Oviedo)'),
    (r'TENDERINA\s*(BAJA)?\s*64.{0,4}4\s*D|T64 4D|TENDERINA,?64 4D', 'C/ Tenderina 64, 4ºD (Oviedo)'),
    (r'TENDERINA\s*64\s*4\s*I|T64 4I', 'C/ Tenderina 64, 4ºI (Oviedo)'),
    (r'TENDERINA 48', 'C/ Tenderina 48 (Oviedo) · vendido nov-2025'),
    (r'MANRESA|PL LA PAU|ST\. JOAN DEN COL|SANT JOAN', 'Pl. La Pau 4 (Manresa) · vendido mar-2026'),
    (r'SANT FRUITOS', 'Sant Fruitós de Bages (Barcelona)'),
    (r'ARRAS NUMERO 17254 DE OVIEDO', 'Inmueble en Oviedo (arras nº 17254) · = Tenderina 48 por fechas'),
]

def inmueble_del_texto(t):
    t = norm(t)
    for pat, nombre in INMUEBLES_TXT:
        if re.search(pat, t): return nombre
    return None

# ──────────────────────────────────────────────────────────────────────────────
def cargar():
    rows = list(csv.DictReader(open('movimientos.csv')))
    for r in rows:
        r['importe'] = float(r['importe']); r['saldo'] = float(r['saldo']); r['dt'] = d(r['fecha'])
        r['T'] = norm(r['concepto']); r['R1'] = norm(r['ref1']); r['R2'] = norm(r['ref2'])
        r['TODO'] = f"{r['T']} | {r['R1']} | {r['R2']}"
    return rows

PRIMARIOS = {'SANTANDER_PDF', 'UNICAJA_PDF', 'SABADELL_XLS', 'ING_XLS', 'BBVA_XLSX'}
DUPLICADO_DE = {'UNICAJA_XLS': 'UNICAJA_PDF', 'UNICAJA_XLS_FULL': 'UNICAJA_PDF', 'UNICAJA_PDF_6': 'UNICAJA_PDF', 'SABADELL_XLS_2': 'SABADELL_XLS'}

# ──────────────────────────────────────────────────────────────────────────────
# CRUCE ENTRE CUENTAS · una salida en una cuenta con una entrada igual en otra (±3 días) = traspaso propio
# ──────────────────────────────────────────────────────────────────────────────
def emparejar(prim):
    byamt = collections.defaultdict(list)
    for r in prim: byamt[round(abs(r['importe']), 2)].append(r)
    usados = set()
    for r in sorted(prim, key=lambda x: x['dt']):
        if r['id'] in usados: continue
        cands = [o for o in byamt[round(abs(r['importe']), 2)] if o is not r and o['fichero'] != r['fichero']
                 and (o['importe'] > 0) != (r['importe'] > 0) and abs((o['dt'] - r['dt']).days) <= 3 and o['id'] not in usados]
        # solo emparejamos si alguno de los dos huele a traspaso (titular, ahorro, traspaso, nómina propia, enviado por)
        def huele(x): return es_titular(x['concepto']) or re.search(r'AHORRO|TRASPASO|ENVIADO POR BANCO|NOMINA', x['T'])
        def veta(x): return re.search(r'EFECTIVO|CAJERO|^CAJ\.|INSTANT MONEY|ADEUDO|RECIBO|CUOTA|PRESTAMO|ALQUIL|RENTA|FIANZA|ARRAS', x['T'])
        if veta(r): continue
        cands = [o for o in cands if (huele(r) or huele(o)) and not veta(o)]
        if cands:
            o = min(cands, key=lambda o: abs((o['dt'] - r['dt']).days))
            r['pareja'] = o; o['pareja'] = r; usados.add(r['id']); usados.add(o['id'])

# ──────────────────────────────────────────────────────────────────────────────
# REGLAS · en orden · la primera que casa decide (después se completan ejes que falten)
# cada regla devuelve dict con ejes + regla + fuente + confianza + motivo (+ pendiente)
# ──────────────────────────────────────────────────────────────────────────────
def R(**k): return k

def clasificar(r):
    T, R1, R2, TODO, a, f = r['T'], r['R1'], r['R2'], r['TODO'], r['importe'], r['fichero']
    sale = a < 0
    inm = inmueble_del_texto(r['concepto'])
    ent = None
    for c in CATALOGO:
        if c.get('nif') and R1.startswith(c['nif']): ent = c; break
        if c.get('pat') and re.search(c['pat'], TODO): ent = c; break

    # ═══ CAPA 1 · TRASPASOS ENTRE CUENTAS PROPIAS (universal: el nombre del titular / la palabra del banco) ═══
    # 1.1 traspaso cruzado con otra de las cuentas aportadas
    if r.get('pareja'):
        p = r['pareja']
        return R(naturaleza='movimiento_interno', familia='traspaso', subtipo='a_otra_cuenta', sentido='sale' if sale else 'entra', metodo='transferencia', ambito='personal',
                 regla='T1 · traspaso cruzado', fuente='CRUCE_CUENTAS', confianza='alta',
                 motivo=f"pareja exacta en {p['banco']} el {p['fecha']} ({p['importe']:+.2f} · «{p['concepto'][:40]}»)")
    # 1.2 el banco lo llama traspaso (Santander «Traspaso:» = entre cuentas del mismo banco · el destino no viene en el PDF)
    if f == 'SANTANDER_PDF' and T.startswith('TRASPASO'):
        return R(naturaleza='movimiento_interno', familia='traspaso', subtipo='a_otra_cuenta', sentido='sale', metodo='transferencia', ambito='personal',
                 regla='T2 · «Traspaso» del propio banco', fuente='FICHERO', confianza='alta',
                 motivo='Santander usa «Traspaso» solo entre cuentas del mismo titular · barre la cuenta a 0 tras cada cobro',
                 pendiente='STORE:cuentas · la cuenta destino NO está entre los 9 ficheros (0 de 61 tienen pareja) · falta esa cuenta Santander')
    # 1.3 la contraparte es el propio titular
    if es_titular(r['concepto']) or es_titular(r['ref1']) or es_titular(r['ref2']):
        if f == 'ING_XLS' and 'RECIBIDA' in T and re.search(r'AHORRO', T):
            sub = 'a_ahorro'
        else:
            sub = 'a_ahorro' if re.search(r'\bAHORRO', T) else 'a_otra_cuenta'
        nota_nomina = ' · el banco lo etiqueta «nómina» pero el ordenante es el propio titular → traspaso, no nómina' if 'NOMINA' in T else ''
        return R(naturaleza='movimiento_interno', familia='traspaso', subtipo=sub, sentido='sale' if sale else 'entra', metodo='transferencia', ambito='personal',
                 regla='T3 · contraparte = titular', fuente='FICHERO', confianza='alta',
                 motivo='el ordenante/beneficiario es el propio titular del fichero' + nota_nomina,
                 pendiente='STORE:cuentas · sin pareja en los 9 ficheros → va a/viene de una cuenta propia no aportada')
    # 1.3b · BBVA «Abono de nómina · Enviado por banco santander» · el ordenante no puso concepto · importes irregulares (1.300–2.500)
    if f == 'BBVA_XLSX' and 'ENVIADO POR BANCO SANTANDER' in T and not sale:
        return R(naturaleza='movimiento_interno', familia='traspaso', subtipo='a_otra_cuenta', sentido='entra', metodo='transferencia', ambito='personal',
                 regla='T5 · desde Santander sin concepto', fuente='FICHERO+CRUCE_CUENTAS', confianza='media',
                 motivo='BBVA lo etiqueta «nómina» por el tipo de orden, pero el ordenante es una cuenta Santander sin concepto e importes irregulares · el mismo patrón («Enviado por Banco Santander») en Santander→Unicaja/BBVA es siempre el propio titular · NO casa con la cuenta Santander aportada → sale de la OTRA cuenta Santander (la que recibe los «Traspaso:»)',
                 pendiente='STORE:cuentas · dar de alta la segunda cuenta Santander · USUARIO confirmar que no es una nómina de un empleador')
    # 1.4 «Ahorro…» escrito por el usuario en una transferencia sin beneficiario (Unicaja oficina 8076 · BBVA)
    if re.search(r'^AHORROS?\b|AHORRO PROGRAMADO|\bAHORROS?( \w+)?$|^AHORRO|RECIBIDA · AHORRO', T) and f in ('UNICAJA_PDF', 'BBVA_XLSX', 'ING_XLS'):
        return R(naturaleza='movimiento_interno', familia='traspaso', subtipo='a_ahorro', sentido='sale' if sale else 'entra', metodo='transferencia', ambito='personal',
                 regla='T4 · «Ahorro» del usuario', fuente='FICHERO', confianza='media',
                 motivo=('transferencia emitida con concepto libre «Ahorro…» · el fichero de Unicaja NO trae el beneficiario' if sale else 'transferencia recibida con concepto «Ahorro…» · solo el propio titular escribe eso · el fichero BBVA no trae el ordenante'),
                 pendiente='STORE:cuentas · confirmar la cuenta de ahorro destino (no está en los 9 ficheros salvo 4 casos que casan con BBVA)')
    # 1.5 ING «Nomina recibida» sin ordenante · en BBVA/Sabadell la misma etiqueta era el propio titular
    if f == 'ING_XLS' and 'NOMINA RECIBIDA' in T:
        return R(naturaleza='ingreso', familia='nomina', metodo='transferencia', ambito='personal',
                 regla='N1 · nómina según el banco', fuente='FICHERO', confianza='baja',
                 motivo='ING lo categoriza «Nómina o Pensión» · no muestra ordenante · sin pareja en las otras cuentas',
                 pendiente='USUARIO · en BBVA y Sabadell «nómina» resultó ser transferencia del propio titular · ING no da el ordenante: ¿nómina real (600/900 €) o traspaso?')

    # ═══ CAPA 2 · EFECTIVO Y TARJETAS PROPIAS (palabras universales del banco) ═══
    if re.search(r'RETIRADA DE EFECTIVO|RET\. EFEC|RET\. EFECTIVO|^CAJ\.|CAJERO|INSTANT MONEY|EFECTIVO MOVIL', T):
        extra = ' · incluye comisión 3 % (retirada fuera de la eurozona)' if 'NO EUR' in T else ''
        return R(naturaleza='movimiento_interno', familia='traspaso', subtipo='a_efectivo', sentido='sale', metodo='efectivo', ambito='personal',
                 regla='E1 · retirada de efectivo', fuente='FICHERO' + ('+EXTERNO' if 'INSTANT' in T else ''), confianza='alta',
                 motivo='retirada en cajero' + (' · «Instant Money» = retirada sin tarjeta con código (Sabadell)' if 'INSTANT' in T else '') + extra)
    if re.search(r'COM\. RET\. EFEC', T):
        return R(naturaleza='gasto', familia='comisiones_bancarias', subtipo='otros', metodo='cargo_abono_banco', ambito='personal',
                 regla='E2 · comisión de cajero', fuente='FICHERO', confianza='alta', motivo='comisión por retirada en cajero ajeno')
    if re.search(r'ADEUDO MENSUAL DE TARJETA|TRASPASO A TARJETA|REC\.MCARD|ENTREGA CUENTA CRED\. TARJ|PAGO EN REVOLUT\*\*', T):
        return R(naturaleza='movimiento_interno', familia='traspaso', subtipo='a_tarjeta', sentido='sale', metodo='domiciliacion' if 'REC.MCARD' in T or 'ADEUDO' in T else 'transferencia', ambito='personal',
                 regla='E3 · liquidación / recarga de tarjeta propia', fuente='FICHERO' + ('+IDENTIFICADOR' if re.search(r'\d{16}|\*\*\d{4}\*', TODO) else ''), confianza='alta',
                 motivo='el cargo es la liquidación (BBVA 4940…6701 · Unicaja REC.MCARD/ENTREGA CUENTA CRED.) o la recarga (Revolut**9527*) de una tarjeta propia · el gasto real está en el extracto de la tarjeta',
                 pendiente='STORE:tarjetas · registrar la tarjeta (4 últimos) para que sea «traspaso a tarjeta» y no gasto · el desglose necesita el extracto de la tarjeta')

    # ═══ CAPA 3 · PRÉSTAMOS (palabra universal + nº de préstamo = identificador) ═══
    if re.search(r'ABONO DISPOSICI', T):
        nn = re.search(r'N\.(\d+)', T); nn = nn.group(1) if nn else '?'
        return R(naturaleza='movimiento_interno', familia='disposicion_prestamo', sentido='entra', metodo='transferencia', ambito='personal',
                 regla='P1 · disposición de préstamo', fuente='IDENTIFICADOR', confianza='alta',
                 motivo=f'capital de un préstamo que entra · nº {nn}',
                 pendiente='STORE:prestamos · dar de alta el préstamo con ese nº para que cuotas y disposición cuelguen del mismo')
    if re.search(r'SOBRANTE CAN PTMO', T):
        return R(naturaleza='gasto', familia='prestamo_hipoteca', metodo='cargo_abono_banco', ambito='inmueble', inmueble='C/ Tenderina 48 (Oviedo) · vendido nov-2025',
                 regla='P2 · sobrante de cancelación', fuente='FICHERO+EXTERNO', confianza='media',
                 motivo='«SOBRANTE CAN PTMO» = lo que sobra tras cancelar un préstamo · el préstamo 2103-7003-0500230959 deja de cargarse tras el 24/11/2025 · devolución de la familia préstamo',
                 pendiente='STORE:prestamos · atarlo a la cancelación de ese préstamo')
    if re.search(r'CANCELACI(ON|O)N? ANTICIPADA PRESTAMO|CANCELACION PRESTAMO|CANCELACI.N PR.STAMO', T):
        n = re.search(r'PRESTAMO (\d{7} \d{3})', T)
        return R(naturaleza='gasto', familia='prestamo_hipoteca', metodo='transferencia' if 'TRANSFERENCIA' in T else 'cargo_abono_banco', ambito='inmueble' if n else 'personal',
                 inmueble=('Pl. La Pau 4 (Manresa) · vendido mar-2026' if n else None),
                 regla='P3 · cancelación anticipada', fuente='IDENTIFICADOR' + ('+CATALOGO_NACIONAL' if ent else ''), confianza='alta',
                 motivo='amortización anticipada total · ' + (f'préstamo {n.group(1)} · el mismo día entra el precio de venta de Manresa' if n else f'{ent["nombre"] if ent else ""} · concepto H3498890 / DNI del pagador · dos transferencias 15.000 + 9.750'),
                 pendiente='STORE:prestamos · el préstamo (nº contrato) y su cuadro para saber cuánto era capital e intereses')
    if re.search(r'INTERESES, COMISIONES POR OPERACIONES DE PRESTAMOS', T):
        return R(naturaleza='gasto', familia='comisiones_bancarias', subtipo='otros', metodo='cargo_abono_banco', ambito='inmueble', inmueble='Pl. La Pau 4 (Manresa) · vendido mar-2026',
                 regla='P4 · comisión de cancelación', fuente='FICHERO', confianza='alta', motivo='comisión por la cancelación anticipada del préstamo 0004821 103 (mismo día)')
    if re.search(r'^PRESTAMO\s|PRESTAMOS ADEUDO|CARGO POR AMORTIZACION DE PRESTAMO|CUOTA DE HIPOTECA|CARGO CUOTA DE HIPOTECA', T):
        n = re.search(r'(\d{4}[ -]\d{4}[ -]\d{10}|\d{4}-\d{4}-\d{2}-\d{10}|N\.(\d{10}))', TODO)
        num = n.group(0).replace('N.', '') if n else ('hipoteca ING Direct' if 'ING' in T else '?')
        return R(naturaleza='gasto', familia='prestamo_hipoteca', metodo='domiciliacion', ambito='inmueble', inmueble=('Sant Fruitós de Bages (Barcelona) · probable: el IBI de Sant Fruitós se paga desde esta misma cuenta' if f == 'ING_XLS' else None),
                 regla='P5 · cuota de préstamo por nº', fuente='IDENTIFICADOR', confianza='alta',
                 motivo=f'cuota mensual del préstamo {num} · importe fijo · el banco lo dice con la palabra PRÉSTAMO/HIPOTECA',
                 pendiente='STORE:prestamos · a qué piso (o consumo) pertenece ese nº y su cuadro (capital/interés)')
    if ent and ent['nombre'] in ('Bankinter Consumer Finance', 'Banco Cetelem') and sale:
        return R(naturaleza='gasto', familia='prestamo_hipoteca', metodo='domiciliacion' if 'ADEUDO' in T else 'transferencia', ambito='personal',
                 regla='P6 · financiera de consumo por catálogo', fuente='CATALOGO_NACIONAL' + ('+IDENTIFICADOR' if re.search(r'CONTRATO \d+|N \d{16}', TODO) else ''), confianza='alta',
                 motivo=f'{ent["nombre"]} es una financiera de consumo · cuota fija 351,43 (BCF, ene-25→abr-26) / cancelación con nº de contrato (Cetelem)',
                 pendiente='STORE:prestamos · registrar el préstamo de consumo (hoy la app no lo reconoce: WiZink/Cetelem/BCF no están en ninguna lista)')

    # ═══ CAPA 4 · RECIBOS DOMICILIADOS DE PROVEEDOR (NIF / nombre → catálogo nacional) ═══
    if ent and ent['familia'] in ('suministro', 'seguros_alarmas', 'transporte', 'suscripciones', 'compra_online', 'impuestos_tasas') and ent['nombre'] not in ('Ayuntamiento',):
        sub = ent['subtipo']
        if ent['nombre'] == 'Gana Energía': sub = 'gas' if 'GAS' in T else 'luz'
        if ent['nombre'] == 'Apple': sub = 'cloud' if abs(a) < 2 else 'software'
        if 'PLAN UNI' in T: sub = None
        metodo = 'tarjeta' if re.search(r'COMPRA TARJ|PAGO EN', T) else ('domiciliacion' if sale else 'transferencia')
        dev = '' if sale else ' · ABONO = devolución/extorno de esa familia (signo contrario)'
        mand = R2 if f == 'SABADELL_XLS' and R2 else (re.search(r'(\d{6}[A-Z0-9]*)[- ](\d{12})', T).group(2) if re.search(r'(\d{6}[A-Z0-9]*)[- ](\d{12})', T) else None)
        fuente = ('IDENTIFICADOR+CATALOGO_NACIONAL' if (R1 and f == 'SABADELL_XLS') or mand else 'CATALOGO_NACIONAL')
        pend = None
        if ent['familia'] == 'suministro' and ent['ambito'] == 'inmueble':
            pend = f'STORE:inmuebles/recurrentes · qué piso es el mandato {mand or "(sin mandato en el fichero)"} · {ent["nombre"]} tiene varios puntos de suministro'
        elif ent['familia'] == 'seguros_alarmas' and not sub:
            pend = 'STORE:seguros/recurrentes · qué póliza es (hogar/vida/vehículo) · el fichero no lo dice'
        elif ent['nombre'].startswith('PayPal'):
            pend = 'USUARIO/extracto PayPal · el comercio real no viene en el banco'
        if ent['nombre'].startswith('Iberdrola'):
            pend = 'FACTURA/CUPS · el banco pone «ELECTRICIDAD» pero la remesa dice «IBERDROLA GAS 10x» · 5 mandatos = 5 contratos · luz o gas y de qué piso lo dice la factura, no el extracto · STORE:recurrentes'
        return R(naturaleza='gasto', familia=ent['familia'], subtipo=sub, metodo=metodo, ambito=ent['ambito'],
                 regla='C1 · proveedor por catálogo' + (' (NIF)' if R1 and f == 'SABADELL_XLS' else ' (nombre)'), fuente=fuente, confianza='alta' if sub and not ent['nombre'].startswith('Iberdrola') else 'media',
                 motivo=f'{ent["nombre"]} → {ent["familia"]}{"·"+sub if sub else ""} · {ent["nota"]}{dev}', pendiente=pend)

    # ═══ CAPA 5 · PALABRAS UNIVERSALES DEL PROPIO BANCO ═══
    if re.search(r'INTERESES Y/O COMISIONES CUENTA', T):
        return R(naturaleza='gasto', familia='comisiones_bancarias', subtipo='mantenimiento', metodo='cargo_abono_banco', ambito='personal',
                 regla='B0 · comisiones de cuenta', fuente='FICHERO', confianza='alta',
                 motivo='cargo de comisiones/intereses de la cuenta' if sale else 'ABONO del mismo importe (231,20) que el cargo del 24/03/2026 · extorno de la comisión = devolución de la familia')
    if re.search(r'REMUN\. MES', T) and not sale:
        return R(naturaleza='ingreso', familia='rendimiento', subtipo='interes', metodo='cargo_abono_banco', ambito='personal',
                 regla='B1 · remuneración de cuenta', fuente='FICHERO', confianza='alta', motivo='interés que abona el propio banco')
    if re.search(r'ABONO POR DOMICILIACI|BONIFICACION PACK|BONIFICACI', T) and not sale:
        return R(naturaleza='ingreso', familia='otros_ingresos', metodo='cargo_abono_banco', ambito='personal',
                 regla='B2 · bonificación del banco', fuente='FICHERO', confianza='alta', motivo='bonificación/cashback del banco por domiciliar recibos o pack viajes')
    if re.search(r'LIQUIDACION DEL CONTRATO', T) and abs(a) < 20:
        return R(naturaleza='gasto', familia='comisiones_bancarias', subtipo='mantenimiento', metodo='cargo_abono_banco', ambito='personal',
                 regla='B3 · liquidación de cuenta', fuente='FICHERO', confianza='media', motivo='liquidación periódica del contrato de cuenta (comisiones/intereses de descubierto) · importe residual')
    if re.search(r'ABONO POR TRANSFERENCIA A SU FAVOR', T) and abs(a) < 1:
        return R(naturaleza='ingreso', familia='otros_ingresos', metodo='transferencia', ambito='personal',
                 regla='B4 · céntimo de verificación', fuente='FICHERO', confianza='alta', motivo='0,01 € · verificación de cuenta')
    if re.search(r'ENVIO DE DINERO - IMAGINBANK', T) and abs(a) < 1:
        return R(naturaleza='ingreso', familia='otros_ingresos', metodo='transferencia', ambito='personal',
                 regla='B4 · céntimo de verificación', fuente='FICHERO', confianza='alta', motivo='0,04 € · prueba de transferencia')
    if re.search(r'CARGO PRIMA SEGURO', T):
        return R(naturaleza='gasto', familia='seguros_alarmas', subtipo='vida', metodo='domiciliacion', ambito='personal',
                 regla='B5 · prima de seguro según el banco', fuente='FICHERO', confianza='media', motivo='ING lo categoriza «Seguro de vida» · sin nombre de aseguradora',
                 pendiente='STORE:seguros · la póliza')
    if re.search(r'COBRO PLAN UNI|CUOTA \w+ PLAN UNI', T):
        return R(naturaleza='gasto', familia='seguros_alarmas', metodo='domiciliacion', ambito='inmueble',
                 regla='B5 · prima de seguro (Plan Uni)', fuente='FICHERO+CATALOGO_NACIONAL', confianza='media', motivo='«PLAN UNI SEGUR» = seguro Unicaja · 2 pólizas hasta ago-25, 1 después (la de 21,97 desaparece al vender)',
                 pendiente='STORE:seguros · hogar o vida, y de qué piso')

    # ═══ CAPA 6 · COMUNIDAD / AYUNTAMIENTO por palabra universal + mandato ═══
    if re.search(r'\bCCPP\b|\bCDAD\b|^CP TENDERI|COMUNIDAD', T) and sale:
        mand = re.search(r'(\d{12})', T); m = mand.group(1) if mand else None
        inmu = {'006300000900': 'Oviedo · C/ Tenderina (mandato …0900) · una de las 3 unidades', '006300001000': 'Oviedo · C/ Tenderina (mandato …1000)', '006300001100': 'Oviedo · C/ Tenderina (mandato …1100)',
                '004300001200': 'C/ Tenderina 48 (Oviedo) · vendido nov-2025 · (mandato …1200 cesa nov-25)', '000278300002': 'Otra comunidad (CDAD PROP 01B046) · 2 cargos de 38 € desde jul-26 = ¿2 unidades?'}.get(m)
        return R(naturaleza='gasto', familia='comunidad', subtipo='cuota_mensual', metodo='domiciliacion', ambito='inmueble', inmueble=inmu,
                 regla='K1 · comunidad de propietarios', fuente='FICHERO+IDENTIFICADOR', confianza='alta',
                 motivo=f'CCPP/CDAD/CP = comunidad · mandato {m} · «CL TE» = Calle Tenderina · 3 mandatos el mismo día = 3 unidades',
                 pendiente=f'STORE:inmuebles · qué unidad es el mandato {m} (los 3 CCPP …0900/…1000/…1100 son 3 pisos distintos de C/ Tenderina)')
    if ent and ent['nombre'] == 'Ayuntamiento':
        inmu = inm or ({'AYUNTAMIEN591564': 'Ayuntamiento (emisor 591564) · fraccionado mensual jun→jun · probable Oviedo', 'AYUNTAMIEN01886L': 'Ayuntamiento (emisor 01886L) · 4 cargos el 10/11/2025 = 4 recibos (¿IBI de 4 unidades?)'}.get(T[:16].replace(' ', '')) if 'AYUNTAMIEN' in T else None)
        sub = 'otros_tributos'
        motivo = 'tributo municipal'
        if 'MANRESA' in T:
            sub = 'otros_tributos'; motivo = 'pago con tarjeta al Ajuntament de Manresa 1.038,57 el 31/03/2026, 2 semanas tras vender el piso de Manresa = plusvalía municipal (IIVTNU)'
        return R(naturaleza='gasto', familia='impuestos_tasas', subtipo=sub, metodo='tarjeta' if 'TARJ' in T else 'domiciliacion', ambito='inmueble', inmueble=inmu,
                 regla='K2 · tributo municipal', fuente='FICHERO' + ('+EXTERNO' if 'MANRESA' in T else ''), confianza='alta' if 'MANRESA' in T else 'media',
                 motivo=motivo, pendiente='STORE:inmuebles · qué piso y si es IBI o basura (el recibo lo dice, el extracto no)')

    # ═══ CAPA 7 · INMOBILIARIO por el texto libre (alquiler · fianza · venta · gestión) ═══
    # 7.0 · suministros refacturados por el operador
    if 'ALISSER' in T and 'SUMINISTROS' in T and not sale:
        return R(naturaleza='gasto', familia='suministro', subtipo='otros', metodo='transferencia', ambito='inmueble', inmueble=inm,
                 regla='I0 · refacturación de suministros', fuente='FICHERO', confianza='alta', motivo='Alisser reembolsa suministros del piso · devolución de la familia suministro (signo contrario)')
    # 7.1 · fianzas (entra / devuelve / traspaso a nuevo gestor)
    if re.search(r'FIANZA|FINAZA|DEPOSITO|DEPÓSITO|CAUZIONALE|DEPOSIT\b|FONDO DE GARANTIA|GARANTIA|RESERVA HABITACION', T):
        mixto = re.search(r'\+|\bY\b|MES|ALQUILER|RENT\b|MITAD', T) and not re.search(r'DEVOL|TRASPASO FIANZA', T) and not sale
        if sale:
            if 'TRASPASO FIANZA' in T:
                return R(naturaleza='movimiento_interno', familia='fianza', subtipo='custodia', sentido='sale', metodo='transferencia', ambito='inmueble', inmueble=inm,
                         regla='I1 · fianza pasa al nuevo gestor', fuente='FICHERO', confianza='alta', motivo='Jose transfiere la fianza del inquilino a Alisser al cederle el piso (mar-2026) · la fianza cambia de custodio',
                         pendiente='STORE:contratos · el inquilino y su contrato')
            return R(naturaleza='movimiento_interno', familia='fianza', subtipo='devuelve', sentido='sale', metodo='transferencia', ambito='inmueble', inmueble=inm,
                     regla='I2 · devolución de fianza', fuente='FICHERO', confianza='alta', motivo='«devolución fianza/depósito de garantía» en el texto · sale',
                     pendiente='STORE:contratos · el contrato que se cierra' if not inm else 'STORE:contratos · casar con el contrato del inquilino')
        if mixto:
            partes = ''
            if abs(a - 930) < 0.01: partes = ' · desglose deducible: 465 fianza + 465 mes'
            return R(naturaleza='movimiento_interno', familia='fianza', subtipo='entra', sentido='entra', metodo='transferencia', ambito='inmueble', inmueble=inm,
                     regla='I3 · fianza + alquiler MEZCLADOS', fuente='FICHERO', confianza='media',
                     motivo='el texto dice fianza Y mes/alquiler en un solo importe' + partes,
                     pendiente='DESGLOSE · hay que partir la línea en dos (fianza = movimiento interno · alquiler = ingreso) · el importe de la fianza lo dice el contrato (STORE:contratos)')
        return R(naturaleza='movimiento_interno', familia='fianza', subtipo='entra', sentido='entra', metodo='transferencia', ambito='inmueble', inmueble=inm,
                 regla='I4 · fianza que entra', fuente='FICHERO', confianza='alta', motivo='«fianza/depósito/cauzionale/deposit» en el texto · entra',
                 pendiente='STORE:contratos · el inquilino y la habitación' if not inm else None)
    # 7.2 · venta de inmueble
    if re.search(r'\bARRAS\b|/URI/CANC|RP MANRESA|RESERVA PIS', T) and not sale:
        return R(naturaleza='ingreso', familia='venta', subtipo='inmueble', metodo='transferencia', ambito='inmueble', inmueble=inm,
                 regla='V1 · venta de inmueble (arras/precio)', fuente='FICHERO' + ('+EXTERNO' if re.search(r'RESERVA PIS|/URI/CANC|RP MANRESA', T) else ''), confianza='alta',
                 motivo=('arras' if 'ARRAS' in T else 'reserva' if 'RESERVA' in T else 'precio de la compraventa (dos transferencias del comprador, una para cancelar la hipoteca · notaría RP Manresa)'),
                 pendiente='STORE:ventas (property_sales) · registrar la venta para que arras + precio + cancelación + plusvalía + honorarios cuelguen de ella')
    if re.search(r'ABONO POR CHEQUE INGRESADO', T) and a > 50000:
        return R(naturaleza='ingreso', familia='venta', subtipo='inmueble', metodo='cheque', ambito='inmueble', inmueble='C/ Tenderina 48 (Oviedo) · vendido nov-2025',
                 regla='V2 · cheque bancario de compraventa', fuente='EXTERNO', confianza='media',
                 motivo='cheque de 73.251,66 el 28/11/2025 · encaja con: arras 18.000 el 12/11 (Oviedo), última cuota del préstamo 0500230959 el 24/11, sobrante de cancelación 02/12, honorarios intermediación 01/12, Alisser deja de pagar Tenderina 48 en nov · el fichero SOLO dice «cheque ingresado»',
                 pendiente='STORE:ventas · sin la venta registrada esto es solo una inferencia por fechas')
    if re.search(r'HONORARIOS INTERMEDIACION VTA|HONORARIS GESTION|CERTIFICADO ENERGETICO|CANCELACION ATG|TRAMITACION DE CONCILIACION|CONCILIACION \d+/\d+|UNICAJA TRAMITACIONES', T) or (ent and ent['familia'] == 'gestion'):
        sub = 'gestoria' if re.search(r'ATG|TRAMITACIONES', T) else ('abogado' if 'CONCILIACI' in T else 'otros')
        que = {'HONORARIOS INTERMEDIACION VTA': 'honorarios de la agencia por la venta (Oviedo, dic-25)', 'HONORARIS': 'honorarios de Finques Candal por la venta de Manresa (7.260 = ~5,5 % del precio)',
               'CERTIFICADO': 'certificado energético · obligatorio para vender/alquilar', 'ATG': 'provisión para cancelación registral (Unicaja Tramitaciones devuelve 121 el 02/12)',
               'TRAMITACIONES': 'devolución de la provisión de 121 € (signo contrario → devolución de gestoría)', 'CONCILIACI': 'conciliación judicial 1338/25 (abogado + tasa) · ¿impago de un inquilino?',
               '4A AVENIDA': 'agencia inmobiliaria · 2.359,50 el 16/07/2025, 12 días tras disponer 24.500 del préstamo Sabadell y pagar 15.000 a Manuel Fernández = ¿honorarios de una COMPRA?'}
        motivo = next((v for k, v in que.items() if k in T), (ent['nota'] if ent else 'gestión'))
        inmu = inm or ('C/ Tenderina 48 (Oviedo) · vendido nov-2025' if re.search(r'HONORARIOS INTERMEDIACION|CERTIFICADO|ATG|TRAMITACIONES', T) else None)
        return R(naturaleza='gasto', familia='gestion', subtipo=sub, metodo='transferencia', ambito='inmueble', inmueble=inmu,
                 regla='G1 · gestión / honorarios / abogado', fuente='FICHERO' + ('+CATALOGO_NACIONAL' if ent else '') + ('+EXTERNO' if re.search(r'ATG|4A AVENIDA|HONORARIS', T) else ''), confianza='media' if re.search(r'ATG|4A AVENIDA|CONCILIACI', T) else 'alta',
                 motivo=motivo, pendiente='STORE:ventas/inmuebles · a qué operación/piso pertenece' if not inm else None)
    # 7.3 · alquiler que ENTRA (inquilinos)
    if not sale and (re.search(r'ALQUIL|RENTA\b|\bRENT\b|AFFITTO|MENSUALIDAD|HABITACION|\bHAB\b|\bPISO\b|MES DE|MEDIO MES|\bMES\b|PAGO MES|SEPTIEMBRE \(|CODIGO: 4-ACEVEDO|TENDERINA|ACEVEDO', T) or 'ALISSER' in T):
        who = re.search(r'\bDE (.+?),', r['T']); who = who.group(1).title() if who else None
        hab = re.search(r'HAB\.? ?(\d)|H(\d)\b|HABITACION (\d)', T)
        inmu = inm
        if 'ALISSER' in T:
            if not inm and round(abs(a), 2) in (1202.78, 1235.26): inm = 'C/ Tenderina 48 (Oviedo) · vendido nov-2025 (por el importe de la serie)'
            return R(naturaleza='ingreso', familia='alquiler', metodo='transferencia', ambito='inmueble', inmueble=inm,
                     regla='A1 · renta del operador (piso entero)', fuente='FICHERO', confianza='alta',
                     motivo=f'Alisser Real Estate paga «Renta <mes> {inm}» · 1.202,78→1.235,26 (Tenderina 48, feb→oct 25) · 1.350 (Fuertes Acevedo 32, abr→ago 26)',
                     pendiente='STORE:contratos · contrato con Alisser por piso entero')
        return R(naturaleza='ingreso', familia='alquiler', metodo='transferencia', ambito='inmueble', inmueble=inmu,
                 regla='A2 · alquiler de habitación (inquilino)', fuente='FICHERO' + ('' if inmu else '→STORE:contratos'), confianza='alta',
                 motivo=f'palabra alquiler/rent/affitto/mensualidad/mes/habitación · paga {who or "un particular"}' + (f' · hab {"".join(x for x in hab.groups() if x)}' if hab else ''),
                 pendiente=None if inmu else f'STORE:contratos · «{who}» → qué habitación/piso (el texto no lo dice)')
    # 7.4 · el mismo inquilino sin palabra clave (recurrencia dentro del fichero)
    if not sale and r.get('recurrente_inquilino'):
        who, n = r['recurrente_inquilino']
        return R(naturaleza='ingreso', familia='alquiler', metodo='transferencia', ambito='inmueble', inmueble=inm,
                 regla='A3 · inquilino conocido por recurrencia', fuente='RECURRENCIA', confianza='alta',
                 motivo=f'«{who}» paga el mismo importe {n} veces y en otras líneas dice «alquiler/renta» · sin palabra clave en esta',
                 pendiente=None if inm else f'STORE:contratos · «{who}» → habitación/piso')
    # 7.5 · alquiler que SALE (Jose paga renta)
    if sale and re.search(r'ALQUILER', T):
        return R(naturaleza='gasto', familia='alquiler_renting', subtipo='vivienda', metodo='transferencia', ambito='inmueble' if inm or 'GONZALO' in T else 'personal', inmueble=inm or ('C/ Fuertes Acevedo 32 (Oviedo) · ¿subarriendo?' if 'GONZALO' in T else None),
                 regla='A4 · renta que Jose paga', fuente='FICHERO', confianza='media',
                 motivo='«Alquiler <mes>» y sale · a Gonzalo J. González Guedán 1.350 (ago-26) = mismo importe que cobra de Alisser por Fuertes Acevedo 32 → renta al propietario (rent-to-rent)' if 'GONZALO' in T else '«Alquiler enero» 1.270 a un particular (ene-25) · ¿vivienda propia o piso subarrendado?',
                 pendiente='STORE:contratos · si Fuertes Acevedo 32 es propio o alquilado; si no, ámbito personal (vivienda)' if 'GONZALO' in T else 'USUARIO · ¿alquiler de tu vivienda o de un piso que subarriendas?')

    # ═══ CAPA 8 · INVERSIONES (catálogo + palabra) ═══
    if ent and ent['nombre'].startswith('Smartflip'):
        if sale:
            return R(naturaleza='movimiento_interno', familia='aportacion', subtipo='inversion', sentido='sale', metodo='transferencia', ambito='personal',
                     regla='X1 · aportación a inversión', fuente='CATALOGO_NACIONAL+EXTERNO', confianza='alta', motivo='3 × 15.000 a Smartflip (30/12/25–05/01/26) · capital prestado en Smart Yield',
                     pendiente='STORE:inversiones · dar de alta la posición (préstamo P2P) para que los intereses cuelguen de ella')
        if 'INTERES' in T or abs(a) < 1000:
            return R(naturaleza='ingreso', familia='rendimiento', subtipo='interes', metodo='transferencia', ambito='personal',
                     regla='X2 · interés de inversión', fuente='FICHERO+CATALOGO_NACIONAL', confianza='alta', motivo='«Pago Intereses Prestamo Smart Yield» 607,50/mes desde ene-26 · = 12,15 % anual sobre 60.000',
                     pendiente='STORE:inversiones · la posición Smart Yield (60.000 = 4 × 15.000)')
        return R(naturaleza='ingreso', familia='inversion', subtipo='prestamo_p2p', metodo='transferencia', ambito='personal',
                 regla='X3 · devolución de capital de inversión', fuente='CATALOGO_NACIONAL', confianza='media', motivo='+15.000 de Smartflip el 05/01/26 · devolución de una de las 4 transferencias (¿exceso?)',
                 pendiente='STORE:inversiones · confirmar si es devolución de capital o un abono de la plataforma')
    if ent and ent['nombre'].startswith('abrdn'):
        return R(naturaleza='movimiento_interno', familia='aportacion', subtipo='fondo', sentido='sale', metodo='transferencia', ambito='personal',
                 regla='X1 · aportación a inversión', fuente='CATALOGO_NACIONAL', confianza='alta', motivo='«SUSCRIPCI abrdn SICAV I - JAPA» = suscripción de fondo (Japanese equity)', pendiente='STORE:inversiones · la posición del fondo')
    if re.search(r'APORTACI.N DE CAPITAL', T):
        return R(naturaleza='movimiento_interno', familia='aportacion', subtipo='inversion', sentido='sale', metodo='transferencia', ambito='personal',
                 regla='X1 · aportación a inversión', fuente='FICHERO', confianza='media', motivo='«Aportación de capital» 600 € · sin beneficiario en el fichero', pendiente='USUARIO · ¿a qué sociedad/posición?')
    if ent and ent['nombre'].startswith('Feebbo'):
        return R(naturaleza='ingreso', familia='otros_ingresos', metodo='transferencia', ambito='personal',
                 regla='X4 · ingreso menor identificado', fuente='CATALOGO_NACIONAL+EXTERNO', confianza='alta', motivo='Feebbo paga 10 €/mes por participar en el panel Medux')
    if ent and ent['nombre'].startswith('Alisser') and sale:
        return R(naturaleza='movimiento_interno', familia='fianza', subtipo='custodia', sentido='sale', metodo='transferencia', ambito='inmueble', inmueble=inm,
                 regla='I1 · fianza pasa al nuevo gestor', fuente='FICHERO', confianza='alta', motivo='traspaso de fianza a Alisser', pendiente='STORE:contratos')
    if ent and ent['nombre'].startswith('Caser'):
        return R(naturaleza='gasto', familia='seguros_alarmas', metodo='transferencia', ambito='inmueble',
                 regla='C1 · proveedor por catálogo (nombre)', fuente='CATALOGO_NACIONAL', confianza='media', motivo='Caser abona 234,17 (16/12/25) · extorno de prima o indemnización · devolución de la familia seguros',
                 pendiente='STORE:seguros · qué póliza (¿la del piso vendido?)')
    if ent and ent['nombre'].startswith('Minoautos'):
        return R(naturaleza='gasto', familia='transporte', subtipo='otros', metodo='transferencia', ambito='personal',
                 regla='C1 · proveedor por catálogo (nombre)', fuente='CATALOGO_NACIONAL+EXTERNO', confianza='alta', motivo='«Pago resto Ibiza 8055LXT» a un concesionario = compra de coche (12.240) · el catálogo no tiene familia «compra de vehículo»',
                 pendiente='TAXONOMÍA · no hay subtipo «compra de vehículo» en transporte')
    if ent and ent['nombre'].startswith('Motores'):
        return R(naturaleza='gasto', familia='reparacion_mantenimiento', subtipo='vehiculo', metodo='transferencia', ambito='personal',
                 regla='C1 · proveedor por catálogo (nombre)', fuente='CATALOGO_NACIONAL+EXTERNO', confianza='alta', motivo='taller de rectificado de motores · 3.993 (30/10/25)')

    # ═══ CAPA 9 · RESTO: transferencias a/de particulares o sin beneficiario · NO CLASIFICABLES con lo que hay ═══
    if re.search(r'TRANSFERENCIA|TRANSFERENCIA REALIZADA|TRANSFERENCIA RECIBIDA|ABONO TRANSFERENCIA', T) or f == 'UNICAJA_PDF':
        who = re.sub(r'^(TRANSFERENCIA (INMEDIATA )?(A FAVOR DE|DE|A)|ABONO TRANSFERENCIA DE|TRANSFERENCIA REALIZADA ·|TRANSFERENCIA RECIBIDA ·)\s*', '', T).split(' CONCEPTO')[0].strip(' ,.·')
        sin_benef = f == 'UNICAJA_PDF' or re.search(r'TRANSFERENCIA \d{9}$|RECIBIDA · \d+$', T)
        pistas = {
            'CONCEPCION RAMIREZ GUERRERO': 'mismo apellido (Ramírez) · 5.485,53 sin concepto · ¿familiar? ¿préstamo/regalo/deuda?',
            'ELOY GOMEZ RAMIREZ': 'mismos apellidos · 500 y 1.000 · ¿hermano? ¿préstamo familiar?',
            'MANUEL FERNANDEZ': '15.000 el 04/07/2025, el MISMO DÍA que Sabadell abona la disposición de 24.500 del préstamo 8078716546 · + agencia 4A Avenida 2.359,50 el 16/07 → ¿arras/pago de una COMPRA de inmueble?',
            'CB SANTA CATALINA': '«CB» = comunidad de bienes · 1.490 el 22/01/2026 · ¿reforma? ¿alquiler? ¿mobiliario?',
            'TRANSFERENCIA 212128856': '15.000 el 31/12/2025 SIN beneficiario en el fichero · entre las 3 de Smartflip (30/12, 02/01, 05/01) · muy probable Smartflip (4 × 15.000 = 60.000 ⇒ 607,50/mes = 12,15 %)',
            'LUIS EDUARDO MONTES CHALARCA': '760 = 2 × 380 → ¿devolución de fianza a un inquilino (380 = hab 2/3 Fuertes Acevedo)? el texto no lo dice',
            'ROSA DIAZ ZAPICO': '62,35 a un particular · sin concepto',
            'EDU': '+2.000 de «Edu» · ¿Eduardo? ¿Eloy? · sin concepto',
            '392673073': '+107,50 · el fichero BBVA solo trae la referencia numérica',
            'FRANCISCO JAVIER RAMOS CALLES': '+413,09 el 25/06/2026 (oficina 8076) · ¿inquilino? ¿devolución?',
            'JORDAN O SULLIVAN': '+930 «Sent from Revolut» el 01/09/2026 · 930 = 465 + 465 (fianza + mes, igual que Benito en jul-25) · probable NUEVO inquilino',
        }
        pista = next((v for k, v in pistas.items() if k in T or k in who), None)
        if 'JORDAN' in T:
            return R(naturaleza='ingreso', familia='alquiler', metodo='transferencia', ambito='inmueble', regla='A5 · probable inquilino nuevo', fuente='FICHERO+RECURRENCIA', confianza='baja',
                     motivo=pista, pendiente='STORE:contratos · si hay contrato nuevo desde sep-26, es fianza 465 + alquiler 465 (DESGLOSE)')
        if '212128856' in T:
            return R(naturaleza='movimiento_interno', familia='aportacion', subtipo='inversion', sentido='sale', metodo='transferencia', ambito='personal', regla='X1 · aportación a inversión (probable)', fuente='CRUCE_CUENTAS+EXTERNO', confianza='baja',
                     motivo=pista, pendiente='USUARIO · el fichero de Sabadell no trae el beneficiario de esta transferencia (solo la referencia) · confirmar que es Smartflip')
        if 'MANUEL FERNANDEZ' in T:
            return R(naturaleza='gasto', familia='otros', metodo='transferencia', ambito='inmueble', regla='Z1 · particular · NO CLASIFICABLE', fuente='USUARIO', confianza='baja', estado='NO_CLASIFICABLE',
                     motivo=pista, pendiente='USUARIO · ¿compra de inmueble (arras/precio)? Si es compra, el catálogo NO tiene familia para «compra de inmueble» (es un activo, no un gasto) · STORE:inmuebles (alta de la compra)')
        return R(naturaleza='gasto' if sale else 'ingreso', familia='otros' if sale else 'otros_ingresos', metodo='transferencia', ambito='inmueble' if inm else 'personal', inmueble=inm,
                 regla='Z1 · particular · NO CLASIFICABLE', fuente='USUARIO', confianza='baja', estado='NO_CLASIFICABLE',
                 motivo=pista or ('transferencia a/de un particular sin concepto útil' if not sin_benef else 'el fichero NO trae el beneficiario (Unicaja solo guarda el concepto que tecleó el usuario)'),
                 pendiente=('USUARIO · solo tú sabes qué es · el banco no da más' if not sin_benef else 'FICHERO INSUFICIENTE · Unicaja/Sabadell no exportan el beneficiario de la transferencia · hace falta el detalle de la transferencia o el IBAN destino') + ' · la app debería PREGUNTAR una vez y aprenderlo (regla aprendida por contraparte)')
    return None

# ──────────────────────────────────────────────────────────────────────────────
def recurrencia_inquilinos(prim):
    """Quien en alguna línea dice alquiler/renta y en otra no: la línea muda hereda por recurrencia."""
    pagadores = collections.defaultdict(list)
    for r in prim:
        if r['importe'] <= 0 or r['fichero'] != 'SANTANDER_PDF': continue
        m = re.search(r'\bDE (.+?),', r['T'])
        if m: pagadores[m.group(1)].append(r)
    for who, rs in pagadores.items():
        if es_titular(who): continue
        con_kw = [x for x in rs if re.search(r'ALQUIL|RENTA\b|\bRENT\b|AFFITTO|MENSUALIDAD|HABITACION|\bHAB\b|\bPISO\b|MES', x['T'])]
        if con_kw and len(rs) >= 2:
            for x in rs: x['recurrente_inquilino'] = (who.title(), len(rs))

def main():
    rows = cargar()
    prim = [r for r in rows if r['fichero'] in PRIMARIOS]
    emparejar(prim); recurrencia_inquilinos(prim)
    # índice primario por clave para que los duplicados hereden
    idx = {}
    for r in prim: idx[(r['cuenta'], r['fecha'], round(r['importe'], 2), round(r['saldo'], 2))] = r
    out = []
    for r in rows:
        if r['fichero'] in PRIMARIOS:
            c = clasificar(r)
            if c is None: c = R(naturaleza='gasto' if r['importe'] < 0 else 'ingreso', regla='— SIN REGLA —', fuente='USUARIO', confianza='baja', estado='NO_CLASIFICABLE', motivo='ninguna regla casó', pendiente='REVISAR')
            r['c'] = c
        else:
            p = idx.get((r['cuenta'], r['fecha'], round(r['importe'], 2), round(r['saldo'], 2)))
            r['c'] = dict(p['c']) if p else R(regla='DUP sin primario', fuente='', confianza='', estado='NO_CLASIFICABLE', motivo='', pendiente='')
            r['c']['duplicado_de'] = DUPLICADO_DE[r['fichero']]
        c = r['c']
        c.setdefault('estado', 'CLASIFICADO')
        if c['estado'] == 'CLASIFICADO' and c.get('pendiente'):
            c['estado'] = 'CLASIFICADO · con pendiente'
        if c.get('naturaleza') != 'movimiento_interno': c.pop('sentido', None)
        out.append(r)
    campos = ['id', 'fichero', 'banco', 'cuenta', 'fecha', 'fecha_valor', 'concepto', 'importe', 'saldo', 'ref1', 'ref2', 'duplicado_de',
              'naturaleza', 'familia', 'subtipo', 'metodo', 'ambito', 'inmueble', 'sentido', 'regla', 'fuente', 'confianza', 'estado', 'motivo', 'pendiente']
    with open('clasificacion.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=campos); w.writeheader()
        for r in out:
            row = {k: r.get(k, '') for k in campos[:11]}
            for k in campos[11:]: row[k] = r['c'].get(k, '') or ''
            w.writerow(row)
    # ── resumen ──
    print('=== líneas:', len(out), '· únicas (primarios):', len(prim))
    sin = [r for r in prim if r['c']['regla'] == '— SIN REGLA —']
    print('=== SIN REGLA:', len(sin))
    for r in sin[:60]: print('   ', r['fichero'][:8], r['fecha'], r['importe'], r['concepto'][:80], '|', r['ref1'][:30])
    return out, prim

if __name__ == '__main__':
    main()
