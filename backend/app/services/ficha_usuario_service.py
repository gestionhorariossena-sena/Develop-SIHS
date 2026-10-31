from app.models.ficha_usuario import FichaUsuario
from app.repositories.ficha_repository import FichaRepository
from app.repositories.ficha_usuario_repository import FichaUsuarioRepository
from app.repositories.horario_repository import HorarioRepository
from app.repositories.trimestre_repository import TrimestreRepository


class FichaUsuarioService:
    @staticmethod
    def vincular(db, id_usuario, codigo_ficha):
        ficha = FichaRepository.obtener_por_codigo(db, codigo_ficha)

        if not ficha:
            return "FICHA_NO_EXISTE"

        if FichaUsuarioRepository.obtener_por_usuario(db, id_usuario):
            return "YA_VINCULADO"

        nueva_relacion = FichaUsuario(idFicha=ficha.idFicha, idUsuario=id_usuario)
        FichaUsuarioRepository.crear(db, nueva_relacion)

        return ficha

    @staticmethod
    def obtener_mi_ficha(db, id_usuario):
        relacion = FichaUsuarioRepository.obtener_por_usuario(db, id_usuario)

        if not relacion:
            return None

        return FichaRepository.obtener_por_id(db, relacion.idFicha)

    @staticmethod
    def obtener_mi_rol_en_ficha(db, id_usuario):
        """rolEnFicha del Aprendiz (vocero/subvocero/None) -- lo usa
        MensajesAprendiz.tsx para decidir si puede abrir conversaciones
        nuevas (ver RemitenteNoAutorizadoError en mensajeria_service.py,
        que es quien de verdad lo hace cumplir). None también si no tiene
        ficha vinculada, igual que obtener_mi_ficha."""
        relacion = FichaUsuarioRepository.obtener_por_usuario(db, id_usuario)
        return relacion.rolEnFicha if relacion else None

    @staticmethod
    def obtener_mi_horario(db, id_usuario, id_trimestre=None):
        """Todos los horarios de la ficha vinculada del Aprendiz -- para
        la grilla semanal de MiHorarioAprendiz.tsx. None si no tiene
        ficha vinculada (mismo criterio que obtener_mi_ficha).

        Sin `id_trimestre`: comportamiento histórico -- solo responde algo
        si la ficha sigue en el trimestre vigente (si ya avanzó de
        trimestre y nadie actualizó la ficha, no se muestra nada "viejo"
        por accidente).

        Con `id_trimestre`: selector de Trimestre del Aprendiz -- se
        ignora el trimestre actual de la ficha y se consulta directo por
        ese trimestre, porque cada Horario ya trae su propio idTrimestre
        (así se puede ver un trimestre pasado aunque la ficha ya haya
        avanzado)."""
        ficha = FichaUsuarioService.obtener_mi_ficha(db, id_usuario)

        if not ficha:
            return None

        if id_trimestre is not None:
            return HorarioRepository.obtener_publicados_por_ficha(db, ficha.idFicha, id_trimestre=id_trimestre)

        vigente = TrimestreRepository.obtener_vigente(db)
        if vigente is None or ficha.idTrimestre != vigente.idTrimestre:
            return []

        return HorarioRepository.obtener_publicados_por_ficha(db, ficha.idFicha)

    @staticmethod
    def obtener_voceros(db, id_ficha):
        filas = FichaUsuarioRepository.obtener_voceros_por_ficha(db, id_ficha)
        return [
            {
                "idUsuario": usuario.idUsuario,
                "nombre": usuario.nombre,
                "email": usuario.email,
                "rolEnFicha": relacion.rolEnFicha,
            }
            for relacion, usuario in filas
        ]
