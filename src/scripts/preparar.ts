import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { clavePorNombre, CARRERAS } from '../compartido/carreras.js';
import { PREMIOS } from '../compartido/premios.js';
import { elegiblesPara } from '../compartido/sorteo.js';
import type { ClaveCarrera, DatosRifa, Estudiante } from '../compartido/tipos.js';

const RUTA_ESTUDIANTES = 'datos/estudiantes.xlsx';
const RUTA_CERTIFICADOS = 'datos/certificados.xlsx';
const RUTA_SALIDA = 'salida/rifa-datos.json';

/** Nombre de la hoja -> nombre de la certificación usado en premios.ts */
const HOJAS_CERTIFICACION: Record<string, string> = {
    'diseno basico': 'SolidWorks Básico',
    'diseno profesional': 'SolidWorks Profesional',
    'green belt': 'Green Belt',
    'yellow belt': 'Yellow Belt',
    'ec0680': 'ECO-680',
    'eco680': 'ECO-680',
    'eco-680': 'ECO-680',
};

function sinAcentos(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function hash(ruta: string): string {
    return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

/** Lee una hoja y devuelve filas como objetos. `filaEncabezado` indica en qué fila están los títulos. */
function filasDeHoja(hoja: ExcelJS.Worksheet, filaEncabezado: number): Record<string, string>[] {
    const encabezados: string[] = [];
    hoja.getRow(filaEncabezado).eachCell((celda, col) => {
        encabezados[col] = sinAcentos(String(celda.text));
    });

    const filas: Record<string, string>[] = [];
    hoja.eachRow((fila, numero) => {
        if (numero <= filaEncabezado) return;
        const obj: Record<string, string> = {};
        fila.eachCell({ includeEmpty: true }, (celda, col) => {
            const clave = encabezados[col];
            if (clave) obj[clave] = String(celda.text ?? '').trim();
        });
        if (Object.values(obj).some((v) => v !== '')) filas.push(obj);
    });
    return filas;
}

async function abrir(ruta: string): Promise<ExcelJS.Workbook> {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ruta);
    return libro;
}

async function main(): Promise<void> {
    if (!existsSync(RUTA_ESTUDIANTES)) {
        throw new Error(`No se encontró ${RUTA_ESTUDIANTES}`);
    }

    /* ---------- Estudiantes ---------- */

    const libroAlumnos = await abrir(RUTA_ESTUDIANTES);
    const hojaAlumnos = libroAlumnos.worksheets[0];
    if (!hojaAlumnos) throw new Error('El archivo de estudiantes no tiene hojas.');
    const filas = filasDeHoja(hojaAlumnos, 1);
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
            correo: fila['correo electronico'] ?? '',
            carrera,
            semestre,
        });
    }

    if (carrerasDesconocidas.size) {
        console.log('ERROR: carreras que no están en el catálogo:');
        for (const [texto, n] of carrerasDesconocidas) console.log(`  "${texto}" (${n} alumnos)`);
        throw new Error('Agrega esas carreras al catálogo antes de continuar.');
    }

    console.log(`\nEstudiantes participantes: ${estudiantes.length}`);
    console.log(`Descartados -> nivel: ${descartados.nivel}, modalidad: ${descartados.modalidad}, semestre inválido: ${descartados.semestre}`);
    if (duplicados.length) console.log(`AVISO: números de control repetidos: ${duplicados.join(', ')}`);

    console.log('\nPor carrera:');
    const porCarrera = new Map<ClaveCarrera, number>();
    for (const e of estudiantes) porCarrera.set(e.carrera, (porCarrera.get(e.carrera) ?? 0) + 1);
    for (const [clave, nombre] of Object.entries(CARRERAS)) {
        console.log(`  ${clave.padEnd(8)} ${nombre.padEnd(18)} ${porCarrera.get(clave as ClaveCarrera) ?? 0}`);
    }

    /* ---------- Certificaciones previas ---------- */

    const certificadosPrevios: Record<string, string[]> = {};
    let hashCertificados = '';

    if (existsSync(RUTA_CERTIFICADOS)) {
        hashCertificados = hash(RUTA_CERTIFICADOS);

        // Índice correo -> número de control
        const porCorreo = new Map<string, string>();
        for (const e of estudiantes) {
            if (e.correo) porCorreo.set(e.correo.trim().toLowerCase(), e.control);
        }

        const libroCert = await abrir(RUTA_CERTIFICADOS);
        console.log('\nCertificaciones previas:');

        for (const hoja of libroCert.worksheets) {
            const certificacion = HOJAS_CERTIFICACION[sinAcentos(hoja.name)];
            if (!certificacion) {
                console.log(`  AVISO: la hoja "${hoja.name}" no está en el catálogo y se ignoró.`);
                continue;
            }

            let encontrados = 0;
            const sinCoincidencia: string[] = [];

            for (const fila of filasDeHoja(hoja, 2)) {
                const correo = (fila['correo'] ?? '').trim().toLowerCase();
                if (!correo) continue;
                const control = porCorreo.get(correo);
                if (!control) { sinCoincidencia.push(correo); continue; }
                const suyas = (certificadosPrevios[control] ??= []);
                if (!suyas.includes(certificacion)) suyas.push(certificacion);
                encontrados++;
            }

            console.log(`  ${certificacion.padEnd(24)} inscritos: ${encontrados}  ·  no encontrados: ${sinCoincidencia.length}`);
            if (sinCoincidencia.length) {
                console.log(`    (probables egresados o correos externos: ${sinCoincidencia.join(', ')})`);
            }
        }
    } else {
        console.log(`\nAVISO: no se encontró ${RUTA_CERTIFICADOS}, la rifa correría sin exclusiones.`);
    }

    /* ---------- Elegibles por premio ---------- */

    console.log('\nElegibles por premio (bolsa inicial):');
    const nadie = new Set<string>();
    let problemas = 0;

    for (const p of PREMIOS) {
        const elegibles = elegiblesPara(p, estudiantes, certificadosPrevios, nadie).length;
        const necesarios = p.cantidad + p.suplentes;
        const aviso = elegibles < necesarios ? '  <-- REVISAR' : '';
        console.log(`  ${String(p.id).padStart(2)}. ${p.nombre.padEnd(42)} ${p.cantidad} u. + ${p.suplentes} supl.  elegibles: ${elegibles}${aviso}`);
        if (elegibles < necesarios) problemas++;
    }

    const unidades = PREMIOS.reduce((s, p) => s + p.cantidad, 0);
    console.log(`\nSorteos: ${PREMIOS.length} · Unidades: ${unidades}`);
    if (problemas) console.log(`AVISO: ${problemas} premio(s) con menos elegibles que ganadores + suplentes.`);

    /* ---------- Salida ---------- */

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
    console.log(`Huella de estudiantes:   ${datos.hashEstudiantes}`);
    if (hashCertificados) console.log(`Huella de certificados:  ${hashCertificados}`);
}

main().catch((error) => {
    console.error('\nFalló la preparación:', error instanceof Error ? error.message : error);
    process.exit(1);
});