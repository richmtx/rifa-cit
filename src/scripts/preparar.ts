import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { clavePorNombre, CARRERAS } from '../compartido/carreras.js';
import { PREMIOS } from '../compartido/premios.js';
import type { ClaveCarrera, DatosRifa, Estudiante } from '../compartido/tipos.js';

const RUTA_ESTUDIANTES = 'datos/estudiantes.xlsx';
const RUTA_CERTIFICADOS = 'datos/certificados-previos.xlsx';
const RUTA_SALIDA = 'salida/rifa-datos.json';

function hash(ruta: string): string {
    return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

/** Lee una hoja y devuelve filas como objetos, usando la primera fila como encabezado. */
async function leerHoja(ruta: string): Promise<Record<string, string>[]> {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ruta);
    const hoja = libro.worksheets[0];
    if (!hoja) throw new Error(`El archivo ${ruta} no tiene hojas.`);

    const encabezados: string[] = [];
    hoja.getRow(1).eachCell((celda, col) => {
        encabezados[col] = String(celda.text).trim().toLowerCase();
    });

    const filas: Record<string, string>[] = [];
    hoja.eachRow((fila, numero) => {
        if (numero === 1) return;
        const obj: Record<string, string> = {};
        fila.eachCell({ includeEmpty: true }, (celda, col) => {
            const clave = encabezados[col];
            if (clave) obj[clave] = String(celda.text ?? '').trim();
        });
        if (Object.values(obj).some((v) => v !== '')) filas.push(obj);
    });
    return filas;
}

async function main(): Promise<void> {
    if (!existsSync(RUTA_ESTUDIANTES)) {
        throw new Error(`No se encontró ${RUTA_ESTUDIANTES}`);
    }

    const filas = await leerHoja(RUTA_ESTUDIANTES);
    console.log(`Filas leídas del Excel: ${filas.length}`);

    const estudiantes: Estudiante[] = [];
    const descartados = { nivel: 0, modalidad: 0, semestre: 0 };
    const carrerasDesconocidas = new Map<string, number>();
    const vistos = new Set<string>();
    const duplicados: string[] = [];

    for (const fila of filas) {
        const nivel = (fila['nivel'] ?? '').toLowerCase();
        const tipo = (fila['tipo'] ?? '').toLowerCase();
        if (!nivel.startsWith('licenciatura')) { descartados.nivel++; continue; }
        if (!tipo.startsWith('presencial')) { descartados.modalidad++; continue; }

        const textoCarrera = fila['carrera'] ?? '';
        const carrera = clavePorNombre(textoCarrera);
        if (!carrera) {
            carrerasDesconocidas.set(textoCarrera, (carrerasDesconocidas.get(textoCarrera) ?? 0) + 1);
            continue;
        }

        const semestre = Number.parseInt(fila['semestre'] ?? '', 10);
        if (!Number.isInteger(semestre) || semestre < 1) { descartados.semestre++; continue; }

        const control = (fila['no. control'] ?? '').toUpperCase();
        if (!control) continue;
        if (vistos.has(control)) { duplicados.push(control); continue; }
        vistos.add(control);

        estudiantes.push({
            control,
            nombre: fila['alumno'] ?? '',
            correo: fila['correo electrónico'] ?? '',
            carrera,
            semestre,
        });
    }

    // Certificados previos (opcional por ahora)
    const certificadosPrevios: Record<string, string[]> = {};
    if (existsSync(RUTA_CERTIFICADOS)) {
        for (const fila of await leerHoja(RUTA_CERTIFICADOS)) {
            const control = (fila['no. control'] ?? '').toUpperCase();
            const cert = fila['certificacion'] ?? fila['certificación'] ?? '';
            if (!control || !cert) continue;
            (certificadosPrevios[control] ??= []).push(cert);
        }
    }

    // Reporte
    console.log(`\nEstudiantes participantes: ${estudiantes.length}`);
    console.log(`Descartados -> nivel: ${descartados.nivel}, modalidad: ${descartados.modalidad}, semestre inválido: ${descartados.semestre}`);
    if (duplicados.length) console.log(`AVISO: números de control repetidos: ${duplicados.join(', ')}`);
    if (carrerasDesconocidas.size) {
        console.log('ERROR: carreras que no están en el catálogo:');
        for (const [texto, n] of carrerasDesconocidas) console.log(`  "${texto}" (${n} alumnos)`);
        throw new Error('Agrega esas carreras al catálogo antes de continuar.');
    }

    console.log('\nPor carrera:');
    const porCarrera = new Map<ClaveCarrera, number>();
    for (const e of estudiantes) porCarrera.set(e.carrera, (porCarrera.get(e.carrera) ?? 0) + 1);
    for (const [clave, nombre] of Object.entries(CARRERAS)) {
        console.log(`  ${clave.padEnd(8)} ${nombre.padEnd(18)} ${porCarrera.get(clave as ClaveCarrera) ?? 0}`);
    }

    console.log('\nElegibles por premio (bolsa inicial):');
    let problemas = 0;
    for (const p of PREMIOS) {
        const elegibles = estudiantes.filter((e) => {
            if (e.semestre < p.semestreMin) return false;
            if (p.carreras !== 'TODAS' && !p.carreras.includes(e.carrera)) return false;
            if (p.excluyeCertificacion) {
                const suyas = certificadosPrevios[e.control] ?? [];
                if (suyas.includes(p.excluyeCertificacion)) return false;
            }
            return true;
        }).length;

        const necesarios = p.cantidad + p.suplentes;
        const aviso = elegibles < necesarios ? '  <-- REVISAR' : '';
        console.log(`  ${String(p.id).padStart(2)}. ${p.nombre.padEnd(42)} ${p.cantidad} u. + ${p.suplentes} supl.  elegibles: ${elegibles}${aviso}`);
        if (elegibles < necesarios) problemas++;
    }

    const unidades = PREMIOS.reduce((s, p) => s + p.cantidad, 0);
    console.log(`\nPremios: ${PREMIOS.length} · Unidades: ${unidades}`);
    if (problemas) console.log(`AVISO: ${problemas} premio(s) con menos elegibles que ganadores + suplentes.`);

    const datos: DatosRifa = {
        generadoEn: new Date().toISOString(),
        hashEstudiantes: hash(RUTA_ESTUDIANTES),
        hashPremios: createHash('sha256').update(JSON.stringify(PREMIOS)).digest('hex'),
        estudiantes,
        premios: PREMIOS,
        certificadosPrevios,
    };

    mkdirSync('salida', { recursive: true });
    writeFileSync(RUTA_SALIDA, JSON.stringify(datos, null, 2), 'utf8');
    console.log(`\nArchivo generado: ${RUTA_SALIDA}`);
    console.log(`Huella de estudiantes: ${datos.hashEstudiantes}`);
}

main().catch((error) => {
    console.error('\nFalló la preparación:', error instanceof Error ? error.message : error);
    process.exit(1);
});