import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { sortearTodo } from '../compartido/sorteo.js';
import type { DatosRifa } from '../compartido/tipos.js';

const RUTA_DATOS = 'salida/rifa-datos.json';
const RUTA_ESTUDIANTES = 'datos/estudiantes.xlsx';
const RUTA_RESULTADOS = 'salida/resultados.json';

function hash(ruta: string): string {
    return createHash('sha256').update(readFileSync(ruta)).digest('hex');
}

function main(): void {
    const semilla = process.argv[2];
    if (!semilla) {
        console.error('Uso: npm run verificar -- "LA-SEMILLA"');
        process.exit(1);
    }

    for (const ruta of [RUTA_DATOS, RUTA_RESULTADOS]) {
        if (!existsSync(ruta)) {
            console.error(`No se encontró ${ruta}`);
            process.exit(1);
        }
    }

    const datos = JSON.parse(readFileSync(RUTA_DATOS, 'utf8')) as DatosRifa;
    const guardados = JSON.parse(readFileSync(RUTA_RESULTADOS, 'utf8')) as {
        semilla: string;
        resultados: { premioId: number; ganadores: { control: string }[]; suplentes: { control: string }[] }[];
    };

    console.log('VERIFICACIÓN DE LA RIFA\n');

    // 1. El Excel no cambió desde que se preparó
    if (existsSync(RUTA_ESTUDIANTES)) {
        const actual = hash(RUTA_ESTUDIANTES);
        const coincide = actual === datos.hashEstudiantes;
        console.log(`Huella del Excel: ${coincide ? 'coincide' : 'NO COINCIDE'}`);
        if (!coincide) {
            console.log(`  esperada: ${datos.hashEstudiantes}`);
            console.log(`  actual:   ${actual}`);
        }
    } else {
        console.log('Huella del Excel: no se pudo revisar (el archivo no está)');
    }

    // 2. La semilla es la misma que se usó
    if (guardados.semilla !== semilla) {
        console.log(`\nLa semilla capturada (${semilla}) no es la que se usó (${guardados.semilla}).`);
        process.exit(1);
    }
    console.log(`Semilla: ${semilla}`);

    // 3. Se vuelve a correr la rifa completa
    const recalculada = sortearTodo(datos, semilla);

    let iguales = 0;
    const diferencias: string[] = [];

    for (const esperado of recalculada.resultados) {
        const guardado = guardados.resultados.find((r) => r.premioId === esperado.premioId);
        if (!guardado) {
            diferencias.push(`Premio ${esperado.premioId}: no aparece en los resultados guardados`);
            continue;
        }

        const controles = (lista: { control: string }[]) => lista.map((e) => e.control).join(',');
        const ganadoresIguales = controles(guardado.ganadores) === controles(esperado.ganadores);
        const suplentesIguales = controles(guardado.suplentes) === controles(esperado.suplentes);

        if (ganadoresIguales && suplentesIguales) {
            iguales++;
        } else {
            diferencias.push(`Premio ${esperado.premioId} (${esperado.premioNombre}): los resultados no coinciden`);
        }
    }

    console.log(`\nPremios revisados: ${recalculada.resultados.length}`);
    console.log(`Coinciden: ${iguales}`);

    if (diferencias.length === 0) {
        console.log('\nRESULTADO: la rifa es reproducible. Los ganadores y suplentes son idénticos.');
    } else {
        console.log(`\nRESULTADO: se encontraron ${diferencias.length} diferencias:`);
        for (const d of diferencias) console.log(`  ${d}`);
        process.exit(1);
    }
}

main();