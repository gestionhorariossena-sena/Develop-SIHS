/// Espejo de `app/schemas/asistencia.py` para el lado del Aprendiz
/// (`GET /asistencias/mias`).
///
/// El móvil es de solo lectura por arquitectura (ver ARQUITECTURA_MOBILE.md),
/// y en asistencia eso coincide con la regla de negocio: la asistencia la
/// certifica el instructor que dictó la clase, así que acá no hay nada que
/// escribir aunque el cliente pudiera.
library;

enum EstadoAsistencia { presente, tardanza, excusa, ausente }

EstadoAsistencia _estadoDesde(String valor) => switch (valor) {
      'presente' => EstadoAsistencia.presente,
      'tardanza' => EstadoAsistencia.tardanza,
      'excusa' => EstadoAsistencia.excusa,
      _ => EstadoAsistencia.ausente,
    };

extension EstadoAsistenciaX on EstadoAsistencia {
  String get etiqueta => switch (this) {
        EstadoAsistencia.presente => 'Presente',
        EstadoAsistencia.tardanza => 'Tarde',
        EstadoAsistencia.excusa => 'Excusa',
        EstadoAsistencia.ausente => 'Ausente',
      };
}

class SesionAsistida {
  final int idAsistencia;
  final DateTime fechaSesion;
  final EstadoAsistencia estado;
  final String? referenciaExcusa;
  final String? resultadoDescripcion;
  final String? instructorNombre;
  final String? ambienteNombre;
  final String horaInicio;
  final String horaFin;

  const SesionAsistida({
    required this.idAsistencia,
    required this.fechaSesion,
    required this.estado,
    required this.horaInicio,
    required this.horaFin,
    this.referenciaExcusa,
    this.resultadoDescripcion,
    this.instructorNombre,
    this.ambienteNombre,
  });

  factory SesionAsistida.fromJson(Map<String, dynamic> json) => SesionAsistida(
        idAsistencia: json['idAsistencia'] as int,
        fechaSesion: DateTime.parse(json['fechaSesion'] as String),
        estado: _estadoDesde(json['estado'] as String),
        referenciaExcusa: json['referenciaExcusa'] as String?,
        resultadoDescripcion: json['resultadoDescripcion'] as String?,
        instructorNombre: json['instructorNombre'] as String?,
        ambienteNombre: json['ambienteNombre'] as String?,
        horaInicio: (json['horaInicio'] as String?) ?? '',
        horaFin: (json['horaFin'] as String?) ?? '',
      );
}

class ResumenAsistencia {
  final int registradas;
  final int presente;
  final int tardanza;
  final int excusa;
  final int ausente;

  /// Sobre sesiones REGISTRADAS, no sobre las programadas del trimestre: el
  /// sistema solo sabe de las clases a las que ya les pasaron lista.
  final double porcentaje;

  const ResumenAsistencia({
    required this.registradas,
    required this.presente,
    required this.tardanza,
    required this.excusa,
    required this.ausente,
    required this.porcentaje,
  });

  factory ResumenAsistencia.fromJson(Map<String, dynamic> json) => ResumenAsistencia(
        registradas: json['registradas'] as int? ?? 0,
        presente: json['presente'] as int? ?? 0,
        tardanza: json['tardanza'] as int? ?? 0,
        excusa: json['excusa'] as int? ?? 0,
        ausente: json['ausente'] as int? ?? 0,
        porcentaje: (json['porcentaje'] as num?)?.toDouble() ?? 100.0,
      );
}

class MiAsistencia {
  final ResumenAsistencia resumen;
  final List<SesionAsistida> sesiones;

  const MiAsistencia({required this.resumen, required this.sesiones});

  factory MiAsistencia.fromJson(Map<String, dynamic> json) => MiAsistencia(
        resumen: ResumenAsistencia.fromJson(json['resumen'] as Map<String, dynamic>),
        sesiones: (json['sesiones'] as List<dynamic>? ?? [])
            .map((s) => SesionAsistida.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}
