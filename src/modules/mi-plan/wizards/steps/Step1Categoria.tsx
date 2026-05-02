import React from 'react';
import { Icons } from '../../../../design-system/v5';
import styles from '../WizardNuevoFondo.module.css';
import type { CategoriaFondo } from '../typesFondo';

interface CatDef {
  cat: CategoriaFondo;
  cardClass: string;
  Icon: React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  titulo: string;
  desc: string;
  ejemplo: React.ReactNode;
}

// Etiqueta UI "Próxima compra" mapea a tipo: 'compra' interno (decisión
// Etapa A · respeta el shape del repo · ver typesFondo.ts).
const CATEGORIAS: CatDef[] = [
  {
    cat: 'colchon',
    cardClass: styles.catCardColchon,
    Icon: Icons.Colchon,
    titulo: 'Colchón de emergencia',
    desc: 'Reserva intocable para imprevistos · medida en meses de gastos cubiertos.',
    ejemplo: (
      <>
        Ej · <strong>cubrir 24 meses de gastos</strong> ·{' '}
        <strong>fondo bajo en colchón</strong>
      </>
    ),
  },
  {
    cat: 'compra',
    cardClass: styles.catCardPiso,
    Icon: Icons.Compra,
    titulo: 'Próxima compra',
    desc: 'Ahorrar para entrada + gastos del próximo inmueble · meta en €.',
    ejemplo: (
      <>
        Ej · <strong>entrada próximo piso 80.000 €</strong> ·{' '}
        <strong>gastos compra Madrid</strong>
      </>
    ),
  },
  {
    cat: 'reforma',
    cardClass: styles.catCardReforma,
    Icon: Icons.Reforma,
    titulo: 'Reforma prevista',
    desc: 'Reservar para una obra · reforma · adecuación de un inmueble · meta en €.',
    ejemplo: (
      <>
        Ej · <strong>reforma cocina T64 · 18.000 €</strong> ·{' '}
        <strong>obra fachada FA32</strong>
      </>
    ),
  },
  {
    cat: 'impuestos',
    cardClass: styles.catCardImpuestos,
    Icon: Icons.Impuestos,
    titulo: 'Impuestos pendientes',
    desc: 'Apartar lo que tendrás que pagar a Hacienda · meta sugerida desde el simulador fiscal.',
    ejemplo: (
      <>
        Ej · <strong>renta 2025 · ~3.200 €</strong> ·{' '}
        <strong>IVA 4T-2026 · ~1.450 €</strong>
      </>
    ),
  },
];

interface Props {
  selected: CategoriaFondo | undefined;
  onSelect: (cat: CategoriaFondo) => void;
}

const Step1Categoria: React.FC<Props> = ({ selected, onSelect }) => {
  return (
    <div>
      <div className={styles.stepTitle}>
        <span className={styles.stepTitleNum}>01</span> ¿Qué tipo de fondo?
      </div>
      <div className={styles.stepSubText}>
        Selecciona el propósito del fondo. Cada categoría tiene un cálculo de meta sugerido y
        un color distintivo en el listado.
      </div>

      <div className={styles.catGrid}>
        {CATEGORIAS.map((c) => {
          const isSel = selected === c.cat;
          const cls = [styles.catCard, c.cardClass, isSel ? styles.selected : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={c.cat}
              type="button"
              className={cls}
              onClick={() => onSelect(c.cat)}
              aria-pressed={isSel}
            >
              <div className={styles.catCardCheck}>
                <Icons.Check size={10} strokeWidth={3} />
              </div>
              <div className={styles.catCardHd}>
                <div className={styles.catCardIcon}>
                  <c.Icon size={18} strokeWidth={1.8} />
                </div>
                <div className={styles.catCardTit}>{c.titulo}</div>
              </div>
              <div className={styles.catCardDesc}>{c.desc}</div>
              <div className={styles.catCardEg}>{c.ejemplo}</div>
            </button>
          );
        })}
      </div>

      <div className={styles.helpBox}>
        <strong>¿Necesitas otra categoría?</strong> Las 4 categorías cubren los casos más
        comunes. Si tu fondo no encaja claramente, elige <strong>Próxima compra</strong> (es
        la más genérica) y dale el nombre que necesites en el siguiente paso.
      </div>
    </div>
  );
};

export default Step1Categoria;
