import re, csv, xlrd, datetime
RAW='raw'
def eur(s): return float(s.replace('.','').replace(',','.'))
rows=[]
# ---------- SANTANDER PDF ----------
txt=open(f'{RAW}/pdf_transactions.txt').read().split('\n')
pat=re.compile(r'^(\d\d/\d\d/\d{4}) (.*?) (-?[\d.]+,\d\d) EUR (-?[\d.]+,\d\d) EUR$')
cur=None
for ln in txt:
    if ln.startswith('===') or ln.startswith('TITULAR') or ln.startswith('CUENTA SANTANDER') or ln.startswith('Saldo:') or ln.startswith('Movimientos de cuenta') or ln.startswith('Fecha operación') or ln.startswith('Documento impreso'):
        continue
    m=pat.match(ln)
    if m:
        cur={'fichero':'SANTANDER_PDF','banco':'Santander','cuenta':'ES54 0049 0052 6221 1043 8676','fecha':m.group(1),'fecha_valor':'','concepto':m.group(2),'importe':eur(m.group(3)),'saldo':eur(m.group(4)),'ref1':'','ref2':''}
        rows.append(cur); continue
    m2=re.match(r'^Fecha valor: (\d\d/\d\d/\d{4})\s?(.*)$', ln)
    if m2 and cur:
        cur['fecha_valor']=m2.group(1)
        if m2.group(2): cur['concepto']+=' '+m2.group(2)
        continue
    if cur and ln.strip():
        cur['concepto']+=' '+ln.strip()
nS=len([r for r in rows if r['fichero']=='SANTANDER_PDF'])
# ---------- UNICAJA PDF ----------
txt=open(f'{RAW}/pdf_listado7.txt').read().split('\n')
pat=re.compile(r'^(\d\d/\d\d/\d{4}) (\d\d/\d\d/\d{4}) (.*?) (-?[\d.]+,\d\d) EUR (-?[\d.]+,\d\d) EUR (\d+) (\d+)$')
for ln in txt:
    m=pat.match(ln)
    if m:
        rows.append({'fichero':'UNICAJA_PDF','banco':'Unicaja','cuenta':'ES60 2103 7003 5200 3008 4437','fecha':m.group(1),'fecha_valor':m.group(2),'concepto':m.group(3),'importe':eur(m.group(4)),'saldo':eur(m.group(5)),'ref1':m.group(6),'ref2':m.group(7)})
    elif re.match(r'^\d\d/\d\d/\d{4}', ln):
        print('UNMATCHED UNICAJA PDF:', ln)
nU=len([r for r in rows if r['fichero']=='UNICAJA_PDF'])
# ---------- UNICAJA XLS ----------
U='/root/.claude/uploads/b09a8ec1-b131-5948-b88c-6929826bb6b8'
wb=xlrd.open_workbook(f'{U}/c6870a6b-Movimientos_Cuenta_4437_01_01_2026_05___09___2026.xls'); sh=wb.sheet_by_index(0)
def xd(v): 
    d=datetime.date(1899,12,30)+datetime.timedelta(days=int(v)); return d.strftime('%d/%m/%Y')
for r in range(11, sh.nrows):
    v=[sh.cell_value(r,c) for c in range(sh.ncols)]
    if not isinstance(v[0],float): continue
    rows.append({'fichero':'UNICAJA_XLS','banco':'Unicaja','cuenta':'ES60 2103 7003 5200 3008 4437','fecha':xd(v[0]),'fecha_valor':xd(v[1]),'concepto':str(v[2]).strip(),'importe':float(v[3]),'saldo':float(v[5]),'ref1':str(int(v[7])) if v[7]!='' else '','ref2':str(int(v[8])) if v[8]!='' else ''})
