export type ScenarioMode = 'diy' | 'strategies' | 'objectives';
export type ScenarioRiskLevel = 'bajo' | 'medio' | 'alto';
export type ScenarioActionStatus = 'prioritario' | 'programado' | 'evaluar';
export type ScenarioActionPriority = 'alta' | 'media' | 'baja';
export type QuickWinIcon = 'TrendingUp' | 'ShieldCheck' | 'Banknote' | 'Sparkles' | 'Timer';

export interface SnapshotMetric {
  id: string;
  label: string;
  value: string;
  helper?: string;
}

export interface SnapshotData {
  headline: string;
  narrative: string;
  metrics: SnapshotMetric[];
}

export interface QuickWin {
  id: string;
  title: string;
  description: string;
  impact: string;
  icon: QuickWinIcon;
}

export interface UseCaseFilter {
  id: string;
  label: string;
  description: string;
}

export interface ScenarioKeyMetric {
  id: string;
  label: string;
  value: string;
  deltaLabel: string;
  trend: 'up' | 'down' | 'neutral';
  helper?: string;
}

export interface ScenarioActionStep {
  id: string;
  title: string;
  description: string;
  timeframe: string;
  investment: string;
  cashflowImpact: string;
  netWorthImpact?: string;
  status: ScenarioActionStatus;
  priority: ScenarioActionPriority;
}

export interface ScenarioStressTest {
  id: string;
  label: string;
  assumptionChange: string;
  impact: string;
  riskLevel: ScenarioRiskLevel;
  guardrail: string;
}

export interface ScenarioGuardrail {
  id: string;
  title: string;
  description: string;
}

export interface ScenarioMilestone {
  id: string;
  period: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
}

export interface ScenarioDetail {
  headline: string;
  description: string;
  objective: string;
  timeframe: string;
  profile: string;
  keyMetrics: ScenarioKeyMetric[];
  actionPlan: ScenarioActionStep[];
  stressTests: ScenarioStressTest[];
  guardrails: ScenarioGuardrail[];
  timeline: ScenarioMilestone[];
  multiUseNotes: string[];
}

export interface ScenarioSummary {
  id: string;
  name: string;
  mode: ScenarioMode;
  tagline: string;
  objective: string;
  horizon: string;
  capitalRequired: string;
  irr: string;
  payback: string;
  cashflowDelta: string;
  netWorthDelta: string;
  riskLevel: ScenarioRiskLevel;
  dscrFloor: string;
  useCases: string[];
  isPinned: boolean;
  markedForComparison: boolean;
  detail: ScenarioDetail;
}

export interface EscenariosDashboardData {
  snapshot: SnapshotData;
  quickWins: QuickWin[];
  useCases: UseCaseFilter[];
  scenarios: ScenarioSummary[];
}

const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

