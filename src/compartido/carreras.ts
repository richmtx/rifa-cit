import type { ClaveCarrera } from './tipos.js';

export const CARRERAS: Record<ClaveCarrera, string> = {
    ADM: 'Administración',
    ARQ: 'Arquitectura',
    BIOM: 'Biomédica',
    BIOQ: 'Bioquímica',
    CIV: 'Civil',
    ELEC: 'Eléctrica',
    ELECTRO: 'Electrónica',
    GEST: 'Gestión',
    IND: 'Industrial',
    INF: 'Informática',
    IA: 'Inteligencia',
    LOG: 'Logística',
    MEC: 'Mecánica',
    MECA: 'Mecatrónica',
    QUIM: 'Química',
    SEMI: 'Semiconductores',
    SIS: 'Sistemas',
    TICS: 'Tics',
};

/** Quita acentos, espacios extra y mayúsculas para comparar. */
function normalizar(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

const INDICE = new Map<string, ClaveCarrera>();
for (const [clave, nombre] of Object.entries(CARRERAS)) {
    INDICE.set(normalizar(nombre), clave as ClaveCarrera);
    INDICE.set(clave, clave as ClaveCarrera);
}

/** Devuelve la clave o null si el texto no está en el catálogo. */
export function clavePorNombre(texto: string): ClaveCarrera | null {
    return INDICE.get(normalizar(texto)) ?? null;
}