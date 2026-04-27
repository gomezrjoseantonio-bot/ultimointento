import React, { useState } from 'react';
import { Pill, Icons, showToastV5 } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import SetRow from '../components/SetRow';
import Toggle from '../components/Toggle';
import containerStyles from '../AjustesPage.module.css';
import styles from './PerfilFiscalPage.module.css';

interface Implicacion {
  module: 'personal' | 'fiscal';
  where: string;
  detail: string;
}

const implicaciones: Implicacion[] = [
  { module: 'personal', where: 'Panel asalariado solo', detail: 'no se muestra Panel pareja · KPIs y compromisos solo del titular' },
  { module: 'fiscal', where: 'Declaración individual', detail: 'cálculo IRPF asume contribuyente único · sin opción conjunta' },
  { module: 'fiscal', where: 'Mínimo personal · 5.550 €', detail: 'sin recargos por edad · sin mínimos por ascendientes ni descendientes' },
  { module: 'personal', where: 'Compromisos sin reparto', detail: 'todos los compromisos recurrentes son del titular · sin prorrateo por persona' },
  { module: 'fiscal', where: 'CCAA Madrid · tarifa', detail: 'deducción por arrendamiento vivienda habitual del 30% si jóvenes < 35 años · revisar al alta' },
];

const PerfilFiscalPage: React.FC = () => {
  const [parejaActiva, setParejaActiva] = useState(false);

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Perfil fiscal y convivencia</h1>
          <div className={containerStyles.contentSub}>
            datos del contribuyente · pareja co-titular · personas a cargo · alimentan los cálculos
            IRPF y la lógica del hogar en Personal
          </div>
        </div>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGold}`}
          onClick={() => showToastV5('Datos guardados · recalculando IRPF previsto', 'success')}
        >
          <Icons.Check size={14} strokeWidth={1.8} />
          Guardar cambios
        </button>
      </div>

      <div className={styles.banner}>
        <Icons.Info size={16} strokeWidth={2} />
        <div>
          Estos datos son la <strong>fuente única de verdad fiscal del hogar</strong>. Alimentan los
          cálculos de Fiscal · la separación titular vs pareja en Personal · y el ámbito de los
          gastos compartidos. Si no rellenas correctamente · ATLAS asume contribuyente individual sin
          cargas.
        </div>
      </div>

      <SetSection
        title="Titular · datos fiscales"
        sub="contribuyente principal de ATLAS"
      >
        <SetRow
          label="Nombre completo"
          trailing={<SetRow.Link onClick={() => showToastV5('Cambiar nombre')}>Cambiar</SetRow.Link>}
        >
          <SetRow.Value>José Antonio Gómez Ramírez</SetRow.Value>
        </SetRow>
        <SetRow label="NIF / NIE">
          <SetRow.ValueMono>53069494F</SetRow.ValueMono>
        </SetRow>
        <SetRow
          label="Fecha de nacimiento"
          trailing={<SetRow.Link onClick={() => showToastV5('Cambiar fecha')}>Cambiar</SetRow.Link>}
        >
          <SetRow.ValueMono>12/03/1980</SetRow.ValueMono>
        </SetRow>
        <SetRow
          label="Estado civil fiscal"
          trailing={<SetRow.Link onClick={() => showToastV5('Cambiar estado civil')}>Cambiar</SetRow.Link>}
        >
          <SetRow.Value>Soltero</SetRow.Value>
          <SetRow.Sub>
            determina opciones de declaración conjunta · pareja de hecho · soltero · viudo
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="CCAA fiscal"
          trailing={<SetRow.Link onClick={() => showToastV5('Cambiar CCAA')}>Cambiar</SetRow.Link>}
        >
          <SetRow.Value>Comunidad de Madrid</SetRow.Value>
          <SetRow.Sub>
            determina tarifa autonómica IRPF y deducciones autonómicas
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Discapacidad reconocida"
          trailing={<SetRow.Link onClick={() => showToastV5('Cambiar discapacidad')}>Cambiar</SetRow.Link>}
        >
          <SetRow.Value muted>No</SetRow.Value>
        </SetRow>
        <SetRow
          label="Obligación declarar"
          trailing={<Pill variant="pos">Calculado</Pill>}
        >
          <SetRow.Value>Sí · obligado</SetRow.Value>
          <SetRow.Sub>
            por umbrales de rentas del trabajo + capital + actividades
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Pareja co-titular"
        sub="solo si hay pareja con la que se comparte hogar · sus ingresos suman al hogar · gastos compartidos se prorratean"
      >
        <SetRow
          label="Activar pareja"
          trailing={
            <Toggle
              checked={parejaActiva}
              onChange={setParejaActiva}
              ariaLabel="Activar pareja co-titular"
            />
          }
        >
          <SetRow.Value muted={!parejaActiva}>
            {parejaActiva ? 'Activado' : 'Desactivado'}
          </SetRow.Value>
          <SetRow.Sub>
            activa para registrar los datos de tu pareja y compartir el hogar
          </SetRow.Sub>
        </SetRow>
        <SetRow label="Nombre · NIF">
          <SetRow.Value muted>— sin pareja registrada</SetRow.Value>
        </SetRow>
        <SetRow label="Régimen económico">
          <SetRow.Sub>
            gananciales · separación de bienes · pareja de hecho · aplicable cuando registres pareja
          </SetRow.Sub>
        </SetRow>
        <SetRow label="Modalidad declaración">
          <SetRow.Sub>
            conjunta o individual · ATLAS calcula cuál sale mejor · aplicable cuando registres pareja
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Personas a cargo"
        sub="hijos · ascendientes · descendientes que conviven · afectan al cálculo IRPF (mínimos personales y por descendiente/ascendiente)"
      >
        <SetRow
          label="Estado actual"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Añadir persona a cargo')}>
              + Añadir
            </SetRow.Link>
          }
        >
          <SetRow.Value>Sin personas a cargo registradas</SetRow.Value>
          <SetRow.Sub>
            si tienes hijos menores · ascendientes que conviven contigo · o cargas familiares ·
            regístralos para que ATLAS aplique los mínimos correspondientes
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Implicaciones en otros módulos"
        sub="cómo se reflejan estos datos en el resto de la app · cambia los datos arriba para ver los efectos"
      >
        {implicaciones.map((impl, idx) => (
          <div key={idx} className={styles.implRow}>
            <div className={styles.implWhere}>
              <span className={`${styles.implTag} ${styles[impl.module]}`}>
                {impl.module === 'personal' ? 'Personal' : 'Fiscal'}
              </span>
              {impl.where}
            </div>
            <div className={styles.implDetail}>{impl.detail}</div>
          </div>
        ))}
      </SetSection>
    </>
  );
};

export default PerfilFiscalPage;
