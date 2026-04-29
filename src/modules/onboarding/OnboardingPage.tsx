// Onboarding · ruta `/onboarding`. Wizard mínimo · welcome + hub.
//
// Mockup oficial · `docs/audit-inputs/atlas-onboarding.html`. El mockup
// completo tiene 5 sub-flujos (TXT IRPF, Inmuebles+contratos, Tesorería,
// importadores específicos, etc.) que cubren ~3000 ln HTML. Aquí sólo
// migramos la pantalla de bienvenida y el hub de elección · cada CTA
// redirige a su importador correspondiente que ya existe en el módulo
// v5 (`/inmuebles/importar`, `/financiacion/nuevo-fein`, etc.).
//
// Los sub-flujos completos del onboarding (TXT IRPF parser · post-import
// review) son sub-tareas follow-up.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../design-system/v5';
import styles from './OnboardingPage.module.css';

type Stage = 'welcome' | 'hub';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('welcome');

  if (stage === 'welcome') {
    return (
      <div className={styles.page}>
        <div className={styles.welcome}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>A</div>
            <div>
              <div className={styles.brandName}>Atlas</div>
              <div className={styles.brandSub}>Patrimonio &amp; Renta</div>
            </div>
          </div>

          <div className={styles.iconBig}>
            <Icons.Inversiones size={42} strokeWidth={1.5} />
          </div>

          <h1 className={styles.welcomeTitle}>
            Bienvenido a <span className={styles.gold}>Atlas</span>
          </h1>

          <div className={styles.tagline}>
            Tu patrimonio inmobiliario · vivo.
            <br />
            Rentas, contratos, hipotecas, tesorería y declaraciones · todo hablando entre sí.
          </div>

          <div className={styles.chips}>
            <span className={styles.chip}>
              <span className={styles.chipDot} />
              Inmuebles y préstamos
            </span>
            <span className={styles.chip}>
              <span className={styles.chipDot} />
              Contratos y rentas
            </span>
            <span className={styles.chip}>
              <span className={styles.chipDot} />
              Tesorería
            </span>
            <span className={styles.chip}>
              <span className={styles.chipDot} />
              Fiscal IRPF
            </span>
            <span className={styles.chip}>
              <span className={styles.chipDot} />
              Archivo documental
            </span>
          </div>

          <button type="button" className={styles.cta} onClick={() => setStage('hub')}>
            Empezar ahora
            <Icons.ArrowRight size={18} strokeWidth={2.4} />
          </button>

          <div className={styles.signin}>
            ¿Ya tienes cuenta?{' '}
            <button type="button" onClick={() => navigate('/panel')}>
              Ir al panel
            </button>
          </div>

          <div className={styles.welcomeFoot}>
            Atlas v1.0 · diseñado para inversores inmobiliarios en España
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.hub}>
        <div className={styles.progress}>
          <span>Onboarding</span>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: '20%' }} />
          </div>
          <span className={styles.progressPct}>20%</span>
        </div>

        <div className={styles.head}>
          <div className={styles.kick}>Paso 1 de 3 · elige cómo empezar</div>
          <h1 className={styles.headTitle}>Empieza con tus datos</h1>
          <p className={styles.headSub}>
            Cuanto más subas ahora, menos vas a escribir después. Elige la ruta que te cuadre · puedes
            combinar varias en cualquier momento.
          </p>
        </div>

        <div className={styles.cards}>
          <button
            type="button"
            className={`${styles.card} ${styles.recommended}`}
            onClick={() => navigate('/fiscal/importar/' + new Date().getFullYear())}
          >
            <span className={styles.cardBadge}>Recomendado</span>
            <span className={styles.cardIcon}>
              <Icons.Fiscal size={26} strokeWidth={1.7} />
            </span>
            <div className={styles.cardTitle}>IRPF · TXT/PDF</div>
            <div className={styles.cardSubtitle}>lo más completo</div>
            <div className={styles.cardDesc}>
              Sube tus archivos PDF/XML de declaraciones IRPF (Renta Web). Atlas detecta y
              configura casi todo por ti.
            </div>
            <ul className={styles.cardList}>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Casillas y bases liquidables
              </li>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Resultado autoliquidación
              </li>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Trazabilidad documental
              </li>
            </ul>
            <div className={styles.cardTime}>Tardas 5-10 min · según años</div>
            <span className={styles.cardBtn}>
              Empezar con IRPF
              <Icons.ChevronRight size={14} strokeWidth={2.5} />
            </span>
          </button>

          <button
            type="button"
            className={styles.card}
            onClick={() => navigate('/inmuebles/importar')}
          >
            <span className={styles.cardIcon}>
              <Icons.Inmuebles size={26} strokeWidth={1.7} />
            </span>
            <div className={styles.cardTitle}>Inmuebles · CSV</div>
            <div className={styles.cardSubtitle}>importación masiva</div>
            <div className={styles.cardDesc}>
              Importa tu cartera de inmuebles desde una hoja de cálculo. Después podrás añadir
              valoraciones, contratos y préstamos.
            </div>
            <ul className={styles.cardList}>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Cartera de inmuebles
              </li>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Valoraciones (opcional)
              </li>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Contratos (opcional)
              </li>
            </ul>
            <div className={styles.cardTime}>Tardas 10-20 min</div>
            <span className={styles.cardBtn}>
              Empezar con inmuebles
              <Icons.ChevronRight size={14} strokeWidth={2.5} />
            </span>
          </button>

          <button
            type="button"
            className={styles.card}
            onClick={() => navigate('/tesoreria/importar-cuentas')}
          >
            <span className={styles.cardIcon}>
              <Icons.Tesoreria size={26} strokeWidth={1.7} />
            </span>
            <div className={styles.cardTitle}>Cuentas bancarias</div>
            <div className={styles.cardSubtitle}>tesorería y movimientos</div>
            <div className={styles.cardDesc}>
              Conecta tus cuentas bancarias y sube extractos para que Atlas los concilie con tus
              contratos y préstamos automáticamente.
            </div>
            <ul className={styles.cardList}>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Cuentas y saldos
              </li>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Extractos bancarios
              </li>
              <li>
                <Icons.Check size={12} strokeWidth={3} />
                Conciliación automática
              </li>
            </ul>
            <div className={styles.cardTime}>Tardas 5-10 min</div>
            <span className={styles.cardBtn}>
              Empezar con cuentas
              <Icons.ChevronRight size={14} strokeWidth={2.5} />
            </span>
          </button>
        </div>

        <div className={styles.skip}>
          ¿Prefieres empezar desde cero?{' '}
          <button type="button" onClick={() => navigate('/panel')}>
            Ir directamente al panel
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
