import React, { useState } from 'react';
import { Pill, Icons, showToastV5 } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import SetRow from '../components/SetRow';
import Toggle from '../components/Toggle';
import containerStyles from '../AjustesPage.module.css';
import styles from './SeguridadPage.module.css';

interface Sesion {
  key: string;
  device: string;
  meta: string;
  current?: boolean;
  iconKind: 'desktop' | 'mobile';
}

const sesiones: Sesion[] = [
  {
    key: 'macbook',
    device: 'MacBook Pro · Chrome 120 · macOS',
    meta: 'Madrid · IP 88.27.··.·· · sesión actual',
    current: true,
    iconKind: 'desktop',
  },
  {
    key: 'iphone',
    device: 'iPhone 14 · App Atlas · iOS 17',
    meta: 'Madrid · IP 88.27.··.·· · activo hace 2 horas',
    iconKind: 'mobile',
  },
  {
    key: 'imac',
    device: 'iMac casa · Safari 17 · macOS',
    meta: 'Madrid · IP 90.165.··.·· · activo hace 3 días',
    iconKind: 'desktop',
  },
];

const SeguridadPage: React.FC = () => {
  const [twoFa, setTwoFa] = useState(true);
  const [biometria, setBiometria] = useState(true);

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Seguridad y datos</h1>
          <div className={containerStyles.contentSub}>
            contraseña · 2FA · sesiones activas · exportar datos · eliminar cuenta
          </div>
        </div>
      </div>

      <SetSection
        title="Acceso a la cuenta"
        sub="cómo te autenticas · contraseña y segundo factor"
      >
        <SetRow
          label="Contraseña"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar contraseña')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.Value>Última actualización · 14 ene 2026</SetRow.Value>
          <SetRow.Sub>
            hace 3 meses · recomendado renovar cada 6 meses
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="2FA · doble factor"
          trailing={
            <Toggle
              checked={twoFa}
              onChange={setTwoFa}
              ariaLabel="Doble factor"
            />
          }
        >
          <SetRow.Value>
            {twoFa ? 'Activo · app autenticadora Authy' : 'Desactivado'}
          </SetRow.Value>
          <SetRow.Sub>
            alternativa email cuando no tienes acceso al móvil
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Códigos recuperación"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Generar nuevos códigos')}>
              Generar
            </SetRow.Link>
          }
        >
          <SetRow.Value>10 códigos generados</SetRow.Value>
          <SetRow.Sub>
            de un solo uso · si pierdes el segundo factor · guárdalos en sitio seguro
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Biometría móvil"
          trailing={
            <Toggle
              checked={biometria}
              onChange={setBiometria}
              ariaLabel="Biometría móvil"
            />
          }
        >
          <SetRow.Value>{biometria ? 'Activa · Face ID' : 'Desactivada'}</SetRow.Value>
          <SetRow.Sub>
            en app móvil · sin escribir contraseña al entrar
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Sesiones activas"
        sub="dispositivos donde tu cuenta está abierta · cierra sesiones desconocidas"
      >
        {sesiones.map((s) => (
          <div
            key={s.key}
            className={`${styles.sesRow} ${s.current ? styles.current : ''}`}
          >
            <div className={styles.icon}>
              {s.iconKind === 'desktop' ? (
                <Icons.Panel size={18} strokeWidth={1.7} />
              ) : (
                <Icons.Phone size={18} strokeWidth={1.7} />
              )}
            </div>
            <div className={styles.info}>
              <div className={styles.name}>{s.device}</div>
              <div className={styles.meta}>{s.meta}</div>
            </div>
            {s.current ? (
              <span className={styles.badgeCur}>Esta sesión</span>
            ) : (
              <SetRow.Link onClick={() => showToastV5(`Cerrar sesión · ${s.device}`)}>
                Cerrar
              </SetRow.Link>
            )}
          </div>
        ))}
      </SetSection>

      <SetSection
        title="Tus datos"
        sub="portabilidad · derecho a obtener una copia o pedir su eliminación · RGPD"
      >
        <SetRow
          label="Exportar datos"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Solicitar exportación · enviado en 24 h')}>
              Solicitar
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            descarga ZIP con CSVs · perfil · inmuebles · contratos · tesorería · fiscal · documentos ·
            enviado por email en 24 h
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Auditoría accesos"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Ver registro auditoría')}>
              Ver registro
            </SetRow.Link>
          }
        >
          <SetRow.Sub>
            log de los últimos 90 días · inicios de sesión · cambios sensibles · acceso a documentos
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Cifrado documentos"
          trailing={<Pill variant="pos">Activo</Pill>}
        >
          <SetRow.Sub>
            contratos · escrituras · certificados · cifrados en reposo · acceso solo con tu cuenta
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Compartir con pareja"
          trailing={<Pill variant="gris">No aplica</Pill>}
        >
          <SetRow.Sub>
            solo activo si registras pareja co-titular en Perfil fiscal · ahora desactivado por
            configuración
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Zona peligrosa"
        sub="acciones irreversibles · sé consciente antes de pulsar"
        danger
      >
        <SetRow
          label="Eliminar cuenta"
          labelTone="danger"
          trailing={
            <button
              type="button"
              className={containerStyles.btnDanger}
              onClick={() =>
                showToastV5('Iniciar proceso eliminación · email de confirmación', 'warn')
              }
            >
              Eliminar cuenta
            </button>
          }
        >
          <SetRow.Sub>
            borra inmuebles · contratos · tesorería · fiscal · documentos · 14 años de historial ·
            operación irreversible · te enviaremos confirmación al email
          </SetRow.Sub>
        </SetRow>
      </SetSection>
    </>
  );
};

export default SeguridadPage;
