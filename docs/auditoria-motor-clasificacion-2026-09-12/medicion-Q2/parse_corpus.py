import re, json, datetime, sys
R='/tmp/claude-0/-home-user-ultimointento/b09a8ec1-b131-5948-b88c-6929826bb6b8/scratchpad/raw/'
Q='/tmp/claude-0/-home-user-ultimointento/b09a8ec1-b131-5948-b88c-6929826bb6b8/scratchpad/q2/'
def es_num(s): return float(s.replace('.','').replace(',','.'))
def iso(d):
    dd,mm,yy=d.split('/'); return f'{yy}-{mm}-{dd}'
def serial(s):
    return (datetime.date(1899,12,30)+datetime.timedelta(days=int(float(s)))).isoformat()
out=[]; stats={}
# 1 Santander PDF
MAIN=re.compile(r'^(\d{2}/\d{2}/\d{4}) (.*?) (-?\d{1,3}(?:\.\d{3})*,\d{2}) EUR (-?\d{1,3}(?:\.\d{3})*,\d{2}) EUR\s*$')
FV=re.compile(r'^Fecha valor: (\d{2}/\d{2}/\d{4})\s?(.*)$')
HDR=('=== PAGE','TITULAR:','CUENTA SANTANDER:','Saldo:','Movimientos de cuenta','Fecha operación','Documento impreso')
cur=None; n=0; skipped=[]
for ln in open(R+'pdf_transactions.txt',encoding='utf-8'):
    ln=ln.rstrip('\n')
    if not ln.strip() or ln.startswith(HDR): continue
    m=MAIN.match(ln)
    if m:
        cur={'fichero':'santander_pdf','fecha':iso(m.group(1)),'concepto':m.group(2).strip(),'importe':es_num(m.group(3)),'referencia1':'','referencia2':''}
        out.append(cur); n+=1; continue
    f=FV.match(ln)
    if f:
        if cur is not None:
            cur['fechaValor']=iso(f.group(1))
            if f.group(2).strip(): cur['concepto']+=' '+f.group(2).strip()
        continue
    if cur is not None: cur['concepto']+=' '+ln.strip()
    else: skipped.append(ln)
stats['santander_pdf']=n; print('santander_pdf: lineas',n,'skipped',skipped)
# 2 Unicaja PDF
U=re.compile(r'^(\d{2}/\d{2}/\d{4}) (\d{2}/\d{2}/\d{4}) (.*?) (-?\d{1,3}(?:\.\d{3})*,\d{2}) EUR (-?\d{1,3}(?:\.\d{3})*,\d{2}) EUR (\d+) (\d{4})\s*$')
n=0; nomatch=[]
for ln in open(R+'pdf_listado7.txt',encoding='utf-8'):
    ln=ln.rstrip('\n'); m=U.match(ln)
    if m:
        out.append({'fichero':'unicaja_pdf','fecha':iso(m.group(1)),'fechaValor':iso(m.group(2)),'concepto':m.group(3).strip(),'importe':es_num(m.group(4)),'referencia1':'','referencia2':'','nmov':m.group(6)}); n+=1
    elif re.match(r'^\d{2}/\d{2}/\d{4}',ln): nomatch.append(ln)
stats['unicaja_pdf']=n; print('unicaja_pdf: lineas',n,'no-match con fecha:',nomatch)
# 3 Unicaja XLS
n=0
for ln in open(R+'xls_4437.txt',encoding='utf-8'):
    c=[x.strip() for x in ln.rstrip('\n').split(' | ')]
    if len(c)<4 or not re.match(r'^\d+\.0$',c[0]): continue
    out.append({'fichero':'unicaja_xls','fecha':serial(c[0]),'fechaValor':serial(c[1]),'concepto':re.sub(r'\s+',' ',c[2]),'conceptoBruto':c[2],'importe':float(c[3]),'referencia1':'','referencia2':'','nmov':c[7]}); n+=1
stats['unicaja_xls']=n; print('unicaja_xls: lineas',n)
# 4 Sabadell XLS
n=0
for ln in open(R+'xls_sabadell.txt',encoding='utf-8'):
    c=[x.strip() for x in ln.rstrip('\n').split(' | ')]
    if len(c)<7 or not re.match(r'^\d{2}/\d{2}/\d{4}$',c[0]): continue
    out.append({'fichero':'sabadell_xls','fecha':iso(c[0]),'fechaValor':iso(c[2]),'concepto':c[1],'importe':float(c[3]),'referencia1':c[5],'referencia2':c[6]}); n+=1
stats['sabadell_xls']=n; print('sabadell_xls: lineas',n)
json.dump(out,open(Q+'corpus.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
print('TOTAL',len(out),stats)
# sanity: overlap unicaja pdf vs xls por nmov
pdf={x['nmov'] for x in out if x['fichero']=='unicaja_pdf'}; xls={x['nmov'] for x in out if x['fichero']=='unicaja_xls'}
print('unicaja nmov solapados pdf∩xls:',len(pdf&xls),'de xls',len(xls))