const initialDashboard: EscenariosDashboardData = {
  snapshot: {
    headline: 'Objetivo: +2.000 €/mes y compra objetivo Q2 2026',
    narrative:
      'Tu cartera actual genera 3.825 € netos/mes con un DSCR de 1,42x. El foco es ganar holgura en el cashflow, reducir riesgo de deuda y preparar liquidez para una compra estratégica en 24 meses.',
    metrics: [
      {
        id: 'cashflow-base',
        label: 'Cashflow neto anual base',
        value: '€45.900',
        helper: 'Equivale a €3.825/mes',
      },
      {
        id: 'networth-base',
        label: 'Patrimonio neto estimado actual',
        value: '€1,24M',
        helper: '68% loan-to-value consolidado',
      },
      {
        id: 'dscr-base',
        label: 'DSCR medio actual',
        value: '1,42x',
        helper: 'Objetivo mínimo 1,35x',
      },
      {
        id: 'reserves',
        label: 'Colchón de liquidez',
        value: '4,2 meses',
        helper: 'Reserva objetivo 6 meses',
      },
    ],
  },
  quickWins: [
    {
      id: 'rents',
      title: 'Optimizar rentas en 3 unidades',
      description: 'Actualiza comparables y renegocia contratos con +12% potencial.',
      impact: '+€3.600/año',
      icon: 'TrendingUp',
    },
    {
      id: 'reserve',
      title: 'Fondo de reserva 6 meses',
      description: 'Automatiza transferencia de €1.500/mes hasta alcanzar €23.000.',
      impact: 'Objetivo: €23.000',
      icon: 'ShieldCheck',
    },
    {
      id: 'debt',
      title: 'Plan de amortización selectiva',
      description: 'Identifica hipoteca con tipo 5,3% y amortiza €45.000 en Q3.',
      impact: '-€4.800/año en intereses',
      icon: 'Banknote',
    },
    {
      id: 'agenda',
      title: 'Revisión trimestral de supuestos',
      description: 'Bloquea agenda 90 minutos cada trimestre para actualizar datos.',
      impact: 'Próxima: 12 de septiembre',
      icon: 'Timer',
    },
  ],
  useCases: [
    {
      id: 'rentabilidad',
      label: 'Mejorar rentabilidad',
      description: 'Subir cashflow sin ampliar cartera de inmediato.',
    },
    {
      id: 'expansion',
      label: 'Expandir cartera',
      description: 'Preparar compra con equity existente y deuda sostenible.',
    },
    {
      id: 'liquidez',
      label: 'Generar liquidez',
      description: 'Rotar activos de bajo rendimiento y liberar capital.',
    },
    {
      id: 'jubilacion',
      label: 'Objetivo independencia',
      description: 'Dar visibilidad a hitos hacia libertad financiera.',
    },
  ],
  scenarios: [
    {
      id: 'cashflow_boost',
      name: 'Cashflow Boost 24m',
      mode: 'strategies',
      tagline: 'Sube cashflow +2.100 €/mes y prepara compra 2026',
      objective: 'Aumentar rentabilidad neta manteniendo riesgo bajo control.',
      horizon: '24 meses',
      capitalRequired: '€85.000',
      irr: '11,8% TIR proyecto',
      payback: '3,4 años payback',
      cashflowDelta: '+€25.200/año vs base',
      netWorthDelta: '+€180.000 en 5 años',
      riskLevel: 'medio',
      dscrFloor: '1,35x mínimo',
      useCases: ['rentabilidad', 'expansion'],
      isPinned: true,
      markedForComparison: true,
      detail: {
        headline: 'Incrementa el cashflow a €5.925/mes manteniendo DSCR > 1,35x',
        description:
          'Plan en cuatro fases combinando renegociación de rentas, capex ligero, amortización selectiva y reinversión en un activo prime. Prioriza liquidez y control de riesgos.',
        objective: 'Lograr +€2.100/mes netos adicionales y liberar capacidad para compra objetivo Q2 2026.',
        timeframe: '24 meses (4 fases trimestrales)',
        profile: 'Propietario con 12 activos residenciales, riesgo medio y acceso a financiación bancaria local.',
        keyMetrics: [
          {
            id: 'metric-cashflow',
            label: 'Cashflow neto anual proyectado',
            value: '€71.100',
            deltaLabel: '+€25.200 vs base',
            trend: 'up',
            helper: 'Equivale a €5.925/mes',
          },
          {
            id: 'metric-networth',
            label: 'Patrimonio neto estimado a 5 años',
            value: '€1,42M',
            deltaLabel: '+€180.000 vs base',
            trend: 'up',
            helper: 'Incluye revalorización 3,2% y nueva compra',
          },
          {
            id: 'metric-dscr',
            label: 'DSCR medio proyectado',
            value: '1,52x',
            deltaLabel: '+0,10 pts',
            trend: 'up',
            helper: 'Nunca baja de 1,35x',
          },
          {
            id: 'metric-vacancy',
            label: 'Vacancia objetivo',
            value: '4,5%',
            deltaLabel: '-1,5 pts',
            trend: 'up',
            helper: 'Plan de rotación de inquilinos 2024-2025',
          },
        ],
        actionPlan: [
          {
            id: 'step-1',
            title: 'Renegociar 3 contratos clave',
            description: 'Unidades A3, B1 y C2 con potencial +12% rentas. Apóyate en comparables y oferta de valor.',
            timeframe: 'Mes 0-2',
            investment: '€0',
            cashflowImpact: '+€9.600/año',
            netWorthImpact: '+€15.000 valor presente',
            status: 'prioritario',
            priority: 'alta',
          },
          {
            id: 'step-2',
            title: 'Capex ligero en unidad B4',
            description: 'Mejora cocina + pintura. Revalorización esperada €25k.',
            timeframe: 'Mes 3-6',
            investment: '€12.000',
            cashflowImpact: '+€3.000/año',
            netWorthImpact: '+€25.000 equity',
            status: 'programado',
            priority: 'media',
          },
          {
            id: 'step-3',
            title: 'Amortización anticipada hipoteca Centro',
            description: 'Aplicar €45.000 a hipoteca al 5,3%. Reduce cuota y libera deuda futura.',
            timeframe: 'Mes 6-9',
            investment: '€45.000',
            cashflowImpact: '+€4.800/año',
            netWorthImpact: '+€45.000 equity inmediato',
            status: 'prioritario',
            priority: 'alta',
          },
          {
            id: 'step-4',
            title: 'Venta de local con bajo rendimiento',
            description: 'Preparar salida del local 1 (yield 2,5%). Utilizar agencia especializada.',
            timeframe: 'Mes 9-15',
            investment: 'Coste agencia 2%',
            cashflowImpact: '+€6.000/año al reinvertir',
            netWorthImpact: '+€60.000 liquidez neta',
            status: 'evaluar',
            priority: 'media',
          },
          {
            id: 'step-5',
            title: 'Compra activo prime 2 habitaciones',
            description: 'Ticket €295k, apalancamiento 65%. Zona con demanda corporativa.',
            timeframe: 'Mes 18-24',
            investment: '€75.000 equity',
            cashflowImpact: '+€16.800/año',
            netWorthImpact: '+€95.000 equity inicial',
            status: 'programado',
            priority: 'alta',
          },
        ],
        stressTests: [
          {
            id: 'stress-1',
            label: 'Vacancia sube al 8%',
            assumptionChange: '+3,5 pts vs supuesto base',
            impact: '-€7.800/año cashflow',
            riskLevel: 'medio',
            guardrail: 'Activa campañas de retención y reforzar reservas a 6 meses.',
          },
          {
            id: 'stress-2',
            label: 'Tipos +150 pb en refinanciación',
            assumptionChange: 'Nuevo préstamo al 4,8%',
            impact: '-€4.200/año',
            riskLevel: 'bajo',
            guardrail: 'Negociar tipo fijo antes de Q3 2025 y comparar 3 entidades.',
          },
          {
            id: 'stress-3',
            label: 'Compra se retrasa 12 meses',
            assumptionChange: 'Entrada a mercado 2027',
            impact: '-€95.000 equity proyectado',
            riskLevel: 'medio',
            guardrail: 'Mantén pipeline alternativo y evalúa co-inversión.',
          },
        ],
        guardrails: [
          {
            id: 'guard-1',
            title: 'DSCR mínimo 1,35x',
            description: 'Detén la compra si el DSCR proyectado cae por debajo de 1,35x.',
          },
          {
            id: 'guard-2',
            title: 'Liquidez 6 meses',
            description: 'No ejecutar amortización si las reservas caen bajo €20.000.',
          },
          {
            id: 'guard-3',
            title: 'Seguimiento trimestral',
            description: 'Actualizar supuestos de rentas, vacancia y costes cada trimestre.',
          },
        ],
        timeline: [
          {
            id: 'milestone-1',
            period: 'Trimestre 1 (2024)',
            summary: 'Cerrar renegociaciones y lanzar mejoras B4.',
            metrics: [
              { label: 'Cashflow', value: '€49.200/año' },
              { label: 'DSCR', value: '1,46x' },
            ],
          },
          {
            id: 'milestone-2',
            period: 'Trimestre 3 (2025)',
            summary: 'Ejecutar amortización y preparar venta local.',
            metrics: [
              { label: 'Cashflow', value: '€56.400/año' },
              { label: 'DSCR', value: '1,50x' },
            ],
          },
          {
            id: 'milestone-3',
            period: 'Trimestre 2 (2026)',
            summary: 'Compra nuevo activo y estabiliza en 3 meses.',
            metrics: [
              { label: 'Cashflow', value: '€71.100/año' },
              { label: 'Net worth', value: '€1,42M' },
            ],
          },
        ],
        multiUseNotes: [
          'Ideal para inversor con cartera mediana que busca crecer sin asumir riesgo excesivo.',
          'Valido para explicar estrategia a socio financiero o comité de inversión.',
          'Puede adaptarse como plan de liquidez acelerada si se omite la compra final.',
        ],
      },
    },
    {
      id: 'liquidez_defensiva',
      name: 'Liquidez Defensiva 18m',
      mode: 'objectives',
      tagline: 'Libera €150k de liquidez manteniendo cashflow estable',
      objective: 'Reducir exposición a deuda variable y fortalecer reservas.',
      horizon: '18 meses',
      capitalRequired: '€20.000',
      irr: '8,1% TIR proyecto',
      payback: '2,6 años payback',
      cashflowDelta: '+€9.300/año vs base',
      netWorthDelta: '+€95.000 en 3 años',
      riskLevel: 'bajo',
      dscrFloor: '1,45x mínimo',
      useCases: ['liquidez', 'rentabilidad'],
      isPinned: false,
      markedForComparison: false,
      detail: {
        headline: 'Liquidez inmediata sin sacrificar ingresos',
        description:
          'Secuencia orientada a liberar capital de activos no core, consolidar deuda y reforzar colchón de seguridad. Mantiene crecimiento orgánico moderado.',
        objective: 'Conseguir €150k líquidos y aumentar cashflow neto +€775/mes.',
        timeframe: '18 meses (3 bloques)',
        profile: 'Inversor conservador con cartera diversificada y horizonte 3-5 años.',
        keyMetrics: [
          {
            id: 'metric-cashflow',
            label: 'Cashflow neto anual proyectado',
            value: '€55.200',
            deltaLabel: '+€9.300 vs base',
            trend: 'up',
            helper: '€4.600/mes tras ejecuciones',
          },
          {
            id: 'metric-networth',
            label: 'Liquidez disponible a 12 meses',
            value: '€150.000',
            deltaLabel: '+€95.000 vs base',
            trend: 'up',
            helper: 'Incluye venta de 1 activo y préstamo puente',
          },
          {
            id: 'metric-dscr',
            label: 'DSCR medio proyectado',
            value: '1,60x',
            deltaLabel: '+0,18 pts',
            trend: 'up',
            helper: 'Mayor resiliencia ante shocks',
          },
          {
            id: 'metric-debt',
            label: 'Deuda variable',
            value: '€210.000',
            deltaLabel: '-€95.000 vs base',
            trend: 'up',
            helper: 'Tras amortización dirigida',
          },
        ],
        actionPlan: [
          {
            id: 'liquidez-step-1',
            title: 'Revisar cartera y etiquetar activos no core',
            description: 'Definir qué activos son estratégicos y cuáles se pueden rotar.',
            timeframe: 'Mes 0-1',
            investment: '€0',
            cashflowImpact: '+€1.200/año',
            netWorthImpact: 'Visibilidad inmediata',
            status: 'prioritario',
            priority: 'alta',
          },
          {
            id: 'liquidez-step-2',
            title: 'Negociar refinanciación fija 10 años',
            description: 'Trasladar préstamo variable de edificio Sur a tipo fijo 3,6%.',
            timeframe: 'Mes 2-4',
            investment: '€2.500 gastos',
            cashflowImpact: '+€2.400/año',
            netWorthImpact: 'Estabilidad deuda',
            status: 'programado',
            priority: 'media',
          },
          {
            id: 'liquidez-step-3',
            title: 'Venta parcial de participación comercial',
            description: 'Desinvertir 40% de local comercial y mantener gestión.',
            timeframe: 'Mes 5-9',
            investment: 'Impuestos €6.000',
            cashflowImpact: '+€1.800/año',
            netWorthImpact: '+€80.000 liquidez neta',
            status: 'programado',
            priority: 'alta',
          },
          {
            id: 'liquidez-step-4',
            title: 'Construir fondo de reserva 6 meses',
            description: 'Programar transferencias automáticas mensuales.',
            timeframe: 'Mes 6-12',
            investment: '€12.000',
            cashflowImpact: 'Neutral',
            netWorthImpact: '+€40.000 reserva acumulada',
            status: 'prioritario',
            priority: 'media',
          },
          {
            id: 'liquidez-step-5',
            title: 'Micro-mejoras para subir rentas 6%',
            description: 'Pequeños ajustes en 4 unidades: domótica, amenities.',
            timeframe: 'Mes 10-18',
            investment: '€8.000',
            cashflowImpact: '+€3.900/año',
            netWorthImpact: '+€20.000 valorización',
            status: 'evaluar',
            priority: 'baja',
          },
        ],
        stressTests: [
          {
            id: 'liquidez-stress-1',
            label: 'Retraso en venta comercial',
            assumptionChange: 'Demora 6 meses',
            impact: '-€40.000 liquidez prevista',
            riskLevel: 'medio',
            guardrail: 'Asegurar comprador alternativo y cláusulas de penalización.',
          },
          {
            id: 'liquidez-stress-2',
            label: 'Tipos no bajan',
            assumptionChange: 'Se mantiene 5,3% variable',
            impact: '-€2.400/año',
            riskLevel: 'bajo',
            guardrail: 'Evaluar swap o amortización adicional.',
          },
        ],
        guardrails: [
          {
            id: 'liquidez-guard-1',
            title: 'Liquidez mínima €80.000',
            description: 'No comprometer reservas por debajo de 6 meses de gastos.',
          },
          {
            id: 'liquidez-guard-2',
            title: 'No bajar DSCR < 1,45x',
            description: 'Verificar impacto antes de firmar nuevas deudas.',
          },
        ],
        timeline: [
          {
            id: 'liquidez-milestone-1',
            period: 'Mes 3',
            summary: 'Refinanciación cerrada y contratos ajustados.',
            metrics: [
              { label: 'Cashflow', value: '€49.500/año' },
              { label: 'Liquidez', value: '€45.000' },
            ],
          },
          {
            id: 'liquidez-milestone-2',
            period: 'Mes 9',
            summary: 'Venta parcial ejecutada y reservas reforzadas.',
            metrics: [
              { label: 'Cashflow', value: '€52.800/año' },
              { label: 'Liquidez', value: '€120.000' },
            ],
          },
          {
            id: 'liquidez-milestone-3',
            period: 'Mes 18',
            summary: 'Plan completado, liquidez lista para nuevas oportunidades.',
            metrics: [
              { label: 'Cashflow', value: '€55.200/año' },
              { label: 'DSCR', value: '1,60x' },
            ],
          },
        ],
        multiUseNotes: [
          'Útil como plan puente antes de una expansión mayor o para preparar sucesión.',
          'Se puede presentar a banca como hoja de ruta de desapalancamiento controlado.',
          'Compatible con objetivos de independencia financiera conservadora.',
        ],
      },
    },
    {
      id: 'growth_agresivo',
      name: 'Crecimiento Acelerado 36m',
      mode: 'strategies',
      tagline: 'Duplica el cashflow en 3 años con rotación y co-inversión',
      objective: 'Escalar cartera con socios sin comprometer estabilidad.',
      horizon: '36 meses',
      capitalRequired: '€120.000',
      irr: '15,6% TIR proyecto',
      payback: '4,2 años payback',
      cashflowDelta: '+€38.400/año vs base',
      netWorthDelta: '+€320.000 en 5 años',
      riskLevel: 'alto',
      dscrFloor: '1,30x mínimo',
      useCases: ['expansion', 'jubilacion'],
      isPinned: false,
      markedForComparison: false,
      detail: {
        headline: 'Escala tu cartera con dos adquisiciones y vehículo co-inversión',
        description:
          'Plan agresivo con rotación de activos obsoletos, ampliación de deuda estructurada y entrada de socio capital. Enfocado a duplicar ingresos netos.',
        objective: 'Alcanzar €8.000/mes netos y patrimonio > €1,55M en 36 meses.',
        timeframe: '36 meses (5 hitos)',
        profile: 'Inversor avanzado dispuesto a asumir riesgo controlado con apoyo de gestor.',
        keyMetrics: [
          {
            id: 'growth-metric-cashflow',
            label: 'Cashflow neto anual proyectado',
            value: '€84.300',
            deltaLabel: '+€38.400 vs base',
            trend: 'up',
            helper: '€7.025/mes estabilizado',
          },
          {
            id: 'growth-metric-networth',
            label: 'Patrimonio neto 5 años',
            value: '€1,56M',
            deltaLabel: '+€320.000 vs base',
            trend: 'up',
            helper: 'Incluye co-inversión 30% socio',
          },
          {
            id: 'growth-metric-dscr',
            label: 'DSCR proyectado',
            value: '1,38x',
            deltaLabel: '-0,04 pts',
            trend: 'down',
            helper: 'Se mantiene >1,30x en stress test',
          },
          {
            id: 'growth-metric-occupancy',
            label: 'Ocupación objetivo',
            value: '95%',
            deltaLabel: '+2 pts',
            trend: 'up',
            helper: 'Impulso con marketing digital y gestor externo',
          },
        ],
        actionPlan: [
          {
            id: 'growth-step-1',
            title: 'Crear data room para socios',
            description: 'Estructurar teaser, track record y pipeline.',
            timeframe: 'Mes 0-2',
            investment: '€3.000 asesor',
            cashflowImpact: 'Preparatorio',
            netWorthImpact: 'Posicionamiento para levantar capital',
            status: 'prioritario',
            priority: 'alta',
          },
          {
            id: 'growth-step-2',
            title: 'Venta de 2 activos Clase C',
            description: 'Liberar €110k equity y simplificar gestión.',
            timeframe: 'Mes 3-8',
            investment: 'Costes cierre €9.000',
            cashflowImpact: '+€4.500/año tras reinversión',
            netWorthImpact: '+€110.000 liquidez',
            status: 'programado',
            priority: 'alta',
          },
          {
            id: 'growth-step-3',
            title: 'Compra edificio 6 unidades con socio 30%',
            description: 'Ticket €720k, apalancamiento 70%, plan de reforma 12 meses.',
            timeframe: 'Mes 9-20',
            investment: '€95.000 equity propio',
            cashflowImpact: '+€21.600/año',
            netWorthImpact: '+€180.000 equity proyectado',
            status: 'programado',
            priority: 'alta',
          },
          {
            id: 'growth-step-4',
            title: 'Profesionalizar gestión y marketing',
            description: 'Contratar gestor externo y campañas digitales.',
            timeframe: 'Mes 12-24',
            investment: '€1.200/mes',
            cashflowImpact: '+€6.000/año',
            netWorthImpact: 'Mayor ocupación y rentas',
            status: 'evaluar',
            priority: 'media',
          },
          {
            id: 'growth-step-5',
            title: 'Segunda adquisición con refinanciación global',
            description: 'Usar incremento de valor para comprar activo turístico.',
            timeframe: 'Mes 24-36',
            investment: '€120.000 equity combinado',
            cashflowImpact: '+€28.800/año',
            netWorthImpact: '+€210.000 equity acumulado',
            status: 'programado',
            priority: 'alta',
          },
        ],
        stressTests: [
          {
            id: 'growth-stress-1',
            label: 'Socio se retrasa',
            assumptionChange: 'Aporte 30% llega +4 meses',
            impact: '-€18.000 oportunidad alquiler',
            riskLevel: 'alto',
            guardrail: 'Tener lista segunda opción de financiación puente.',
          },
          {
            id: 'growth-stress-2',
            label: 'Capex se dispara 15%',
            assumptionChange: 'Coste reforma +€36k',
            impact: '-€6.500/año cashflow',
            riskLevel: 'medio',
            guardrail: 'Incluir contingencia 12% y contrato llave en mano.',
          },
          {
            id: 'growth-stress-3',
            label: 'DSCR cae <1,30x',
            assumptionChange: 'Ingresos -10% durante 6 meses',
            impact: 'Riesgo covenant bancario',
            riskLevel: 'alto',
            guardrail: 'Establecer cuenta escrow y reporting mensual con banco.',
          },
        ],
        guardrails: [
          {
            id: 'growth-guard-1',
            title: 'DSCR mínimo 1,30x en pro-forma',
            description: 'Revisar proyecciones antes de cerrar cada adquisición.',
          },
          {
            id: 'growth-guard-2',
            title: 'Reserva proyecto 10%',
            description: 'Mantener fondo contingencia €45k para obras.',
          },
          {
            id: 'growth-guard-3',
            title: 'Reporting mensual a socios',
            description: 'Evita desalineaciones y acelera decisiones clave.',
          },
        ],
        timeline: [
          {
            id: 'growth-milestone-1',
            period: 'Mes 6',
            summary: 'Ventas cerradas y equity disponible.',
            metrics: [
              { label: 'Liquidez', value: '€140.000' },
              { label: 'Cashflow', value: '€52.200/año' },
            ],
          },
          {
            id: 'growth-milestone-2',
            period: 'Mes 18',
            summary: 'Edificio 6 uds reformado y arrendado 80%.',
            metrics: [
              { label: 'Cashflow', value: '€68.400/año' },
              { label: 'DSCR', value: '1,34x' },
            ],
          },
          {
            id: 'growth-milestone-3',
            period: 'Mes 36',
            summary: 'Segunda compra estabilizada y gestión profesionalizada.',
            metrics: [
              { label: 'Cashflow', value: '€84.300/año' },
              { label: 'Patrimonio', value: '€1,56M' },
            ],
          },
        ],
        multiUseNotes: [
          'Sirve como plan de pitch para socios o family office.',
          'Puede adaptarse para fondos de deuda privada interesados en colateral.',
          'Útil para roadmap de independencia financiera agresiva.',
        ],
      },
    },
  ],
};

