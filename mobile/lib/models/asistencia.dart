/// Espejo de `app/schemas/asistencia.py`, de los dos lados: el historial
/// del Aprendiz (`GET /asistencias/mias`) y la nómina que consulta el
/// Instructor (`GET /asistencias/sesion`).
///
/// El móvil es de solo lectura por arquitectura (ver ARQUITECTURA_MOBILE.md),
/// así que del schema del instructor solo se refleja lo que se lee: no hay
/// equivalente de `RegistroAsistencia`/`MarcaAsistencia`, que es lo que se
/// envía al pasar lista desde la web. Para el aprendiz, además, coincide
/// con la regla de negocio: la asistencia la certifica el instructor que
/// dictó la clase, así que no habría nada que escribir aunque el cliente
/// pudiera.
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

  String get valorApi => switch (this) {
        EstadoAsistencia.presente => 'presente',
        EstadoAsistencia.tardanza => 'tardanza',
        EstadoAsistencia.excusa => 'excusa',
        EstadoAsistencia.ausente => 'ausente',
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

/// Una fila de la nómina que el Instructor consulta
/// (`GET /asistencias/sesion`). Espejo de `AprendizDeSesion` en
/// `app/schemas/asistencia.py`.
///
/// `estado` en null significa "sin marcar", que NO es lo mismo que
/// ausente: a esa persona nadie le pasó lista ese día. La pantalla los
/// distingue porque un ausente es una falta y un sin marcar es una lista
/// a medio llenar.
class AprendizDeSesion {
  final String idUsuario;
  final String nombre;
  final String? numeroDocumento;

  /// "vocero" / "subvocero" / null (aprendiz normal).
  final String? rolEnFicha;

  final EstadoAsistencia? estado;
  final DateTime? horaMarcacion;
  final String? referenciaExcusa;

  const AprendizDeSesion({
    required this.idUsuario,
    required this.nombre,
    this.numeroDocumento,
    this.rolEnFicha,
    this.estado,
    this.horaMarcacion,
    this.referenciaExcusa,
  });

  factory AprendizDeSesion.fromJson(Map<String, dynamic> json) => AprendizDeSesion(
        idUsuario: json['idUsuario']?.toString() ?? '',
        nombre: (json['nombre'] as String?) ?? 'Sin nombre',
        numeroDocumento: json['numeroDocumento'] as String?,
        rolEnFicha: json['rolEnFicha'] as String?,
        estado: json['estado'] == null ? null : _estadoDesde(json['estado'] as String),
        horaMarcacion: json['horaMarcacion'] == null
            ? null
            : DateTime.tryParse(json['horaMarcacion'] as String),
        referenciaExcusa: json['referenciaExcusa'] as String?,
      );
}

/// Lo que el Instructor ve de una de sus clases en una fecha concreta.
/// La misma estructura sirve como estado inicial para registrar o corregir
/// la lista desde el móvil mediante `POST /asistencias/sesion`.
class SesionAsistencia {
  final int idHorario;
  final DateTime fechaSesion;
  final String? fichaCodigo;
  final String? resultadoDescripcion;
  final String? ambienteNombre;
  final String horaInicio;
  final String horaFin;

  final List<AprendizDeSesion> aprendices;

  /// Cuándo y quién pasó lista por última vez. null = nadie la pasó.
  final DateTime? registradaEn;
  final String? registradaPor;

  const SesionAsistencia({
    required this.idHorario,
    required this.fechaSesion,
    required this.horaInicio,
    required this.horaFin,
    this.aprendices = const [],
    this.fichaCodigo,
    this.resultadoDescripcion,
    this.ambienteNombre,
    this.registradaEn,
    this.registradaPor,
  });

  factory SesionAsistencia.fromJson(Map<String, dynamic> json) => SesionAsistencia(
        idHorario: json['idHorario'] as int? ?? 0,
        fechaSesion: DateTime.parse(json['fechaSesion'] as String),
        fichaCodigo: json['fichaCodigo'] as String?,
        resultadoDescripcion: json['resultadoDescripcion'] as String?,
        ambienteNombre: json['ambienteNombre'] as String?,
        horaInicio: (json['horaInicio'] as String?) ?? '',
        horaFin: (json['horaFin'] as String?) ?? '',
        aprendices: (json['aprendices'] as List<dynamic>? ?? [])
            .map((a) => AprendizDeSesion.fromJson(a as Map<String, dynamic>))
            .toList(),
        registradaEn: json['registradaEn'] == null
            ? null
            : DateTime.tryParse(json['registradaEn'] as String),
        registradaPor: json['registradaPor'] as String?,
      );

  bool get registrada => registradaEn != null;

  int contar(EstadoAsistencia estado) =>
      aprendices.where((a) => a.estado == estado).length;

  /// Los que todavía no tienen marca. Con la lista sin registrar son
  /// todos, y eso es justo lo que la pantalla necesita decir.
  int get sinMarcar => aprendices.where((a) => a.estado == null).length;
}
