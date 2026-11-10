const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000; 
const BLOQUEO_MS = 5 * 60 * 1000; 

const intentos = new Map();

function clave(correo) {
    return String(correo).trim().toLowerCase();
}

function bloqueadoHasta(correo) {
    const registro = intentos.get(clave(correo));

    if (registro?.bloqueadoHasta && registro.bloqueadoHasta > Date.now()) {
        return new Date(registro.bloqueadoHasta);
    }

    return null;
}

function registrarFallo(correo) {
    const k = clave(correo);
    const ahora = Date.now();
    let registro = intentos.get(k);

    if (!registro || ahora - registro.primerFallo > VENTANA_MS) {
        registro = { fallos: 0, primerFallo: ahora, bloqueadoHasta: null };
    }

    registro.fallos += 1;

    if (registro.fallos >= MAX_INTENTOS) {
        registro = { fallos: 0, primerFallo: ahora, bloqueadoHasta: ahora + BLOQUEO_MS };
    }

    intentos.set(k, registro);

    return registro.bloqueadoHasta ? new Date(registro.bloqueadoHasta) : null;
}

function limpiar(correo) {
    intentos.delete(clave(correo));
}

module.exports = { bloqueadoHasta, registrarFallo, limpiar, MAX_INTENTOS };
