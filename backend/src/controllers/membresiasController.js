const servicio = require('../services/membresias');
const { responderError } = require('../utils/ErrorHttp');

function validarEnteroPositivo(valor) {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0;
}

function validarBeneficiario(datos) {
    if (!datos.nombre_completo || !datos.nombre_completo.trim()) {
        return 'El nombre completo del beneficiario es requerido';
    }
    if (!datos.cedula || !/^[1-9][0-9]{0,11}$/.test(datos.cedula.trim())) {
        return 'La cédula debe tener entre 1 y 12 dígitos y no empezar con 0';
    }
    if (datos.telefono && datos.telefono.trim() && !/^[0-9]{8}$/.test(datos.telefono.trim())) {
        return 'El teléfono debe tener exactamente 8 dígitos';
    }
    if (!datos.fecha_nacimiento) {
        return 'La fecha de nacimiento es requerida';
    }
    if (!datos.parentesco || !datos.parentesco.trim()) {
        return 'El parentesco es requerido';
    }
    return null;
}

// -------------------- TIPOS DE MEMBRESÍA --------------------

async function obtenerTipos(req, res) {
    try {
        const tipos = await servicio.listarTiposMembresia();
        return res.status(200).json({ tipos });
    } catch (error) {
        return responderError(res, error, 'Error al listar tipos de membresía', 'No se pudieron cargar los tipos de membresía');
    }
}

async function crearTipo(req, res) {
    try {
        const { nombre, descripcion, precio, max_beneficiarios, max_invitados } = req.body ?? {};
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ mensaje: 'El nombre del tipo de membresía es requerido' });
        }
        if (precio === undefined || Number(precio) < 0 || Number.isNaN(Number(precio))) {
            return res.status(400).json({ mensaje: 'El precio debe ser un número mayor o igual a 0' });
        }

        const tipo = await servicio.crearTipoMembresia({
            nombre: nombre.trim(),
            descripcion: descripcion?.trim(),
            precio,
            max_beneficiarios,
            max_invitados
        });

        return res.status(201).json({ mensaje: 'Tipo de membresía creado correctamente', tipo });
    } catch (error) {
        return responderError(res, error, 'Error al crear tipo de membresía', 'No se pudo crear el tipo de membresía');
    }
}

async function actualizarTipo(req, res) {
    try {
        const { id } = req.params;
        if (!validarEnteroPositivo(id)) {
            return res.status(400).json({ mensaje: 'Identificador de tipo inválido' });
        }

        const { nombre, descripcion, precio, max_beneficiarios, max_invitados } = req.body ?? {};
        const cambios = {};
        if (nombre !== undefined) {
            if (!nombre.trim()) return res.status(400).json({ mensaje: 'El nombre no puede estar vacío' });
            cambios.nombre = nombre.trim();
        }
        if (descripcion !== undefined) cambios.descripcion = descripcion.trim() || null;
        if (precio !== undefined) {
            if (Number(precio) < 0 || Number.isNaN(Number(precio))) {
                return res.status(400).json({ mensaje: 'El precio debe ser mayor o igual a 0' });
            }
            cambios.precio = Number(precio);
        }
        if (max_beneficiarios !== undefined) cambios.max_beneficiarios = Number(max_beneficiarios);
        if (max_invitados !== undefined) cambios.max_invitados = Number(max_invitados);

        const tipo = await servicio.actualizarTipoMembresia(id, cambios);
        return res.status(200).json({ mensaje: 'Tipo de membresía actualizado', tipo });
    } catch (error) {
        return responderError(res, error, 'Error al actualizar tipo', 'No se pudo actualizar el tipo de membresía');
    }
}

// -------------------- GESTIÓN ADMIN DE MEMBRESÍAS --------------------

async function obtenerSociosMembresias(req, res) {
    try {
        const socios = await servicio.listarSociosConMembresias();
        return res.status(200).json({ socios });
    } catch (error) {
        return responderError(res, error, 'Error al consultar membresías', 'No se pudieron consultar las membresías');
    }
}

async function obtenerMembresia(req, res) {
    try {
        const { id } = req.params;
        if (!validarEnteroPositivo(id)) {
            return res.status(400).json({ mensaje: 'Identificador de membresía inválido' });
        }

        const membresia = await servicio.obtenerDetalleMembresia(id);
        return res.status(200).json({ membresia });
    } catch (error) {
        return responderError(res, error, 'Error al obtener membresía', 'No se pudo obtener el detalle de la membresía');
    }
}

async function crearMembresia(req, res) {
    try {
        const { id_socio, id_tipo_membresia, fecha_inicio, fecha_vencimiento, estado, motivo, generar_cargo } = req.body ?? {};

        if (!validarEnteroPositivo(id_socio)) {
            return res.status(400).json({ mensaje: 'Debe seleccionar un socio válido' });
        }
        if (!validarEnteroPositivo(id_tipo_membresia)) {
            return res.status(400).json({ mensaje: 'Debe seleccionar un tipo de membresía válido' });
        }
        if (estado && !servicio.ESTADOS_MEMBRESIA.includes(estado)) {
            return res.status(400).json({ mensaje: 'Estado de membresía no válido' });
        }

        const membresia = await servicio.asignarMembresia({
            id_socio,
            id_tipo_membresia,
            fecha_inicio,
            fecha_vencimiento,
            estado: estado || 'Activa',
            motivo: motivo?.trim(),
            generar_cargo: Boolean(generar_cargo),
            id_usuario_admin: req.usuarioAuth.id
        });

        return res.status(201).json({
            mensaje: 'Membresía asignada correctamente',
            membresia
        });
    } catch (error) {
        return responderError(res, error, 'Error al asignar membresía', 'No se pudo asignar la membresía');
    }
}

