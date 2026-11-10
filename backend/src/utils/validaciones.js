const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esTexto(valor) {
    return typeof valor === 'string' && valor.trim().length > 0;
}

function validarCorreo(correo) {
    return typeof correo === 'string' && REGEX_CORREO.test(correo.trim())
        ? null
        : 'Debes ingresar un correo válido';
}

function validarTelefono(telefono) {
    return typeof telefono === 'string' && /^\d{8}$/.test(telefono.trim())
        ? null
        : 'El teléfono debe contener 8 dígitos';
}

function validarContrasena(contrasena) {
    return typeof contrasena === 'string' && contrasena.length >= 8
        ? null
        : 'La contraseña debe tener al menos 8 caracteres';
}

function validarFechaNacimiento(fecha) {
    const mensaje = 'La fecha de nacimiento no es válida';

    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return mensaje;
    }

    const convertida = new Date(`${fecha}T00:00:00Z`);

    if (Number.isNaN(convertida.getTime()) ||
        convertida.toISOString().slice(0, 10) !== fecha ||
        convertida > new Date()) {
        return mensaje;
    }

    return null;
}

function validarTextoCorto(valor, nombreCampo, maximo = 255) {
    if (!esTexto(valor) || valor.trim().length > maximo) {
        return `El campo ${nombreCampo} no es válido`;
    }
    return null;
}

function validarUUID(id) {
    return typeof id === 'string' && REGEX_UUID.test(id);
}

function validarDatosPersonales(datos, obligatorios) {
    const reglas = {
        nombre_completo: (v) => validarTextoCorto(v, 'nombre completo', 150),
        cedula: (v) => validarTextoCorto(v, 'cédula', 30),
        telefono: validarTelefono,
        fecha_nacimiento: validarFechaNacimiento,
        direccion: (v) => validarTextoCorto(v, 'dirección', 255)
    };

    for (const [campo, validar] of Object.entries(reglas)) {
        if (datos[campo] === undefined) {
            if (obligatorios) return 'Todos los campos son obligatorios';
            continue;
        }
        const error = validar(datos[campo]);
        if (error) return error;
    }

    return null;
}

module.exports = {
    esTexto,
    validarCorreo,
    validarTelefono,
    validarContrasena,
    validarFechaNacimiento,
    validarUUID,
    validarDatosPersonales
};
