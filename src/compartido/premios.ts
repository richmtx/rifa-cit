import type { Premio } from './tipos.js';

/** Carreras del grupo abierto de premios físicos. */
const ABIERTO = [
    'CIV', 'ARQ', 'ADM', 'BIOM', 'QUIM', 'BIOQ',
    'GEST', 'SEMI', 'LOG', 'ELEC', 'ELECTRO', 'IA',
] as const;

/** Carreras de los premios de modelado. */
const MODELADO = ['IND', 'MEC', 'MECA', 'ARQ', 'SIS'] as const;

export const PREMIOS: Premio[] = [
    { id: 1, nombre: 'Certificación ECO-680', tipo: 'certificacion', cantidad: 3, suplentes: 5, carreras: ['IND'], semestreMin: 7 },
    { id: 2, nombre: 'Beca 100% programa completo Sigma', tipo: 'certificacion', cantidad: 10, suplentes: 5, carreras: ['IND'], semestreMin: 5 },
    { id: 3, nombre: 'Certificación SolidWorks Básico', tipo: 'certificacion', cantidad: 5, suplentes: 5, carreras: ['IND', 'MEC', 'MECA'], semestreMin: 7 },
    { id: 4, nombre: 'Certificación SolidWorks Profesional', tipo: 'certificacion', cantidad: 5, suplentes: 5, carreras: ['IND', 'MEC', 'MECA'], semestreMin: 7 },
    { id: 5, nombre: 'Certificación Kaizen Manager', tipo: 'certificacion', cantidad: 10, suplentes: 5, carreras: ['IND'], semestreMin: 5 },
    { id: 6, nombre: 'Capacitación IA Fundamentos', tipo: 'capacitacion', cantidad: 10, suplentes: 5, carreras: ['INF', 'TICS', 'SIS'], semestreMin: 6 },
    { id: 7, nombre: 'Capacitación Ciberseguridad', tipo: 'capacitacion', cantidad: 10, suplentes: 5, carreras: ['INF', 'TICS', 'SIS'], semestreMin: 6 },
    { id: 8, nombre: 'Capacitación Análisis de Datos', tipo: 'capacitacion', cantidad: 10, suplentes: 5, carreras: ['INF', 'TICS', 'SIS'], semestreMin: 6 },
    { id: 9, nombre: 'Capacitación Excel Intermedio', tipo: 'capacitacion', cantidad: 5, suplentes: 5, carreras: 'TODAS', semestreMin: 5 },
    { id: 10, nombre: 'Capacitación Excel Básico', tipo: 'capacitacion', cantidad: 5, suplentes: 5, carreras: 'TODAS', semestreMin: 5 },

    { id: 11, nombre: 'Mouse Redragon Predator RGB', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 12, nombre: 'Audífonos Pure Bass Wireless', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 13, nombre: 'Teclado y Mouse Stylos', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 14, nombre: 'Juego PMA', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 15, nombre: 'Tableta GUIA 10.1"', tipo: 'fisico', cantidad: 2, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 16, nombre: 'Bocina Bluetooth Nextep', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 17, nombre: 'Termo GAFI 750 ml', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 18, nombre: 'Bocina Bluetooth MiSiK', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 19, nombre: 'Bocina Xiaomi Sound Pocket', tipo: 'fisico', cantidad: 3, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 20, nombre: 'Apuntador y presentador láser BRobotix', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 21, nombre: 'Audífonos UGREEN', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 22, nombre: 'Audífonos JBL', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },

    { id: 23, nombre: 'Mouse inalámbrico para modelado', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...MODELADO], semestreMin: 7 },
    { id: 24, nombre: 'Impresora de papel', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...ABIERTO], semestreMin: 1 },
    { id: 25, nombre: 'Impresora 3D Creality', tipo: 'fisico', cantidad: 1, suplentes: 3, carreras: [...MODELADO], semestreMin: 7 },
];