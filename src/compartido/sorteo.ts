import seedrandom from 'seedrandom';
import type { DatosRifa, Estudiante, Premio } from './tipos.js';

export interface ResultadoPremio {
    premioId: number;
    premioNombre: string;
    ganadores: Estudiante[];
    suplentes: Estudiante[];
    elegibles: number;
}

export interface ResultadoRifa {
    semilla: string;
    ejecutadaEn: string;
    resultados: ResultadoPremio[];
}

/** Estudiantes que cumplen las reglas de un premio y no han ganado antes. */
export function elegiblesPara(
    premio: Premio,
    estudiantes: Estudiante[],
    certificadosPrevios: Record<string, string[]>,
    yaGanaron: ReadonlySet<string>,
): Estudiante[] {
    return estudiantes.filter((e) => {
        if (yaGanaron.has(e.control)) return false;
        if (e.semestre < premio.semestreMin) return false;
        if (premio.carreras !== 'TODAS' && !premio.carreras.includes(e.carrera)) return false;
        if (premio.excluyeCertificaciones?.length) {
            const suyas = certificadosPrevios[e.control] ?? [];
            if (premio.excluyeCertificaciones.some((c) => suyas.includes(c))) return false;
        }
        return true;
    });
}

/**
 * Baraja una copia del arreglo con el algoritmo Fisher-Yates.
 * El orden depende solo del generador, así que la misma semilla da el mismo orden.
 */
function barajar<T>(items: readonly T[], rng: seedrandom.PRNG): T[] {
    const copia = [...items];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    }
    return copia;
}

/**
 * Sortea un premio y devuelve ganadores y suplentes.
 * No modifica nada: quien llama decide qué hacer con el resultado.
 */
export function sortearPremio(
    premio: Premio,
    estudiantes: Estudiante[],
    certificadosPrevios: Record<string, string[]>,
    yaGanaron: ReadonlySet<string>,
    semilla: string,
): ResultadoPremio {
    // Un generador propio por premio: así el resultado de cada uno
    // no cambia si se modifica otro premio de la lista.
    const rng = seedrandom(`${semilla}|premio-${premio.id}`);

    const elegibles = elegiblesPara(premio, estudiantes, certificadosPrevios, yaGanaron);

    // Se ordena por número de control antes de barajar. El Excel podría venir
    // en otro orden y el resultado debe depender solo de la semilla.
    const ordenados = [...elegibles].sort((a, b) => a.control.localeCompare(b.control));
    const barajados = barajar(ordenados, rng);

    const ganadores = barajados.slice(0, premio.cantidad);
    const suplentes = barajados.slice(premio.cantidad, premio.cantidad + premio.suplentes);

    return {
        premioId: premio.id,
        premioNombre: premio.nombre,
        ganadores,
        suplentes,
        elegibles: elegibles.length,
    };
}

/**
 * Corre la rifa completa en el orden en que vienen los premios.
 * Cada ganador sale de la bolsa; los suplentes siguen participando.
 */
export function sortearTodo(datos: DatosRifa, semilla: string): ResultadoRifa {
    const yaGanaron = new Set<string>();
    const resultados: ResultadoPremio[] = [];

    for (const premio of datos.premios) {
        const resultado = sortearPremio(
            premio,
            datos.estudiantes,
            datos.certificadosPrevios,
            yaGanaron,
            semilla,
        );
        for (const g of resultado.ganadores) yaGanaron.add(g.control);
        resultados.push(resultado);
    }

    return {
        semilla,
        ejecutadaEn: new Date().toISOString(),
        resultados,
    };
}

/**
 * Promueve suplentes cuando algún ganador no reclama.
 * Se salta a quien ya ganó otro premio, según la regla acordada.
 */
export function promoverSuplente(
    resultado: ResultadoPremio,
    yaGanaron: ReadonlySet<string>,
): Estudiante | null {
    for (const suplente of resultado.suplentes) {
        if (!yaGanaron.has(suplente.control)) return suplente;
    }
    return null;
}