import React, { useState } from 'react';
import {
  PageHead,
  TabsUnderline,
  CardV5,
  KPIStrip,
  KPI,
  HeroBanner,
  UploadZone,
  EmptyState,
  ToastHost,
  showToastV5,
  Pill,
  MoneyValue,
  DateLabel,
  IconButton,
  Icons,
} from '../../design-system/v5';
import styles from './ComponentsShowcase.module.css';

const ComponentsShowcase: React.FC = () => {
  const [tab, setTab] = useState<'evolucion' | 'balances' | 'movimientos'>('balances');
  const [scenario, setScenario] = useState<'alquiler' | 'propia'>('propia');

  return (
    <div className={styles.page}>
      <ToastHost />

      <header className={styles.header}>
        <h1>Atlas · Design System v5 · Showcase</h1>
        <p className={styles.lead}>
          Página interna de validación visual. Sólo accesible en desarrollo.
          Cada bloque corresponde a un componente de la biblioteca v5 con
          todas sus variantes lado a lado.
        </p>
        <div className={styles.devNotice}>
          DEV ONLY · esta página no se sirve en producción · ruta `/dev/components`.
        </div>
      </header>

      {/* ========== PageHead ========== */}
      <section className={styles.section}>
        <h2>PageHead</h2>
        <p className={styles.desc}>
          Variantes · sin breadcrumb (landing) · con breadcrumb · con tabs.
        </p>

        <span className={styles.variantLabel}>variant=&quot;landing&quot;</span>
        <PageHead
          title="Tesorería"
          sub={
            <>
              datos al cierre de <strong>abril 2026</strong> · revisado <strong>hoy</strong>
            </>
          }
          actions={[
            { label: 'Exportar', variant: 'ghost', icon: <Icons.Download size={14} strokeWidth={2} /> },
            {
              label: 'Subir extracto',
              variant: 'gold',
              icon: <Icons.Upload size={14} strokeWidth={2} />,
              onClick: () => showToastV5('Acción · Subir extracto'),
            },
          ]}
        />

        <span className={styles.variantLabel}>variant=&quot;breadcrumb&quot;</span>
        <PageHead
          breadcrumb={[
            { label: 'Mi Plan', onClick: () => undefined },
            { label: 'Objetivos' },
          ]}
          onBack={() => showToastV5('Volver a Mi Plan')}
          title="Objetivos"
          sub="cuatro metas activas · objetivo principal libertad financiera 2040"
          actions={[
            { label: 'Nuevo objetivo', variant: 'gold', icon: <Icons.Plus size={14} strokeWidth={2.2} /> },
          ]}
        />

        <span className={styles.variantLabel}>variant=&quot;with-tabs&quot;</span>
        <PageHead
          title="Tesorería"
          sub="3 cuentas activas · saldo agregado al cierre de abril"
          actions={[
            {
              label: 'Subir extracto',
              variant: 'gold',
              icon: <Icons.Upload size={14} strokeWidth={2} />,
            },
          ]}
          tabsSlot={
            <TabsUnderline
              items={[
                { key: 'evolucion', label: 'Evolución', icon: <Icons.Proyeccion size={14} /> },
                { key: 'balances', label: 'Balances', icon: <Icons.Tesoreria size={14} /> },
                { key: 'movimientos', label: 'Movimientos', icon: <Icons.Archivo size={14} /> },
              ]}
              active={tab}
              onChange={setTab}
            />
          }
        />
      </section>

      {/* ========== TabsUnderline aislado ========== */}
      <section className={styles.section}>
        <h2>TabsUnderline</h2>
        <p className={styles.desc}>5 sub-módulos con iconos · 1 activa · border-bottom oro.</p>
        <TabsUnderline
          items={[
            { key: 'proyeccion', label: 'Proyección', icon: <Icons.Proyeccion size={14} /> },
            { key: 'libertad', label: 'Libertad financiera', icon: <Icons.Libertad size={14} /> },
            { key: 'objetivos', label: 'Objetivos', icon: <Icons.Objetivos size={14} /> },
            { key: 'fondos', label: 'Fondos de ahorro', icon: <Icons.Fondos size={14} /> },
            { key: 'retos', label: 'Retos', icon: <Icons.Retos size={14} /> },
          ]}
          active="libertad"
          onChange={(k) => showToastV5(`Cambiar a ${k}`)}
        />
      </section>

      {/* ========== CardV5 ========== */}
      <section className={styles.section}>
        <h2>CardV5</h2>
        <p className={styles.desc}>
          Variantes de borde superior por dominio · navy · oro · oro suave · pos · neg · warn · neutral · sin acento.
        </p>
        <div className={styles.gridThree}>
          <CardV5 accent="brand">
            <CardV5.Title>Compromisos · sin acento</CardV5.Title>
            <CardV5.Subtitle>card-tit con accent &quot;brand&quot; (navy)</CardV5.Subtitle>
            <CardV5.Body>
              <span style={{ fontSize: 'var(--atlas-v5-fs-sub)' }}>
                Padding 16/20 · borde superior 3px navy.
              </span>
            </CardV5.Body>
          </CardV5>
          <CardV5 accent="gold">
            <CardV5.Title>Pregunta-meta</CardV5.Title>
            <CardV5.Subtitle>card-tit con accent &quot;gold&quot;</CardV5.Subtitle>
            <CardV5.Body>
              <span style={{ fontSize: 'var(--atlas-v5-fs-sub)' }}>
                Solo UNA card por landing puede llevar oro fuerte.
              </span>
            </CardV5.Body>
          </CardV5>
          <CardV5 accent="gold-soft">
            <CardV5.Title>Reforma FA32</CardV5.Title>
            <CardV5.Subtitle>card-tit con accent &quot;gold-soft&quot;</CardV5.Subtitle>
          </CardV5>
          <CardV5 accent="pos">
            <CardV5.Title>Cumplido</CardV5.Title>
            <CardV5.Subtitle>card-tit con accent &quot;pos&quot;</CardV5.Subtitle>
          </CardV5>
          <CardV5 accent="neg">
            <CardV5.Title>Vacío crítico</CardV5.Title>
            <CardV5.Subtitle>card-tit con accent &quot;neg&quot;</CardV5.Subtitle>
          </CardV5>
          <CardV5 accent="warn">
            <CardV5.Title>En riesgo</CardV5.Title>
            <CardV5.Subtitle>card-tit con accent &quot;warn&quot;</CardV5.Subtitle>
          </CardV5>
          <CardV5 accent="neutral">
            <CardV5.Title>Sin meta asociada</CardV5.Title>
            <CardV5.Subtitle>card-tit con accent &quot;neutral&quot;</CardV5.Subtitle>
          </CardV5>
          <CardV5>
            <CardV5.Title>Card base</CardV5.Title>
            <CardV5.Subtitle>sin accent · solo borde gris</CardV5.Subtitle>
          </CardV5>
          <CardV5 accent="gold-soft" clickable onClick={() => showToastV5('Click en card · gold-soft')}>
            <CardV5.Title>Clickable + hover</CardV5.Title>
            <CardV5.Subtitle>cursor pointer · translateY(-1px) hover · §15.2</CardV5.Subtitle>
          </CardV5>
        </div>
      </section>

      {/* ========== KPIStrip ========== */}
      <section className={styles.section}>
        <h2>KPIStrip · 3 cols</h2>
        <p className={styles.desc}>
          Banda con separadores verticales · sin gap · §7.3 · 4 reglas críticas aplicadas.
        </p>
        <KPIStrip>
          <KPI
            label="Saldo agregado"
            value={<MoneyValue value={48230.55} size="kpi" tone="brand" decimals={0} />}
            sub="al cierre de abril 2026"
          />
          <KPI
            label="Cashflow mes"
            value={<MoneyValue value={1707.4} size="kpi" tone="pos" decimals={0} />}
            sub="rentas · gastos · cuotas"
          />
          <KPI
            label="Próximo cargo"
            value={<DateLabel value="2026-05-04" format="compact" bold />}
            sub="hipoteca FA32 · 510 €"
          />
        </KPIStrip>

        <h2 style={{ marginTop: 'var(--atlas-v5-sp-9)' }}>KPIStrip · 4 cols</h2>
        <KPIStrip>
          <KPI label="Patrimonio neto" value={<MoneyValue value={534820} size="kpi" decimals={0} tone="brand" />} sub="post-deuda · post-fiscal" />
          <KPI label="Renta pasiva" value={<MoneyValue value={1707} size="kpi" decimals={0} tone="pos" />} sub="rentas - gastos sostenibles" />
          <KPI label="Capacidad ahorro" value={<MoneyValue value={1350} size="kpi" decimals={0} tone="gold" />} sub="planificada para 2026" />
          <KPI label="Libertad" value="49%" tone="gold" sub="proyección 2040 · en 14 años" />
        </KPIStrip>

        <h2 style={{ marginTop: 'var(--atlas-v5-sp-9)' }}>KPIStrip · variante estrella</h2>
        <KPIStrip columns={4}>
          <KPI star starAccent="brand" label="Inmuebles" value={<MoneyValue value={415000} size="kpiStar" decimals={0} tone="brand" />} sub="5 inmuebles · valoración" />
          <KPI star starAccent="gold" label="Renta pasiva neta" value={<MoneyValue value={1707} size="kpiStar" decimals={0} tone="gold" />} sub="objetivo libertad" />
          <KPI star starAccent="pos" label="Rentabilidad" value="6,3%" tone="pos" sub="bruta media inmuebles" />
          <KPI star starAccent="warn" label="Sin asignar" value={<MoneyValue value={1240} size="kpiStar" decimals={0} tone="warn" />} sub="movimientos pendientes" />
        </KPIStrip>
      </section>

      {/* ========== HeroBanner ========== */}
      <section className={styles.section}>
        <h2>HeroBanner · 4 variantes</h2>

        <span className={styles.variantLabel}>variant=&quot;compact&quot; · landing</span>
        <HeroBanner
          variant="compact"
          tag="Estimada · al cierre de abr 2026"
          title={
            <>
              Estás a <strong>49%</strong> de tu libertad financiera, José Antonio
            </>
          }
          sub="proyección punto cruce 2040 · en 14 años"
          stats={[
            { label: 'Renta pasiva', value: '1.707 €/mes' },
            { label: 'Gastos vida', value: '3.500 €/mes' },
            { label: 'Inmuebles', value: '5 · 415 k€' },
            { label: 'Capacidad ahorro', value: '1.350 €/mes' },
          ]}
          ctaLabel={<>Abrir Mi Plan <Icons.ArrowRight size={14} strokeWidth={2} /></>}
          onCta={() => showToastV5('Saltar a Mi Plan')}
        />

        <span className={styles.variantLabel}>variant=&quot;toggle&quot; · escenario</span>
        <HeroBanner
          variant="toggle"
          tag="Escenarios"
          title={
            <>
              Compara escenarios para tu camino a la libertad
            </>
          }
          sub="alquilar en Madrid vs comprar casa propia · objetivo 2040"
          toggleLabel="Escenario"
          options={[
            { key: 'alquiler', label: 'Alquiler en Madrid', icon: <Icons.Compra size={14} /> },
            { key: 'propia', label: 'Casa propia (objetivo)', icon: <Icons.Colchon size={14} /> },
          ]}
          active={scenario}
          onChange={(key) => setScenario(key as 'alquiler' | 'propia')}
          toggleInfo={
            <>
              <strong>4.030 €/mes</strong> en el cruce
            </>
          }
        />

        <span className={styles.variantLabel}>variant=&quot;progress&quot; · reto activo</span>
        <HeroBanner
          variant="progress"
          tag="Reto activo · abr 2026"
          title="Cancelar 4 suscripciones que no usas"
          sub="ahorro estimado · 67 €/mes · 804 €/año"
          percent={75}
          prominent={<>3 / 4 canceladas</>}
          meta={{ left: '11 días restantes', right: '67 € ahorrados' }}
        />

        <span className={styles.variantLabel}>variant=&quot;chart&quot; · proyección</span>
        <HeroBanner
          variant="chart"
          tag="Trayectoria · 2026 → 2040"
          title="Renta pasiva vs Gastos vida"
          sub="cruce previsto · 2040 · 4.030 €/mes"
          legend={[
            { label: 'Renta pasiva', colorVar: '--atlas-v5-pos' },
            { label: 'Gastos vida', colorVar: '--atlas-v5-brand' },
            { label: 'Punto libertad', colorVar: '--atlas-v5-gold' },
          ]}
        >
          <svg viewBox="0 0 1200 320" style={{ width: '100%', minWidth: 920, display: 'block' }} role="img" aria-label="Trayectoria libertad">
            <path d="M 80 120 L 320 110 L 560 100 L 800 92 L 920 88 L 1160 80" fill="none" stroke="var(--atlas-v5-brand)" strokeWidth="2.5" />
            <path d="M 80 230 L 260 220 L 440 175 L 620 155 L 800 145 L 920 88 L 1160 65" fill="none" stroke="var(--atlas-v5-pos)" strokeWidth="2.8" />
            <line x1="920" y1="32" x2="920" y2="290" stroke="var(--atlas-v5-gold)" strokeDasharray="4 4" opacity="0.55" />
            <circle cx="920" cy="88" r="9" fill="var(--atlas-v5-gold)" stroke="var(--atlas-v5-white)" strokeWidth="2" />
            <text x="1148" y="78" textAnchor="end" fontSize="11" fill="var(--atlas-v5-ink-3)" fontFamily="var(--atlas-v5-font-mono-num)">4.030 €/mes</text>
          </svg>
        </HeroBanner>
      </section>

      {/* ========== UploadZone ========== */}
      <section className={styles.section}>
        <h2>UploadZone</h2>
        <p className={styles.desc}>Drag-drop con borde dashed oro · soporta teclado.</p>
        <UploadZone
          sub="Formatos · CSV · XLSX · PDF · máx 10 MB por archivo"
          accept=".csv,.xlsx,.pdf"
          multiple
          onFiles={(files) => showToastV5(`Subidos · ${files.length} archivo(s)`, 'success')}
        />
      </section>

      {/* ========== EmptyState ========== */}
      <section className={styles.section}>
        <h2>EmptyState</h2>
        <p className={styles.desc}>Bloque dashed centrado · §9.3.</p>
        <div className={styles.gridTwo}>
          <EmptyState
            icon={<Icons.Fondos size={18} />}
            title="Aún no hay cuenta asignada a este fondo"
            sub="Asocia una cuenta para que el fondo se alimente automáticamente al recibir movimientos."
            ctaLabel="+ asigna una cuenta para alimentar este fondo"
            onCtaClick={() => showToastV5('Abrir asignación de cuenta')}
          />
          <EmptyState
            compact
            title="Sin movimientos pendientes"
            sub="Todos los movimientos del periodo están punteados."
          />
        </div>
      </section>

      {/* ========== Toast ========== */}
      <section className={styles.section}>
        <h2>Toast · 4 variantes</h2>
        <p className={styles.desc}>
          API imperativa · `showToastV5(msg, variant)`. Click los botones para ver cada variante.
        </p>
        <div className={styles.row}>
          <button
            type="button"
            className="atlas-v5-demo-btn"
            onClick={() => showToastV5('Inmueble FA32 actualizado', 'success')}
            style={demoBtn}
          >
            success
          </button>
          <button
            type="button"
            onClick={() => showToastV5('Compromiso vence en 3 días', 'warn')}
            style={demoBtn}
          >
            warn
          </button>
          <button
            type="button"
            onClick={() => showToastV5('No se pudo subir el extracto', 'error')}
            style={demoBtn}
          >
            error
          </button>
          <button
            type="button"
            onClick={() => showToastV5('5 movimientos importados desde Sabadell')}
            style={demoBtn}
          >
            info (default)
          </button>
        </div>
      </section>

      {/* ========== Pill ========== */}
      <section className={styles.section}>
        <h2>Pill</h2>
        <p className={styles.desc}>Chips por dominio · §10 estados visuales.</p>
        <div className={styles.row}>
          <Pill variant="brand">En progreso</Pill>
          <Pill variant="gold">Libertad</Pill>
          <Pill variant="pos">Cumplido</Pill>
          <Pill variant="warn">En riesgo</Pill>
          <Pill variant="neg">Vacío crítico</Pill>
          <Pill variant="gris">En pausa</Pill>
          <Pill asTag variant="gris">PRESTAMO 510280492</Pill>
          <Pill asTag variant="gold">OBJ-01</Pill>
        </div>
      </section>

      {/* ========== MoneyValue ========== */}
      <section className={styles.section}>
        <h2>MoneyValue</h2>
        <p className={styles.desc}>JetBrains Mono · tabular-nums · color por signo si tone=&quot;auto&quot;.</p>
        <div className={styles.col}>
          <span className={styles.variantLabel}>tone=&quot;auto&quot; · signo</span>
          <div className={styles.row}>
            <MoneyValue value={1707.4} />
            <MoneyValue value={-510.85} />
            <MoneyValue value={0} />
            <MoneyValue value={2350} showSign />
            <MoneyValue value={-145.2} showSign />
          </div>
          <span className={styles.variantLabel}>size=&quot;kpi&quot; · tonos · sin decimales</span>
          <div className={styles.row}>
            <MoneyValue value={48230} size="kpi" decimals={0} tone="brand" />
            <MoneyValue value={1707} size="kpi" decimals={0} tone="pos" />
            <MoneyValue value={-3500} size="kpi" decimals={0} tone="neg" />
            <MoneyValue value={1350} size="kpi" decimals={0} tone="gold" />
            <MoneyValue value={1240} size="kpi" decimals={0} tone="warn" />
          </div>
          <span className={styles.variantLabel}>size=&quot;kpiStar&quot;</span>
          <div className={styles.row}>
            <MoneyValue value={534820} size="kpiStar" decimals={0} tone="brand" />
          </div>
        </div>
      </section>

      {/* ========== DateLabel ========== */}
      <section className={styles.section}>
        <h2>DateLabel</h2>
        <p className={styles.desc}>Formatos canónicos ATLAS · familia mono.</p>
        <div className={styles.row}>
          <DateLabel value="2026-04-27" format="long" />
          <DateLabel value="2026-04-27" format="short" />
          <DateLabel value="2026-04-27" format="compact" />
          <DateLabel value="2027-12-01" format="monthYear" />
          <DateLabel value="2040-01-01" format="year" bold />
          <DateLabel value="invalid" format="short" />
        </div>
      </section>

      {/* ========== IconButton ========== */}
      <section className={styles.section}>
        <h2>IconButton</h2>
        <p className={styles.desc}>4 variantes · 3 tamaños.</p>
        <div className={styles.row}>
          <IconButton ariaLabel="Notificaciones"><Icons.Bell size={16} /></IconButton>
          <IconButton ariaLabel="Ayuda" variant="ghost"><Icons.Help size={16} /></IconButton>
          <IconButton ariaLabel="Subir" variant="primary"><Icons.Upload size={16} /></IconButton>
          <IconButton ariaLabel="Eliminar" variant="danger"><Icons.Delete size={16} /></IconButton>
          <IconButton ariaLabel="Más" size="sm" variant="ghost"><Icons.More size={14} /></IconButton>
          <IconButton ariaLabel="Editar" size="lg" variant="ghost"><Icons.Edit size={18} /></IconButton>
          <IconButton ariaLabel="Bloqueado" disabled variant="ghost"><Icons.Lock size={16} /></IconButton>
        </div>
      </section>
    </div>
  );
};

const demoBtn: React.CSSProperties = {
  padding: '8px 13px',
  borderRadius: 'var(--atlas-v5-radius-sm)',
  border: '1px solid var(--atlas-v5-line)',
  background: 'var(--atlas-v5-card)',
  color: 'var(--atlas-v5-ink-2)',
  fontFamily: 'var(--atlas-v5-font-ui)',
  fontSize: 'var(--atlas-v5-fs-sub)',
  fontWeight: 600,
  cursor: 'pointer',
};

export default ComponentsShowcase;
