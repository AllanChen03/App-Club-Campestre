const svc = require('../services/invitados');
const { exigirMembresia } = require('../services/socios');
const h = require('../utils/horario');
const { manejar, leerId } = require('./utilidades');

const misInvitados = manejar('Error al listar invitados', 'No se pudieron consultar sus invitados',
    async (req, res) => {
        const [datos, cupo] = await Promise.all([
            svc.invitadosDelSocio(req.socio.id_socio),
            svc.cupoDelMes(req.socio)
        ]);
        res.json({ ...datos, cupo, membresia: req.socio.membresia });
    });

const consultarCupo = manejar('Error al consultar cupo', 'No se pudo consultar el cupo de invitados',
    async (req, res) => {
        const fecha = req.query.fecha ?? h.ahora().fecha;
        if (!h.esFecha(fecha)) return res.status(400).json({ mensaje: 'La fecha no es válida' });
        res.json({ cupo: await svc.cupoDelMes(req.socio, fecha) });
    });

const registrarVisita = manejar('Error al registrar invitado', 'No se pudo registrar el invitado',
    async (req, res) => {
        exigirMembresia(req.socio);
        const visita = await svc.registrarVisita(req.socio, req.body);
        res.status(201).json({ mensaje: 'Invitado registrado', visita });
    });

const cancelarVisita = manejar('Error al cancelar visita', 'No se pudo cancelar la visita',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json({ mensaje: 'El identificador no es válido' });
        await svc.cancelarVisita(req.socio, id);
        res.json({ mensaje: 'Visita cancelada' });
    });

const delDia = manejar('Error al listar invitados del día', 'No se pudieron consultar los invitados del día',
    async (req, res) => {
        const fecha = req.query.fecha ?? h.ahora().fecha;
        if (!h.esFecha(fecha)) return res.status(400).json({ mensaje: 'La fecha no es válida' });
        res.json({ fecha, visitas: await svc.invitadosDelDia(fecha) });
    });

module.exports = { misInvitados, consultarCupo, registrarVisita, cancelarVisita, delDia };