nUX=len([r for r in rows if r['fichero']=='UNICAJA_XLS'])
# ---------- SABADELL XLS ----------
wb=xlrd.open_workbook(f'{U}/aa41c887-05092026_2706_0003239635_1.xls'); sh=wb.sheet_by_index(0)
for r in range(9, sh.nrows):
    v=[sh.cell_value(r,c) for c in range(sh.ncols)]
    if not re.match(r'^\d\d/\d\d/\d{4}$', str(v[0])): 
        if any(str(x).strip() for x in v): print('SKIP SABADELL:', v)
        continue
    rows.append({'fichero':'SABADELL_XLS','banco':'Sabadell','cuenta':'ES47 0081 2706 1500 0323 9635','fecha':v[0],'fecha_valor':v[2],'concepto':str(v[1]).strip(),'importe':float(v[3]),'saldo':float(v[4]),'ref1':str(v[5]).strip(),'ref2':str(v[6]).strip()})
nSB=len([r for r in rows if r['fichero']=='SABADELL_XLS'])
print('Santander',nS,'UnicajaPDF',nU,'UnicajaXLS',nUX,'Sabadell',nSB,'TOTAL',len(rows))
# saldo continuity check per file (files are newest-first for Santander/UnicajaXLS/Sabadell; oldest-first for Unicaja PDF)
for f in ['SANTANDER_PDF','UNICAJA_PDF','UNICAJA_XLS','SABADELL_XLS']:
    rs=[r for r in rows if r['fichero']==f]
    if f!='UNICAJA_PDF': rs=list(reversed(rs))
    bad=0
    for a,b in zip(rs,rs[1:]):
        if abs(round(a['saldo']+b['importe'],2)-round(b['saldo'],2))>0.011: bad+=1; print('  SALDO BREAK',f,a['fecha'],a['saldo'],'->',b['fecha'],b['concepto'][:40],b['importe'],b['saldo'])
    print(f,'saldo breaks:',bad, 'first',rs[0]['fecha'],'last',rs[-1]['fecha'])
for i,r in enumerate(rows): r['id']=i+1
with open('movimientos.csv','w',newline='') as fh:
    w=csv.DictWriter(fh, fieldnames=['id','fichero','banco','cuenta','fecha','fecha_valor','concepto','importe','saldo','ref1','ref2']); w.writeheader(); w.writerows(rows)

# ================= LOS OTROS 5 FICHEROS =================
rows2=[]
# 5 · UNICAJA XLS FULL 2025-2026
wb=xlrd.open_workbook(f'{U}/b0fe32ad-Movimientos_Cuenta_4437_01_01_2025_05___09___2026.xls'); sh=wb.sheet_by_index(0)
for r in range(11, sh.nrows):
    v=[sh.cell_value(r,c) for c in range(sh.ncols)]
    if not isinstance(v[0],float): continue
    rows2.append({'fichero':'UNICAJA_XLS_FULL','banco':'Unicaja','cuenta':'ES60 2103 7003 5200 3008 4437','fecha':xd(v[0]),'fecha_valor':xd(v[1]),'concepto':str(v[2]).strip(),'importe':float(v[3]),'saldo':float(v[5]),'ref1':str(int(v[7])) if v[7]!='' else '','ref2':str(int(v[8])) if v[8]!='' else ''})
# 6 · UNICAJA PDF listado 6
txt=open(f'{RAW}/pdf_listado6.txt').read().split('\n')
pat=re.compile(r'^(\d\d/\d\d/\d{4}) (\d\d/\d\d/\d{4}) (.*?) (-?[\d.]+,\d\d) EUR (-?[\d.]+,\d\d) EUR (\d+) (\d+)$')
for ln in txt:
    m=pat.match(ln)
    if m: rows2.append({'fichero':'UNICAJA_PDF_6','banco':'Unicaja','cuenta':'ES60 2103 7003 5200 3008 4437','fecha':m.group(1),'fecha_valor':m.group(2),'concepto':m.group(3),'importe':eur(m.group(4)),'saldo':eur(m.group(5)),'ref1':m.group(6),'ref2':m.group(7)})
