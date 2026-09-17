export type ClaveCarrera =
    | 'ADM' | 'ARQ' | 'BIOM' | 'BIOQ' | 'CIV' | 'ELEC' | 'ELECTRO'
    | 'GEST' | 'IND' | 'INF' | 'IA' | 'LOG' | 'MEC' | 'MECA'
    | 'QUIM' | 'SEMI' | 'SIS' | 'TICS';

export interface Estudiante {
    control: string;
    nombre: string;
    correo: string;
    carrera: ClaveCarrera;
    semestre: number;
}

export type TipoPremio = 'certificacion' | 'capacitacion' | 'fisico';

export interface Premio {
    id: number;
    nombre: string;
    tipo: TipoPremio;
    cantidad: number;
    suplentes: number;
    carreras: ClaveCarrera[] | 'TODAS';
    semestreMin: number;
    /** Nombre exacto en la base de certificados previos. */
    excluyeCertificacion?: string;
}

export interface DatosRifa {
    generadoEn: string;
    hashEstudiantes: string;
    hashPremios: string;
    estudiantes: Estudiante[];
    premios: Premio[];
    /** control -> certificaciones que ya tiene */
    certificadosPrevios: Record<string, string[]>;
}