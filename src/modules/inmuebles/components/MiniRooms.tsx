import React from 'react';
import styles from './MiniRooms.module.css';

export type MiniRoomColor =
  | 'green'
  | 'red'
  | 'yellow'
  | 'blue'
  | 'bw'
  | 'vacant';

export interface MiniRoom {
  /** Etiqueta · número de habitación. */
  label: React.ReactNode;
  /** Color base del tenant · null/undefined = vacante. */
  color?: MiniRoomColor;
  /** Si true · marca pequeño dot rojo (impago). */
  overdue?: boolean;
  /** Si true · marca pequeño dot oro (vence pronto). */
  ending?: boolean;
}

const COLOR_VARS: Record<Exclude<MiniRoomColor, 'vacant'>, string> = {
  green: 'var(--atlas-v5-room-green)',
  red: 'var(--atlas-v5-room-red)',
  yellow: 'var(--atlas-v5-room-yellow)',
  blue: 'var(--atlas-v5-room-blue)',
  bw: 'var(--atlas-v5-room-bw)',
};

export interface MiniRoomsProps {
  rooms: MiniRoom[];
}

const MiniRooms: React.FC<MiniRoomsProps> = ({ rooms }) => (
  <div className={styles.grid}>
    {rooms.map((r, i) => {
      const isVacant = !r.color || r.color === 'vacant';
      const cls = [
        styles.room,
        isVacant ? styles.vacant : '',
        r.overdue ? styles.overdue : '',
        r.ending ? styles.ending : '',
      ]
        .filter(Boolean)
        .join(' ');
      const bg = isVacant ? undefined : COLOR_VARS[r.color as Exclude<MiniRoomColor, 'vacant'>];
      return (
        <span
          key={i}
          className={cls}
          style={bg ? { background: bg } : undefined}
        >
          {r.label}
        </span>
      );
    })}
  </div>
);

export default MiniRooms;
export { MiniRooms };
