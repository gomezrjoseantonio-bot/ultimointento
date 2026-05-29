/**
 * useInmueblesDetectados.ts
 *
 * Wizard import XML V2 · paso 2 · clasifica los inmuebles del XML en
 * nuevos / a enriquecer / accesorios cruzando con `properties` existentes, y
 * calcula las sugerencias de pre-relleno (mapeo V77) a partir de los
 * arrendamientos del ejercicio más reciente.
 */

import { useEffect, useState } from 'react';
import { initDB } from '../../../services/db';
import type { DeclaracionCompleta, InmuebleDeclarado } from '../../../types/declaracionCompleta';

function normRef(value?: string | null): string {
  return (value ?? '').replace(/[\s.-]/g, '').trim().toUpperCase();
}

export type ClaseInmueble = 'nuevo' | 'existente' | 'accesorio';

export interface SugerenciaInmueble {
  habitaciones?: number;
  unidadesArrendables?: number;
  modoExplotacion?: 'piso_completo' | 'por_habitaciones' | 'mixto';
  estadoOperativo?: 'operativo' | 'en_reforma' | 'vacante' | 'uso_propio';
  esAlquilable: boolean;
}

export interface InmuebleDetectado {
  refCatastral: string;
  alias: string;
  direccion: string;
  clase: ClaseInmueble;
  vinculadoA?: string; // RC del principal si es accesorio
  inmueble: InmuebleDeclarado;
  ejercicioBase: number;
  sugerencia: SugerenciaInmueble;
}

/** Dirección abreviada legible para el alias de la card. */
function alias(direccion: string): string {
  if (!direccion) return 'Inmueble sin dirección';
  return direccion
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function calcularSugerencia(inm: InmuebleDeclarado): SugerenciaInmueble {
  const nifs = new Set<string>();
  let diasArrendados = 0;
  for (const arr of inm.arrendamientos) {
    for (const nif of arr.nifArrendatarios ?? []) {
      if (nif && nif.trim()) nifs.add(nif.trim().toUpperCase());
    }
    diasArrendados += arr.diasArrendado ?? 0;
  }
  const numNifs = nifs.size;
  const esAlquilable = inm.arrendamientos.length > 0;

  let modoExplotacion: SugerenciaInmueble['modoExplotacion'];
  if (numNifs >= 2) modoExplotacion = 'por_habitaciones';
  else if (numNifs === 1) modoExplotacion = 'piso_completo';

  return {
    habitaciones: numNifs > 0 ? numNifs : undefined,
    unidadesArrendables: numNifs > 0 ? numNifs : undefined,
    modoExplotacion,
    estadoOperativo: diasArrendados > 0 ? 'operativo' : undefined,
    esAlquilable,
  };
}

export interface ResultadoInmueblesDetectados {
  cargando: boolean;
  inmuebles: InmuebleDetectado[];
  nuevos: InmuebleDetectado[];
  existentes: InmuebleDetectado[];
  accesorios: InmuebleDetectado[];
  totalArrendamientos: number;
}

export function useInmueblesDetectados(decls: DeclaracionCompleta[]): ResultadoInmueblesDetectados {
  const [cargando, setCargando] = useState(true);
  const [inmuebles, setInmuebles] = useState<InmuebleDetectado[]>([]);
  const [totalArrendamientos, setTotalArrendamientos] = useState(0);

  // Clave estable de dependencia: RCs + ejercicios.
  const firma = decls
    .map((d) => `${d.meta.ejercicio}:${d.inmuebles.map((i) => normRef(i.refCatastral)).join(',')}`)
    .join('|');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCargando(true);
      // Dedupe por RC quedándose con el ejercicio más reciente de cada inmueble.
      const porRef = new Map<string, { inm: InmuebleDeclarado; ejercicio: number }>();
      let arrCount = 0;
      const declsOrden = [...decls].sort((a, b) => a.meta.ejercicio - b.meta.ejercicio);
      for (const d of declsOrden) {
        for (const inm of d.inmuebles) {
          arrCount += inm.arrendamientos.length;
          const rc = normRef(inm.refCatastral);
          if (!rc) continue;
          porRef.set(rc, { inm, ejercicio: d.meta.ejercicio }); // el último (más reciente) gana
        }
      }

      let existentesRC = new Set<string>();
      try {
        const props = await initDB().then((db) => db.getAll('properties'));
        existentesRC = new Set(props.map((p) => normRef(p.cadastralReference)).filter(Boolean));
      } catch {
        // Sin acceso a DB · todo se considera nuevo.
      }

      const lista: InmuebleDetectado[] = [];
      for (const [rc, { inm, ejercicio }] of porRef) {
        const esAccesorio = !!inm.esAccesorioDe;
        const clase: ClaseInmueble = esAccesorio
          ? 'accesorio'
          : existentesRC.has(rc)
            ? 'existente'
            : 'nuevo';
        lista.push({
          refCatastral: inm.refCatastral,
          alias: alias(inm.direccion),
          direccion: inm.direccion,
          clase,
          vinculadoA: inm.esAccesorioDe,
          inmueble: inm,
          ejercicioBase: ejercicio,
          sugerencia: calcularSugerencia(inm),
        });
      }

      if (!cancelado) {
        setInmuebles(lista);
        setTotalArrendamientos(arrCount);
        setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  return {
    cargando,
    inmuebles,
    nuevos: inmuebles.filter((i) => i.clase === 'nuevo'),
    existentes: inmuebles.filter((i) => i.clase === 'existente'),
    accesorios: inmuebles.filter((i) => i.clase === 'accesorio'),
    totalArrendamientos,
  };
}