class EscenarioService {
  private data: EscenariosDashboardData;

  constructor() {
    this.data = clone(initialDashboard);
  }

  async getDashboard(): Promise<EscenariosDashboardData> {
    return clone(this.data);
  }

  async toggleScenarioPin(scenarioId: string): Promise<EscenariosDashboardData> {
    const draft = clone(this.data);
    const scenario = draft.scenarios.find((item) => item.id === scenarioId);

    if (!scenario) {
      throw new Error('SCENARIO_NOT_FOUND');
    }

    scenario.isPinned = !scenario.isPinned;
    this.data = draft;
    return clone(this.data);
  }

  async toggleScenarioComparison(scenarioId: string): Promise<EscenariosDashboardData> {
    const draft = clone(this.data);
    const scenario = draft.scenarios.find((item) => item.id === scenarioId);

    if (!scenario) {
      throw new Error('SCENARIO_NOT_FOUND');
    }

    if (!scenario.markedForComparison) {
      const alreadyMarked = draft.scenarios.filter((item) => item.markedForComparison).length;
      if (alreadyMarked >= 3) {
        throw new Error('MAX_COMPARISON');
      }
    }

    scenario.markedForComparison = !scenario.markedForComparison;
    this.data = draft;
    return clone(this.data);
  }
}

export const escenarioService = new EscenarioService();
