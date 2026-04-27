import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Pill, Icons, showToastV5 } from '../../../design-system/v5';
import SetSection from '../components/SetSection';
import SetRow from '../components/SetRow';
import Toggle from '../components/Toggle';
import containerStyles from '../AjustesPage.module.css';
import styles from './PerfilPage.module.css';

const PerfilPage: React.FC = () => {
  const { user } = useAuth();
  const userName = user?.name ?? 'Usuario';
  const userEmail = user?.email ?? 'demo@atlas.com';
  const userId = user?.id ?? 'atl-u-demo';
  const createdAt = user?.createdAt
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        new Date(user.createdAt),
      )
    : '—';

  const initials = userName
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const [agrupado, setAgrupado] = useState(true);
  const [tutoriales, setTutoriales] = useState(true);
  const [resumenSemanal, setResumenSemanal] = useState(true);

  return (
    <>
      <div className={containerStyles.contentHead}>
        <div>
          <h1 className={containerStyles.contentTitle}>Perfil</h1>
          <div className={containerStyles.contentSub}>
            tu información personal y preferencias de la cuenta
          </div>
        </div>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGold}`}
          onClick={() => showToastV5('Cambios del perfil guardados', 'success')}
        >
          <Icons.Check size={14} strokeWidth={1.8} />
          Guardar cambios
        </button>
      </div>

      <div className={styles.hero}>
        <div className={styles.avatar} aria-hidden>
          {initials || 'U'}
        </div>
        <div>
          <div className={styles.name}>{userName}</div>
          <div className={styles.meta}>
            cuenta creada <strong>{createdAt}</strong>
            <span className={styles.metaSep}>·</span>
            última sesión <strong>hace 2 horas</strong>
            <span className={styles.metaSep}>·</span>
            ID · <strong>{userId}</strong>
          </div>
        </div>
        <button
          type="button"
          className={`${containerStyles.btn} ${containerStyles.btnGhost}`}
          onClick={() => showToastV5('Cambiar foto de perfil')}
        >
          Cambiar foto
        </button>
      </div>

      <SetSection
        title="Datos personales"
        sub="nombre · contacto · identificación fiscal"
      >
        <SetRow label="Nombre completo">
          <SetRow.Input defaultValue={userName} aria-label="Nombre completo" />
        </SetRow>
        <SetRow
          label="Email"
          trailing={<Pill variant="pos">Verificado</Pill>}
        >
          <SetRow.Input defaultValue={userEmail} aria-label="Email" />
          <SetRow.Sub>
            verificado · usado para inicio de sesión y notificaciones
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Teléfono"
          trailing={<Pill variant="warn">Sin verificar</Pill>}
        >
          <SetRow.Input defaultValue="+34 612 34 56 78" aria-label="Teléfono" />
        </SetRow>
        <SetRow label="NIF/NIE">
          <SetRow.Input mono defaultValue="12345678A" aria-label="NIF" />
          <SetRow.Sub>
            usado para declaraciones fiscales · no editable tras firma de contratos
          </SetRow.Sub>
        </SetRow>
      </SetSection>

      <SetSection
        title="Preferencias regionales"
        sub="idioma · zona horaria · formato de números y fechas"
      >
        <SetRow
          label="Idioma"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar idioma')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>Español · España</SetRow.ValueMono>
        </SetRow>
        <SetRow
          label="Zona horaria"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar zona horaria')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>Europe/Madrid · UTC+1</SetRow.ValueMono>
        </SetRow>
        <SetRow
          label="Formato de número"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar formato numérico')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>1.234,56 €</SetRow.ValueMono>
        </SetRow>
        <SetRow
          label="Formato de fecha"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar formato de fecha')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>DD/MM/AAAA</SetRow.ValueMono>
        </SetRow>
        <SetRow
          label="Día inicio semana"
          trailing={
            <SetRow.Link onClick={() => showToastV5('Cambiar día inicio · Lunes o Domingo')}>
              Cambiar
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>Lunes</SetRow.ValueMono>
        </SetRow>
      </SetSection>

      <SetSection title="Preferencias de interfaz" sub="cómo quieres ver ATLAS">
        <SetRow
          label="Tema"
          trailing={
            <SetRow.Link disabled>
              Próximamente
            </SetRow.Link>
          }
        >
          <SetRow.ValueMono>Claro · Oxford Gold</SetRow.ValueMono>
        </SetRow>
        <SetRow
          label="Mostrar cifras agrupadas"
          trailing={
            <Toggle
              checked={agrupado}
              onChange={setAgrupado}
              ariaLabel="Mostrar cifras agrupadas"
            />
          }
        >
          <SetRow.Sub>
            agregados por tipo en vez de cifras individuales
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Tutoriales inline"
          trailing={
            <Toggle
              checked={tutoriales}
              onChange={setTutoriales}
              ariaLabel="Tutoriales inline"
            />
          }
        >
          <SetRow.Sub>
            ayudas contextuales al entrar en secciones nuevas
          </SetRow.Sub>
        </SetRow>
        <SetRow
          label="Resumen semanal por email"
          trailing={
            <Toggle
              checked={resumenSemanal}
              onChange={setResumenSemanal}
              ariaLabel="Resumen semanal por email"
            />
          }
        >
          <SetRow.Sub>
            cada lunes · lo más relevante de tu patrimonio
          </SetRow.Sub>
        </SetRow>
      </SetSection>
    </>
  );
};

export default PerfilPage;