async function actualizarMembresia(req, res) {
    try {
        const { id } = req.params;
        if (!validarEnteroPositivo(id)) {
            return res.status(400).json({ mensaje: 'Identificador de membresía inválido' });
        }

        const { id_tipo_membresia, fecha_inicio, fecha_vencimiento, estado, motivo } = req.body ?? {};

        if (estado && !servicio.ESTADOS_MEMBRESIA.includes(estado)) {
            return res.status(400).json({ mensaje: 'Estado de membresía no válido' });
        }

        const membresia = await servicio.modificarMembresia(
            id,
            {
                id_tipo_membresia,
                fecha_inicio,
                fecha_vencimiento,
                estado,
                motivo: motivo?.trim()
            },
            req.usuarioAuth.id
        );

        return res.status(200).json({
            mensaje: 'Membresía actualizada correctamente',
            membresia
        });
    } catch (error) {
        return responderError(res, error, 'Error al actualizar membresía', 'No se pudo actualizar la membresía');
    }
}

// -------------------- BENEFICIARIOS (ADMIN Y SOCIO) --------------------

async function registrarBeneficiarioAdmin(req, res) {
    try {
        const { id } = req.params;
        if (!validarEnteroPositivo(id)) {
            return res.status(400).json({ mensaje: 'Identificador de membresía inválido' });
        }

        const errorVal = validarBeneficiario(req.body ?? {});
        if (errorVal) return res.status(400).json({ mensaje: errorVal });

        const beneficiario = await servicio.agregarBeneficiario(id, req.body);
        return res.status(201).json({
            mensaje: 'Beneficiario registrado correctamente',
            beneficiario
        });
    } catch (error) {
        return responderError(res, error, 'Error al registrar beneficiario', 'No se pudo registrar el beneficiario');
    }
}

async function quitarBeneficiarioAdmin(req, res) {
    try {
        const { id, idBeneficiario } = req.params;
        if (!validarEnteroPositivo(id) || !validarEnteroPositivo(idBeneficiario)) {
            return res.status(400).json({ mensaje: 'Identificadores inválidos' });
        }

        await servicio.eliminarBeneficiario(id, idBeneficiario);
        return res.status(200).json({ mensaje: 'Beneficiario eliminado correctamente' });
    } catch (error) {
        return responderError(res, error, 'Error al eliminar beneficiario', 'No se pudo eliminar el beneficiario');
    }
}

// -------------------- CONSULTA DEL SOCIO LOGUEADO --------------------

async function obtenerMiMembresia(req, res) {
    try {
        const datos = await servicio.consultarMembresiaPorUsuario(req.usuarioAuth.id);
        return res.status(200).json(datos);
    } catch (error) {
        return responderError(res, error, 'Error al consultar mi membresía', 'No se pudo consultar el estado de su membresía');
    }
}

async function registrarMiBeneficiario(req, res) {
    try {
        const errorVal = validarBeneficiario(req.body ?? {});
        if (errorVal) return res.status(400).json({ mensaje: errorVal });

        const info = await servicio.consultarMembresiaPorUsuario(req.usuarioAuth.id);
        if (!info.membresia_actual) {
            return res.status(400).json({ mensaje: 'No tienes una membresía asignada' });
        }

        const beneficiario = await servicio.agregarBeneficiario(info.membresia_actual.id_membresia, req.body);
        return res.status(201).json({
            mensaje: 'Beneficiario agregado correctamente',
            beneficiario
        });
    } catch (error) {
        return responderError(res, error, 'Error al registrar beneficiario', 'No se pudo registrar el beneficiario');
    }
}

async function quitarMiBeneficiario(req, res) {
    try {
        const { idBeneficiario } = req.params;
        if (!validarEnteroPositivo(idBeneficiario)) {
            return res.status(400).json({ mensaje: 'Identificador inválido' });
        }

        const info = await servicio.consultarMembresiaPorUsuario(req.usuarioAuth.id);
        if (!info.membresia_actual) {
            return res.status(400).json({ mensaje: 'No tienes una membresía asignada' });
        }

        await servicio.eliminarBeneficiario(info.membresia_actual.id_membresia, idBeneficiario);
        return res.status(200).json({ mensaje: 'Beneficiario eliminado correctamente' });
    } catch (error) {
        return responderError(res, error, 'Error al eliminar beneficiario', 'No se pudo eliminar el beneficiario');
    }
}

module.exports = {
    obtenerTipos,
    crearTipo,
    actualizarTipo,
    obtenerSociosMembresias,
    obtenerMembresia,
    crearMembresia,
    actualizarMembresia,
    registrarBeneficiarioAdmin,
    quitarBeneficiarioAdmin,
    obtenerMiMembresia,
    registrarMiBeneficiario,
    quitarMiBeneficiario
};