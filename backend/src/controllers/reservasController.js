const svc = require('../services/reservas');
const { exigirMembresia } = require('../services/socios');
const h = require('../utils/horario');
const { manejar, leerId } = require('./utilidades');

const ID_INVALIDO = { mensaje: 'El identificador de la reserva no es válido' };
const NO_ENCONTRADA = { mensaje: 'Reserva no encontrada' };
const MAX_DIAS_CONSULTA = 62;

// ---------------------- Socio ----------------------

const misReservas = manejar('Error al listar reservas', 'No se pudieron consultar sus reservas',
    async (req, res) => {
        const reservas = await svc.listarReservasSocio(req.socio.id_socio);
        res.json({ reservas });
    });

const miReserva = manejar('Error al consultar reserva', 'No se pudo consultar la reserva',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const reserva = await svc.detalleReserva(id);
        if (!reserva || reserva.id_socio !== req.socio.id_socio) return res.status(404).json(NO_ENCONTRADA);
        res.json({ reserva });
    });

const crear = manejar('Error al crear reserva', 'No se pudo crear la reserva',
    async (req, res) => {
        exigirMembresia(req.socio);
        const reserva = await svc.crearReserva(req.socio, req.body);
        res.status(201).json({
            mensaje: 'Solicitud enviada. Queda pendiente hasta que el club la confirme',
            reserva
        });
    });

const modificarMia = manejar('Error al modificar reserva', 'No se pudo modificar la reserva',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        exigirMembresia(req.socio);
        const reserva = await svc.modificarReserva(id, req.body, {
            socio: req.socio,
            idUsuario: req.usuarioAuth.id
        });
        res.json({ mensaje: 'Reserva modificada. Queda pendiente hasta que el club la confirme', reserva });
    });

const cancelarMia = manejar('Error al cancelar reserva', 'No se pudo cancelar la reserva',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const reserva = await svc.cancelarReserva(id, { socio: req.socio, idUsuario: req.usuarioAuth.id });
        res.json({ mensaje: 'Reserva cancelada', reserva });
    });

// ---------------------- Administración ----------------------

const listar = manejar('Error al listar reservas', 'No se pudieron consultar las reservas',
    async (req, res) => {
        const { desde, hasta, estado } = req.query;
        const idInstalacion = req.query.id_instalacion ? leerId(req.query.id_instalacion) : null;

        if (!h.esFecha(desde) || !h.esFecha(hasta) || hasta < desde) {
            return res.status(400).json({ mensaje: 'El rango de fechas no es válido' });
        }
        if (h.diasEntre(desde, hasta) > MAX_DIAS_CONSULTA) {
            return res.status(400).json({ mensaje: 'Consulte como máximo dos meses a la vez' });
        }

        const reservas = await svc.listarReservasAdmin({ desde, hasta, id_instalacion: idInstalacion, estado });
        res.json({ reservas });
    });

const detalle = manejar('Error al consultar reserva', 'No se pudo consultar la reserva',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const reserva = await svc.detalleReserva(id);
        if (!reserva) return res.status(404).json(NO_ENCONTRADA);
        res.json({ reserva });
    });

const modificar = manejar('Error al modificar reserva', 'No se pudo modificar la reserva',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const reserva = await svc.modificarReserva(id, req.body, {
            idUsuario: req.usuarioAuth.id,
            esAdmin: true
        });
        res.json({ mensaje: 'Reserva modificada', reserva });
    });

const confirmar = manejar('Error al confirmar reserva', 'No se pudo confirmar la reserva',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const reserva = await svc.confirmarReserva(id, req.usuarioAuth.id);
        res.json({ mensaje: 'Reserva confirmada', reserva });
    });

const cancelar = manejar('Error al cancelar reserva', 'No se pudo cancelar la reserva',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim().slice(0, 200) : null;
        const reserva = await svc.cancelarReserva(id, { idUsuario: req.usuarioAuth.id, motivo: motivo || null });
        res.json({ mensaje: 'Reserva cancelada', reserva });
    });

module.exports = {
    misReservas,
    miReserva,
    crear,
    modificarMia,
    cancelarMia,
    listar,
    detalle,
    modificar,
    confirmar,
    cancelar
};
