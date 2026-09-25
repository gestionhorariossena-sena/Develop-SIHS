import '../models/horario.dart';

/// Franja del día. El backend tiene `idJornada`, pero su catálogo
/// (/jornadas) exige rol de Coordinador/Admin, así que para un Aprendiz no
/// es consultable: la franja se deduce de la hora de inicio, que sí viene
/// en cada horario.
enum Jornada {
  manana('Mañana'),
  tarde('Tarde'),
  noche('Noche');

  const Jornada(this.etiqueta);
  final String etiqueta;

  static Jornada deHora(String hora24) {
    final h = int.tryParse(hora24.split(':').first) ?? 0;
    if (h < 12) return Jornada.manana;
    if (h < 18) return Jornada.tarde;
    return Jornada.noche;
  }
}

/// Estado de un bloque respecto al momento actual — las píldoras
/// "Finalizado / En curso / Por iniciar" del diseño. Solo tiene sentido en
/// el día de hoy: el martes que viene ninguna clase está "en curso".
enum EstadoSesion {
  finalizado('Finalizado'),
  enCurso('En curso'),
  porIniciar('Por iniciar'),
  otroDia('Programado');

  const EstadoSesion(this.etiqueta);
  final String etiqueta;
}

extension EstadoDeSesion on SesionHorario {
  Jornada get jornada => Jornada.deHora(horario.horaInicio);

  /// [ahora] se inyecta para que los tests no dependan del reloj real.
  EstadoSesion estadoEn(DateTime ahora) {
    // idDia 1=Lunes..6=Sábado; DateTime.weekday 1=Lunes..7=Domingo.
    if (idDia != ahora.weekday) return EstadoSesion.otroDia;

    final minutosAhora = ahora.hour * 60 + ahora.minute;
    final inicio = _enMinutos(horario.horaInicio);
    final fin = _enMinutos(horario.horaFin);

    if (minutosAhora < inicio) return EstadoSesion.porIniciar;
    if (minutosAhora >= fin) return EstadoSesion.finalizado;
    return EstadoSesion.enCurso;
  }

  static int _enMinutos(String hora24) {
    final partes = hora24.split(':');
    final h = int.tryParse(partes.first) ?? 0;
    final m = partes.length > 1 ? (int.tryParse(partes[1]) ?? 0) : 0;
    return h * 60 + m;
  }
}
