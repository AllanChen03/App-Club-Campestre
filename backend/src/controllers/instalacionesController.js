const svc = require('../services/instalaciones');
const bloqueos = require('../services/bloqueos');
const panel = require('../services/panelInstalaciones');
const { disponibilidad } = require('../services/disponibilidad');
const { ROLES_ADMIN } = require('../utils/roles');
const h = require('../utils/horario');
const { manejar, leerId } = require('./utilidades');

const ID_INVALIDO = { mensaje: 'El identificador no es válido' };
const MAX_DIAS_REPORTE = 366;

const listar = manejar('Error al listar instalaciones', 'No se pudieron consultar las instalaciones',
    async (req, res) => {
        const esAdmin = ROLES_ADMIN.includes(req.usuarioSistema.roles?.nombre);
        const instalaciones = await svc.listarInstalaciones({ soloActivas: !esAdmin });
        res.json({ instalaciones });
    });

const crear = manejar('Error al crear instalación', 'No se pudo crear la instalación',
    async (req, res) => {
        const instalacion = await svc.crearInstalacion(req.body ?? {});
        res.status(201).json({ mensaje: 'Instalación creada', instalacion });
    });

const actualizar = manejar('Error al actualizar instalación', 'No se pudo actualizar la instalación',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const instalacion = await svc.actualizarInstalacion(id, req.body ?? {});
        res.json({ mensaje: 'Instalación actualizada', instalacion });
    });

const eliminar = manejar('Error al eliminar instalación', 'No se pudo eliminar la instalación',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const nombre = await svc.eliminarInstalacion(id, req.body?.confirmacion);
        res.json({ mensaje: `Se eliminó la instalación ${nombre}` });
    });

const crearServicio = manejar('Error al crear servicio', 'No se pudo crear el servicio',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const servicio = await svc.crearServicio(id, req.body ?? {});
        res.status(201).json({ mensaje: 'Servicio agregado', servicio });
    });

const actualizarServicio = manejar('Error al actualizar servicio', 'No se pudo actualizar el servicio',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        const servicio = await svc.actualizarServicio(id, req.body ?? {});
        res.json({ mensaje: 'Servicio actualizado', servicio });
    });

const consultarDisponibilidad = manejar('Error al consultar disponibilidad', 'No se pudo consultar la disponibilidad',
    async (req, res) => {
        const id = leerId(req.params.id);
        const { fecha } = req.query;
        const excluir = req.query.excluir ? leerId(req.query.excluir) : null;

        if (!id) return res.status(400).json(ID_INVALIDO);
        if (!h.esFecha(fecha)) return res.status(400).json({ mensaje: 'La fecha no es válida' });

        const instalacion = await svc.buscarInstalacion(id);
        if (!instalacion) return res.status(404).json({ mensaje: 'Instalación no encontrada' });

        const turnos = await disponibilidad(instalacion, fecha, excluir);
        res.json({ fecha, instalacion, turnos });
    });

const listarBloqueos = manejar('Error al listar bloqueos', 'No se pudieron consultar los bloqueos',
    async (req, res) => {
        const idInstalacion = req.query.id_instalacion ? leerId(req.query.id_instalacion) : null;
        const lista = await bloqueos.listarBloqueos({
            id_instalacion: idInstalacion,
            incluirPasados: req.query.pasados === '1'
        });
        res.json({ bloqueos: lista });
    });

const crearBloqueo = manejar('Error al crear bloqueo', 'No se pudo crear el bloqueo',
    async (req, res) => {
        const resultado = await bloqueos.crearBloqueo(req.body ?? {}, req.usuarioAuth.id);
        const n = resultado.canceladas.length;
        res.status(201).json({
            mensaje: n
                ? `Bloqueo creado. Se cancelaron ${n} ${n === 1 ? 'reserva' : 'reservas'} y se avisará a los socios`
                : 'Bloqueo creado',
            ...resultado
        });
    });

const eliminarBloqueo = manejar('Error al eliminar bloqueo', 'No se pudo eliminar el bloqueo',
    async (req, res) => {
        const id = leerId(req.params.id);
        if (!id) return res.status(400).json(ID_INVALIDO);
        await bloqueos.eliminarBloqueo(id);
        res.json({ mensaje: 'Bloqueo eliminado. Las reservas canceladas no se restauran' });
    });

const consultarOcupacion = manejar('Error al consultar ocupación', 'No se pudo consultar la ocupación',
    async (req, res) => {
        const fecha = req.query.fecha ?? h.ahora().fecha;
        if (!h.esFecha(fecha)) return res.status(400).json({ mensaje: 'La fecha no es válida' });
        res.json(await panel.ocupacion(fecha));
    });

function leerPeriodo(req, res) {
    const { desde, hasta } = req.query;
    if (!h.esFecha(desde) || !h.esFecha(hasta) || hasta < desde) {
        res.status(400).json({ mensaje: 'El periodo no es válido' });
        return null;
    }
    if (h.diasEntre(desde, hasta) > MAX_DIAS_REPORTE) {
        res.status(400).json({ mensaje: 'El periodo puede ser de hasta un año' });
        return null;
    }
    return { desde, hasta };
}

const consultarReporte = manejar('Error al generar reporte', 'No se pudo generar el reporte',
    async (req, res) => {
        const periodo = leerPeriodo(req, res);
        if (!periodo) return;
        res.json(await panel.reporteUso(periodo.desde, periodo.hasta));
    });

const descargarReporte = manejar('Error al generar PDF', 'No se pudo generar el PDF',
    async (req, res) => {
        const periodo = leerPeriodo(req, res);
        if (!periodo) return;
        const reporte = await panel.reporteUso(periodo.desde, periodo.hasta);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition',
            `attachment; filename="reporte-instalaciones-${periodo.desde}-a-${periodo.hasta}.pdf"`);
        panel.reporteUsoPdf(reporte, res);
    });

module.exports = {
    listar,
    crear,
    actualizar,
    eliminar,
    crearServicio,
    actualizarServicio,
    consultarDisponibilidad,
    listarBloqueos,
    crearBloqueo,
    eliminarBloqueo,
    consultarOcupacion,
    consultarReporte,
    descargarReporte
};
