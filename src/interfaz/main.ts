import './estilos.css';
import logoUrl from './LogoCit.png';
import { elegiblesPara, sortearPremio, type ResultadoPremio } from '../compartido/sorteo.js';
import { CARRERAS } from '../compartido/carreras.js';
import type { DatosRifa, Estudiante, Premio } from '../compartido/tipos.js';

const CLAVE_GUARDADO = 'rifa-cit-progreso';
const MS_RULETA = 2200;

interface Progreso {
  semilla: string;
  hashDatos: string;
  indice: number;
  resultados: ResultadoPremio[];
}

let datos: DatosRifa | null = null;
let hashDatos = '';
let semilla = '';
let indice = 0;
let resultados: ResultadoPremio[] = [];
let sorteando = false;

const app = document.querySelector<HTMLDivElement>('#app')!;

/* ---------- utilidades ---------- */

function esc(texto: string): string {
  const d = document.createElement('div');
  d.textContent = texto;
  return d.innerHTML;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ganadoresPrevios(): Set<string> {
  const set = new Set<string>();
  for (const r of resultados) for (const g of r.ganadores) set.add(g.control);
  return set;
}

function nombreCarrera(clave: string): string {
  return CARRERAS[clave as keyof typeof CARRERAS] ?? clave;
}

function textoCarreras(p: Premio): string {
  if (p.carreras === 'TODAS') return 'Todas las carreras';
  return p.carreras.map(nombreCarrera).join(', ');
}

function guardar(): void {
  if (!datos) return;
  const progreso: Progreso = { semilla, hashDatos, indice, resultados };
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(progreso));
  } catch {
    /* si el navegador lo impide, la rifa sigue funcionando en memoria */
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cabecera(paso: number): string {
  const clase = (n: number) => (n === paso ? 'paso activo' : n < paso ? 'paso listo' : 'paso');
  const sub = semilla ? `Semilla ${esc(semilla)} · bloqueada` : 'Centro de Innovación Tecnológica · ITD';
  return `
    <header class="encabezado">
      <div class="marca">
        <img src="${logoUrl}" alt="Centro de Innovación Tecnológica" />
        <div>
          <div class="marca-titulo">Rifa 5° Aniversario</div>
          <div class="marca-sub">${sub}</div>
        </div>
      </div>
      <nav class="pasos">
        <div class="${clase(1)}">1 · Preparación</div>
        <div class="${clase(2)}">2 · Sorteo</div>
        <div class="${clase(3)}">3 · Resultados</div>
      </nav>
    </header>`;
}

/* ---------- pantalla 1: preparación ---------- */

function pantallaPreparacion(mensaje = ''): void {
  const cargado = datos !== null;
  const unidades = datos ? datos.premios.reduce((s, p) => s + p.cantidad, 0) : 0;

  app.innerHTML = `
    ${cabecera(1)}
    <div class="contenido">
      <h1>Preparación de la rifa</h1>
      <div class="columnas">
        <section class="tarjeta">
          <div>
            <div class="etiqueta-paso">Paso 1</div>
            <h2>Cargar datos</h2>
          </div>
          <button class="boton-secundario" id="btn-cargar">Cargar rifa-datos.json</button>
          <input type="file" id="archivo" accept=".json" hidden />
          ${mensaje}
          ${cargado ? `
            <div class="cifras">
              <div class="cifra"><div class="cifra-num">${datos!.estudiantes.length.toLocaleString('es-MX')}</div><div class="cifra-txt">Estudiantes participantes</div></div>
              <div class="cifra"><div class="cifra-num">${datos!.premios.length}</div><div class="cifra-txt">Premios</div></div>
              <div class="cifra"><div class="cifra-num">${unidades}</div><div class="cifra-txt">Unidades en total</div></div>
            </div>
            <div>
              <div class="regla-tit">Huella del archivo de datos (SHA-256)</div>
              <div class="huella">${hashDatos}</div>
            </div>
            <div>
              <div class="regla-tit">Huella del Excel de estudiantes</div>
              <div class="huella">${datos!.hashEstudiantes}</div>
            </div>` : ''}
        </section>

        <section class="tarjeta">
          <div>
            <div class="etiqueta-paso">Paso 2</div>
            <h2>Semilla del sorteo</h2>
          </div>
          <label class="aviso" for="semilla">Semilla definida por el equipo</label>
          <input type="text" id="semilla" placeholder="Ej. 7-23-5-81-14-9" />
          <p class="aviso">Díganla en voz alta frente al equipo del CIT y anótenla en el acta. Al iniciar la rifa la semilla queda bloqueada y ya no se puede cambiar.</p>
          <button class="boton-principal" id="btn-iniciar" ${cargado ? '' : 'disabled'}>Bloquear semilla e iniciar rifa</button>
        </section>
      </div>
    </div>`;

  const inputArchivo = app.querySelector<HTMLInputElement>('#archivo')!;
  app.querySelector('#btn-cargar')!.addEventListener('click', () => inputArchivo.click());
  inputArchivo.addEventListener('change', () => {
    const archivo = inputArchivo.files?.[0];
    if (archivo) void cargarArchivo(archivo);
  });

  app.querySelector('#btn-iniciar')!.addEventListener('click', () => {
    const valor = app.querySelector<HTMLInputElement>('#semilla')!.value.trim();
    if (!datos) return;
    if (valor.length < 4) {
      alert('Captura una semilla de al menos 4 caracteres.');
      return;
    }
    semilla = valor;
    indice = 0;
    resultados = [];
    guardar();
    pantallaSorteo();
  });
}

async function cargarArchivo(archivo: File): Promise<void> {
  try {
    const buffer = await archivo.arrayBuffer();
    hashDatos = await sha256(buffer);
    const texto = new TextDecoder().decode(buffer);
    const leido = JSON.parse(texto) as DatosRifa;

    if (!Array.isArray(leido.estudiantes) || !Array.isArray(leido.premios)) {
      throw new Error('El archivo no tiene la estructura esperada.');
    }
    datos = leido;
    pantallaPreparacion(`<div class="ok">Archivo cargado: ${esc(archivo.name)}</div>`);
    revisarProgresoGuardado();
  } catch (error) {
    datos = null;
    const detalle = error instanceof Error ? error.message : 'Error desconocido';
    pantallaPreparacion(`<div class="error">No se pudo leer el archivo. ${esc(detalle)}</div>`);
  }
}

function revisarProgresoGuardado(): void {
  const crudo = localStorage.getItem(CLAVE_GUARDADO);
  if (!crudo || !datos) return;
  try {
    const progreso = JSON.parse(crudo) as Progreso;
    if (progreso.hashDatos !== hashDatos) return;
    if (progreso.indice === 0) return;
    const seguir = confirm(
      `Hay una rifa en curso con la semilla ${progreso.semilla} (${progreso.indice} de ${datos.premios.length} premios sorteados).\n\n¿Continuar desde ahí?`,
    );
    if (!seguir) return;
    semilla = progreso.semilla;
    indice = progreso.indice;
    resultados = progreso.resultados;
    if (indice >= datos.premios.length) pantallaResultados();
    else pantallaSorteo();
  } catch {
    /* progreso ilegible: se ignora */
  }
}

/* ---------- pantalla 2: sorteo ---------- */

/** Sin argumento muestra el premio en turno; con `ver` muestra uno ya sorteado. */
function pantallaSorteo(ver?: number): void {
  if (!datos) return;
  if (ver === undefined && indice >= datos.premios.length) {
    pantallaResultados();
    return;
  }

  const enPantalla = ver ?? indice;
  const premio = datos.premios[enPantalla]!;
  const yaSorteado = enPantalla < indice;
  const previo = yaSorteado ? resultados.find((r) => r.premioId === premio.id) : undefined;

  const elegibles = yaSorteado
    ? previo?.elegibles ?? 0
    : elegiblesPara(premio, datos.estudiantes, datos.certificadosPrevios, ganadoresPrevios()).length;

  const avance = Math.round((indice / datos.premios.length) * 100);
  const tipo = premio.tipo === 'fisico' ? 'Premio físico' : premio.tipo === 'certificacion' ? 'Certificación' : 'Capacitación';
  const unidades = premio.cantidad === 1 ? '1 unidad' : `${premio.cantidad} unidades`;
  const semestre = premio.semestreMin <= 1 ? 'Todos' : `${premio.semestreMin}° en adelante`;

  app.innerHTML = `
    ${cabecera(2)}
    <div class="sorteo">
      <aside class="lista">
        <div style="display:flex;align-items:baseline;justify-content:space-between;">
          <h2>Premios</h2>
          <span class="item-sub">${indice} de ${datos.premios.length} sorteos</span>
        </div>
        <div class="barra"><div style="width:${avance}%"></div></div>
        <div id="lista-premios"></div>
      </aside>

      <main class="panel">
        <div class="chips">
          <span class="chip">Sorteo ${enPantalla + 1} de ${datos.premios.length}</span>
          <span class="chip">${tipo} · ${unidades} · ${premio.suplentes} suplentes</span>
          ${yaSorteado ? '<span class="chip destacado">Ya sorteado · solo consulta</span>' : ''}
        </div>
        <h1 class="titulo-premio">${esc(premio.nombre)}</h1>

        <div class="reglas">
          <div class="regla" style="flex:2">
            <div class="regla-tit">Carreras</div>
            <div class="regla-val">${esc(textoCarreras(premio))}</div>
          </div>
          <div class="regla">
            <div class="regla-tit">Semestre</div>
            <div class="regla-val">${semestre}</div>
          </div>
          <div class="regla">
            <div class="regla-tit">Excluye</div>
            <div class="regla-val">${premio.excluyeCertificaciones?.length ? esc(premio.excluyeCertificaciones.join(', ')) : 'No aplica'}</div>
          </div>
          <div class="regla" style="background:var(--acento-fondo);border-color:var(--acento)">
            <div class="regla-tit" style="color:var(--acento)">Elegibles</div>
            <div class="regla-val" style="font-size:28px;font-weight:700;color:var(--acento)">${elegibles.toLocaleString('es-MX')}</div>
          </div>
        </div>

        <div class="escenario ${yaSorteado ? 'con-resultado' : 'esperando'}" id="escenario">
          ${yaSorteado ? '' : `
            <div class="aviso">${elegibles.toLocaleString('es-MX')} estudiantes en la bolsa</div>
            <button class="boton-principal" id="btn-sortear" style="font-size:38px;padding:26px 60px;">Sortear</button>
            <div class="aviso">Saldrán ${premio.cantidad === 1 ? 'el ganador' : 'los ganadores'} y después ${premio.suplentes} suplentes en orden</div>`}
        </div>

        <div class="pie" id="pie"></div>
      </main>
    </div>`;

  dibujarLista(enPantalla);

  if (yaSorteado && previo) {
    pintarResultado(previo, premio, false);
    app.querySelector<HTMLDivElement>('#pie')!.innerHTML = `
      <span class="item-sub">Resultado del ${new Date().toLocaleDateString('es-MX')}</span>
      <button class="boton-principal" id="btn-volver">Volver al sorteo en turno</button>`;
    app.querySelector('#btn-volver')!.addEventListener('click', () => pantallaSorteo());
    return;
  }

  app.querySelector('#btn-sortear')?.addEventListener('click', () => void ejecutarSorteo(premio, enPantalla));
}

/** `enPantalla` es el índice del premio que se está mostrando a la derecha. */
function dibujarLista(enPantalla: number): void {
  if (!datos) return;
  const cont = app.querySelector<HTMLDivElement>('#lista-premios');
  if (!cont) return;

  cont.innerHTML = datos.premios
    .map((p, i) => {
      const sorteado = i < indice;
      const estado = i === enPantalla ? 'actual' : sorteado ? 'hecho' : '';
      const sub = sorteado ? 'Sorteado' : `Pendiente${p.cantidad > 1 ? ` · ${p.cantidad} u.` : ''}`;
      // Se puede abrir un premio ya sorteado, o el que sigue en turno.
      const abrible = sorteado || i === indice;
      return `
        <button class="item ${estado}" type="button" data-ir="${i}" ${abrible ? '' : 'disabled'}>
          <div class="item-num">${p.id}</div>
          <div style="text-align:left">
            <div class="item-nom">${esc(p.nombre)}</div>
            <div class="item-sub">${sub}</div>
          </div>
        </button>`;
    })
    .join('');

  cont.querySelectorAll<HTMLButtonElement>('[data-ir]').forEach((boton) => {
    boton.addEventListener('click', () => {
      if (sorteando) return;
      const destino = Number(boton.dataset.ir);
      if (destino < indice) pantallaSorteo(destino);
      else pantallaSorteo();
    });
  });

  cont.querySelector('.item.actual')?.scrollIntoView({ block: 'center' });
}

async function ejecutarSorteo(premio: Premio, enPantalla: number): Promise<void> {
  if (!datos || sorteando) return;
  sorteando = true;

  const escenario = app.querySelector<HTMLDivElement>('#escenario')!;
  const elegibles = elegiblesPara(premio, datos.estudiantes, datos.certificadosPrevios, ganadoresPrevios());
  const resultado = sortearPremio(premio, datos.estudiantes, datos.certificadosPrevios, ganadoresPrevios(), semilla);

  // Ruleta
  escenario.classList.remove('esperando');
  escenario.classList.add('con-resultado');
  escenario.innerHTML = `<div class="ruleta" id="ruleta"></div>`;
  const ruleta = escenario.querySelector<HTMLDivElement>('#ruleta')!;
  const inicio = Date.now();
  while (Date.now() - inicio < MS_RULETA) {
    const azar = elegibles[Math.floor(Math.random() * elegibles.length)];
    ruleta.textContent = azar?.nombre ?? '...';
    await esperar(60);
  }

  await pintarResultado(resultado, premio, true);

  resultados.push(resultado);
  indice++;
  guardar();
  dibujarLista(enPantalla);

  const ultimo = indice >= datos.premios.length;
  app.querySelector<HTMLDivElement>('#pie')!.innerHTML = `
    <span class="ok">Resultado guardado</span>
    <button class="boton-principal" id="btn-siguiente">${ultimo ? 'Ver resultados' : 'Siguiente sorteo'}</button>`;
  app.querySelector('#btn-siguiente')!.addEventListener('click', () => {
    if (ultimo) pantallaResultados();
    else pantallaSorteo();
  });

  sorteando = false;
}

/** Dibuja ganadores y suplentes. Con `animado` van apareciendo uno por uno. */
async function pintarResultado(resultado: ResultadoPremio, premio: Premio, animado: boolean): Promise<void> {
  const escenario = app.querySelector<HTMLDivElement>('#escenario')!;
  const pausa = (ms: number) => (animado ? esperar(ms) : Promise.resolve());

  if (premio.cantidad === 1) {
    const g = resultado.ganadores[0]!;
    escenario.innerHTML = `
      <div class="ganador">
        <div class="ganador-tit">Ganador</div>
        <div class="ganador-nom">${esc(g.nombre)}</div>
        <div class="ganador-dat">${esc(nombreCarrera(g.carrera))} · ${g.semestre}° semestre · <span class="mono">${esc(g.control)}</span></div>
      </div>`;
  } else {
    const columnas = premio.cantidad > 6 ? 'g5' : 'g3';
    escenario.innerHTML = `
      <div style="width:100%">
        <div class="ganador-tit" style="margin-bottom:10px">Ganadores</div>
        <div class="rejilla ${columnas}" id="rej-ganadores"></div>
      </div>`;
    const rej = escenario.querySelector<HTMLDivElement>('#rej-ganadores')!;
    for (const [i, g] of resultado.ganadores.entries()) {
      rej.insertAdjacentHTML('beforeend', `
        <div class="celda">
          <div class="celda-num">#${i + 1}</div>
          <div class="celda-nom">${esc(g.nombre)}</div>
          <div class="celda-dat">${esc(nombreCarrera(g.carrera))} · ${g.semestre}° · <span class="mono">${esc(g.control)}</span></div>
        </div>`);
      await pausa(320);
    }
  }

  await pausa(500);
  escenario.insertAdjacentHTML('beforeend', `
    <div style="width:100%">
      <div class="regla-tit" style="margin-bottom:8px">Suplentes en orden</div>
      <div class="rejilla ${resultado.suplentes.length > 3 ? 'g5' : 'g3'}" id="rej-suplentes"></div>
    </div>`);
  const rejS = escenario.querySelector<HTMLDivElement>('#rej-suplentes')!;
  for (const [i, s] of resultado.suplentes.entries()) {
    rejS.insertAdjacentHTML('beforeend', `
      <div class="celda suplente">
        <div class="celda-num">Suplente ${i + 1}</div>
        <div class="celda-nom">${esc(s.nombre)}</div>
        <div class="celda-dat">${esc(nombreCarrera(s.carrera))} · ${s.semestre}° · <span class="mono">${esc(s.control)}</span></div>
      </div>`);
    await pausa(260);
  }
}

/* ---------- pantalla 3: resultados ---------- */

interface Fila {
  premio: string;
  lugar: string;
  nombre: string;
  carrera: string;
  semestre: number;
  control: string;
  correo: string;
}

function construirFilas(): Fila[] {
  const filas: Fila[] = [];
  for (const r of resultados) {
    const agrega = (e: Estudiante, lugar: string) =>
      filas.push({
        premio: r.premioNombre,
        lugar,
        nombre: e.nombre,
        carrera: nombreCarrera(e.carrera),
        semestre: e.semestre,
        control: e.control,
        correo: e.correo,
      });
    r.ganadores.forEach((g, i) => agrega(g, r.ganadores.length === 1 ? 'Ganador' : `Ganador ${i + 1}`));
    r.suplentes.forEach((s, i) => agrega(s, `Suplente ${i + 1}`));
  }
  return filas;
}

function pantallaResultados(): void {
  if (!datos) return;
  const filas = construirFilas();
  const totalGanadores = resultados.reduce((s, r) => s + r.ganadores.length, 0);
  const totalSuplentes = resultados.reduce((s, r) => s + r.suplentes.length, 0);

  app.innerHTML = `
    ${cabecera(3)}
    <div class="contenido">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
        <h1 style="margin:0">Resultados de la rifa</h1>
        <div style="display:flex;gap:12px">
          <button class="boton-secundario" id="btn-csv">Descargar CSV</button>
          <button class="boton-secundario" id="btn-json">Descargar JSON</button>
        </div>
      </div>

      <div class="resumen">
        <div class="cifra"><div class="regla-tit">Fecha y hora</div><div class="regla-val">${new Date().toLocaleString('es-MX')}</div></div>
        <div class="cifra"><div class="regla-tit">Semilla</div><div class="regla-val mono">${esc(semilla)}</div></div>
        <div class="cifra"><div class="regla-tit">Huella de datos</div><div class="regla-val mono">${hashDatos.slice(0, 8)}…${hashDatos.slice(-8)}</div></div>
        <div class="cifra"><div class="regla-tit">Ganadores</div><div class="regla-val">${totalGanadores} en ${resultados.length} sorteos</div></div>
        <div class="cifra"><div class="regla-tit">Suplentes</div><div class="regla-val">${totalSuplentes}</div></div>
      </div>

      <div class="caja-tabla">
        <table class="tabla">
          <thead>
            <tr><th>Premio</th><th>Lugar</th><th>Nombre</th><th>Carrera</th><th>Sem.</th><th>No. control</th></tr>
          </thead>
          <tbody>
            ${filas.map((f) => `
              <tr>
                <td>${esc(f.premio)}</td>
                <td class="${f.lugar.startsWith('Ganador') ? 'lugar-ganador' : ''}">${f.lugar}</td>
                <td>${esc(f.nombre)}</td>
                <td>${esc(f.carrera)}</td>
                <td>${f.semestre}</td>
                <td class="mono">${esc(f.control)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  app.querySelector('#btn-csv')!.addEventListener('click', () => descargarCsv(filas));
  app.querySelector('#btn-json')!.addEventListener('click', descargarJson);
}

function descargar(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function descargarCsv(filas: Fila[]): void {
  const campo = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lineas = [
    ['Premio', 'Lugar', 'Nombre', 'Carrera', 'Semestre', 'No. control', 'Correo'].join(','),
    ...filas.map((f) => [f.premio, f.lugar, f.nombre, f.carrera, f.semestre, f.control, f.correo].map(campo).join(',')),
  ];
  // El BOM hace que Excel respete los acentos.
  descargar('resultados-rifa.csv', '\uFEFF' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
}

function descargarJson(): void {
  const contenido = {
    semilla,
    ejecutadaEn: new Date().toISOString(),
    hashDatos,
    hashEstudiantes: datos?.hashEstudiantes ?? '',
    resultados,
  };
  descargar('resultados.json', JSON.stringify(contenido, null, 2), 'application/json');
}

/* ---------- inicio ---------- */

pantallaPreparacion();