import React, { useState } from 'react';
import { Pill, Icons, showToastV5 } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import SetRow from '../components/SetRow';
import Toggle from '../components/Toggle';
import containerStyles from '../AjustesPage.module.css';

const NotificacionesPage: React.FC = () => {
  const [concentracion, setConcentracion] = useState(false);
  const [resumenSemanal, setResumenSemanal] = useState(true);
  const [resumenDiario, setResumenDiario] = useState(false);

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Notificaciones</h1>
          <div className={containerStyles.contentSub}>
            qué eventos te avisan y por qué canal · email · push móvil · in-app
          </div>
        </div>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGold}`}
          onClick={() => showToastV5('Preferencias guardadas', 'success')}
        >
          <Icons.Check size={14} strokeWidth={1.8} />
          Guardar preferencias
        </button>
      </div>

      <SetSection
        title="Activación rápida"
        sub="activa o silencia todos los canales con un clic"
      >
        <SetRow
          label="Modo concentración"
          trailing={
            <Toggle
              checked={concentracion}
              onChange={setConcentracion}
              ariaLabel="Modo concentración"
            />
          }
        >
          <SetRow.Value muted={!concentracion}>
            {concentracion ? 'Activo' : 'Desactivado'}
          </SetRow.Value>
          <SetRow.Sub>
            silencia todas las notificaciones · útil en vacaciones
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Resumen semanal"
          trailing={
            <Toggle
              checked={resumenSemanal}
              onChange={setResumenSemanal}
              ariaLabel="Resumen semanal"
            />
          }
        >
          <SetRow.Value>
            {resumenSemanal ? 'Activo · cada lunes 9:00' : 'Desactivado'}
          </SetRow.Value>
          <SetRow.Sub>
            email con flujo de la semana · próximos cobros y cargos · alertas fiscales
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Resumen diario"
          trailing={
            <Toggle
              checked={resumenDiario}
              onChange={setResumenDiario}
              ariaLabel="Resumen diario"
            />
          }
        >
          <SetRow.Value muted={!resumenDiario}>
            {resumenDiario ? 'Activo' : 'Desactivado'}
          </SetRow.Value>
          <SetRow.Sub>
            solo si hay movimientos importantes · cargo &gt; 500 € · cobro &gt; 1.000 €
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Horario silencio"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar horario silencio')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>22:00 a 8:00</SetRow.ValueMono>
        </SetRow>
      </SetSection>

      <SetSection
        title="Tesorería · cuentas y cobros"
        sub="avisos sobre tu caja · cargos previstos · cobros recibidos · saldo bajo"
      >
        <SetRow
          label="Nómina cobrada"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar canales')}>
              Push · in-app
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            cuando llega el extracto bancario y se concilia · ATLAS aporta automáticamente al plan pensiones
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Cargo previsto"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar canales y anticipación')}>
              Push · in-app · 3d
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            aviso 3 días antes de domiciliaciones recurrentes · luz · gas · seguros · alquiler
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Saldo bajo en cuenta"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar umbrales por cuenta')}>
              Email · push · in-app
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            cuando alguna cuenta del hogar baja del umbral mínimo configurado
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Cobro inquilino retrasado"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar canales y anticipación')}>
              Email · push · 5d
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            renta no recibida en los 5 días siguientes a la fecha pactada
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Contratos · alquiler"
        sub="vencimientos · revisiones IPC · prórrogas"
      >
        <SetRow
          label="Vencimiento de contrato"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar anticipación')}>
              Email · in-app · 3 meses
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            aviso antes de prórroga obligatoria o fin · permite negociar a tiempo
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Revisión IPC anual"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar anticipación')}>
              Email · in-app · 1 mes
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            recordatorio de actualizar la renta en aniversario · cálculo automático sugerido
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Fiscal · obligaciones"
        sub="modelos trimestrales · campaña anual · solo activos para tu perfil"
      >
        <SetRow
          label="Modelo 303 · IVA"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar anticipación M303')}>
              Email · push · 2 sem
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            trimestral · vence día 22 de abr · jul · oct · ene · solo si tienes actividad económica
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Modelo 130 · IRPF fraccionado"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar anticipación M130')}>
              Email · push · 2 sem
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            autónomos en estimación directa · vence día 22 de abr · jul · oct · ene
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Campaña IRPF anual"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar hitos campaña IRPF')}>
              Email · push · in-app
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            apertura · borrador disponible · resultado a pagar o devolver · vencimiento
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Sistema · cuenta y datos"
        sub="seguridad y actividad de tu cuenta"
      >
        <SetRow
          label="Inicio sesión nuevo"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Configurar alerta seguridad')}>
              Email · push · ahora
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            acceso desde un dispositivo no reconocido · alerta de seguridad inmediata
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Pareja co-titular cambia"
          trailing={
            <SetRow.Link disabled>No aplica</SetRow.Link>
          }
        >
          <SetRow.Sub>
            si tu pareja edita compromisos · cuentas o ingresos del hogar compartido
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Canales y direcciones"
        sub="dónde llegan las notificaciones · puedes tener varios destinos"
      >
        <SetRow
          label="Email principal"
          trailing={<Pill variant="pos">Verificado</Pill>}
        >
          <SetRow.ValueMono>jose.gomez.atlas@gmail.com</SetRow.ValueMono>
          <SetRow.Sub>verificado · usado para login y notificaciones</SetRow.Sub>
        </SetRow>
        <SetRow
          label="Email secundario"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Añadir email secundario')}>
              Añadir
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            no configurado · útil como respaldo para alertas críticas
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Push móvil"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Gestionar dispositivos móviles')}>
              Gestionar
            </SetRow.Link>
          }
        >
          <SetRow.Value>iPhone 14 · Madrid</SetRow.Value>
          <SetRow.Sub>activo desde feb 2026</SetRow.Sub>
        </SetRow>
      </SetSection>
    </>
  );
};

export default NotificacionesPage;