# 7 · ING XLS
wb=xlrd.open_workbook(f'{U}/62c311df-movements-592026.xls'); sh=wb.sheet_by_index(0)
for r in range(4, sh.nrows):
    v=[sh.cell_value(r,c) for c in range(sh.ncols)]
    if not isinstance(v[0],float): continue
    rows2.append({'fichero':'ING_XLS','banco':'ING','cuenta':'ES?? 1465 0100 9917 1372 0331','fecha':xd(v[0]),'fecha_valor':xd(v[0]),'concepto':str(v[3]).strip(),'importe':float(v[5]),'saldo':float(v[6]),'ref1':str(v[1]).strip(),'ref2':str(v[2]).strip()})
# 8 · BBVA XLSX
import openpyxl
wb=openpyxl.load_workbook(f'{U}/a9587cfd-2026Y-09M-05D-01_55_46-_ltimos_movimientos.xlsx', data_only=True); sh=wb.worksheets[0]
for row in sh.iter_rows(values_only=True):
    v=['' if x is None else x for x in row]
    if not re.match(r'^\d\d/\d\d/\d{4}$', str(v[1])): continue
    rows2.append({'fichero':'BBVA_XLSX','banco':'BBVA','cuenta':'BBVA (IBAN no consta en el fichero · tarjeta 4940 1211 0023 6701 · préstamo 0182-5322-27-0830842450)','fecha':str(v[2]),'fecha_valor':str(v[1]),'concepto':(str(v[3]).strip()+' · '+str(v[4]).strip()).strip(' ·'),'importe':float(v[5]),'saldo':float(v[7]),'ref1':str(v[9]).strip(),'ref2':''})
# 9 · SABADELL XLS #2
wb=xlrd.open_workbook(f'{U}/31bb0487-05092026_2706_0003239635.xls'); sh=wb.sheet_by_index(0)
for r in range(9, sh.nrows):
    v=[sh.cell_value(r,c) for c in range(sh.ncols)]
    if not re.match(r'^\d\d/\d\d/\d{4}$', str(v[0])): continue
    rows2.append({'fichero':'SABADELL_XLS_2','banco':'Sabadell','cuenta':'ES47 0081 2706 1500 0323 9635','fecha':v[0],'fecha_valor':v[2],'concepto':str(v[1]).strip(),'importe':float(v[3]),'saldo':float(v[4]),'ref1':str(v[5]).strip(),'ref2':str(v[6]).strip()})
for f in ['UNICAJA_XLS_FULL','UNICAJA_PDF_6','ING_XLS','BBVA_XLSX','SABADELL_XLS_2']:
    rs=[r for r in rows2 if r['fichero']==f]
    if f!='UNICAJA_PDF_6': rs=list(reversed(rs))
    bad=0
    for a,b in zip(rs,rs[1:]):
        if abs(round(a['saldo']+b['importe'],2)-round(b['saldo'],2))>0.011: bad+=1; print('  SALDO BREAK',f,a['fecha'],a['saldo'],'->',b['fecha'],b['concepto'][:40],b['importe'],b['saldo'])
    print(f,len(rs),'movs · saldo breaks:',bad,'· first',rs[0]['fecha'],'last',rs[-1]['fecha'])
allrows=rows+rows2
for i,r in enumerate(allrows): r['id']=i+1
with open('movimientos.csv','w',newline='') as fh:
    w=csv.DictWriter(fh, fieldnames=['id','fichero','banco','cuenta','fecha','fecha_valor','concepto','importe','saldo','ref1','ref2']); w.writeheader(); w.writerows(allrows)
print('TOTAL 9 ficheros:',len(allrows))
# duplicados entre ficheros (misma cuenta · misma fecha · mismo importe · mismo saldo · mismo concepto normalizado)
import collections
key=lambda r:(r['cuenta'],r['fecha'],round(r['importe'],2),round(r['saldo'],2))
g=collections.defaultdict(list)
for r in allrows: g[key(r)].append(r['fichero'])
dup=sum(1 for k,v in g.items() if len(v)>1)
print('claves con >1 fichero:',dup,'· movimientos ÚNICOS (dedup por cuenta+fecha+importe+saldo):',len(g))
