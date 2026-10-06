/// Espejo de `app/schemas/aviso.py` (`GET /avisos/`) y
/// `app/schemas/notificacion.py` (`GET /notificaciones/`).
///
/// Los dos endpoints usan `get_current_user` sin exigir rol, así que le
/// sirven igual a un Aprendiz que a un Instructor. El backend ya filtra
/// los avisos que le corresponden a cada quien. Solo se refleja lo que
/// se lee: crear o editar avisos es del coordinador, en la web.
library;

/// Las cuatro categorías que acepta `AvisoCreate` en el backend.
enum CategoriaAviso { reprogramacion, eventos, sede, extraordinario, otra }

CategoriaAviso _categoriaDesde(String? valor) => switch (valor) {
      'reprog' => CategoriaAviso.reprogramacion,
      'eventos' => CategoriaAviso.eventos,
      'sede' => CategoriaAviso.sede,
      'extraordinario' => CategoriaAviso.extraordinario,
      _ => CategoriaAviso.otra,
    };

extension CategoriaAvisoX on CategoriaAviso {
  String get etiqueta => switch (this) {
        CategoriaAviso.reprogramacion => 'Reprogramación',
        CategoriaAviso.eventos => 'Evento',
        CategoriaAviso.sede => 'Sede',
        CategoriaAviso.extraordinario => 'Extraordinario',
        CategoriaAviso.otra => 'Aviso',
      };
}

class Aviso {
  final int idAviso;
  final String titulo;
  final String cuerpo;
  final CategoriaAviso categoria;
  final DateTime fechaPublicacion;
  final DateTime? vigenteHasta;
  final String? publicadorNombre;
  final String? fichaCodigo;
  final String? sedeNombre;
  final String? adjuntoUrl;

  const Aviso({
    required this.idAviso,
    required this.titulo,
    required this.cuerpo,
    required this.categoria,
    required this.fechaPublicacion,
    this.vigenteHasta,
    this.publicadorNombre,
    this.fichaCodigo,
    this.sedeNombre,
    this.adjuntoUrl,
  });

  factory Aviso.fromJson(Map<String, dynamic> json) => Aviso(
        idAviso: json['idAviso'] as int,
        titulo: (json['titulo'] as String?) ?? '',
        cuerpo: (json['cuerpo'] as String?) ?? '',
        categoria: _categoriaDesde(json['categoria'] as String?),
        fechaPublicacion: DateTime.parse(json['fechaPublicacion'] as String).toLocal(),
        vigenteHasta: json['vigenteHasta'] == null
            ? null
            : DateTime.tryParse(json['vigenteHasta'] as String),
        publicadorNombre: json['publicadorNombre'] as String?,
        fichaCodigo: json['fichaCodigo'] as String?,
        sedeNombre: json['sedeNombre'] as String?,
        adjuntoUrl: json['adjuntoUrl'] as String?,
      );

  /// A quién va dirigido, en palabras: "Ficha 2758392", "Sede Fontibón"
  /// o "Todo el centro" cuando no tiene destinatario.
  String get alcance {
    if (fichaCodigo != null) return 'Ficha $fichaCodigo';
    if (sedeNombre != null) return 'Sede $sedeNombre';
    return 'Todo el centro';
  }
}

class Notificacion {
  final int idNotificacion;
  final String tipo;
  final String mensaje;
  final bool leida;
  final DateTime fechaCreacion;

  const Notificacion({
    required this.idNotificacion,
    required this.tipo,
    required this.mensaje,
    required this.leida,
    required this.fechaCreacion,
  });

  factory Notificacion.fromJson(Map<String, dynamic> json) => Notificacion(
        idNotificacion: json['idNotificacion'] as int,
        tipo: (json['tipo'] as String?) ?? '',
        mensaje: (json['mensaje'] as String?) ?? '',
        leida: (json['leida'] as bool?) ?? false,
        fechaCreacion: DateTime.parse(json['fechaCreacion'] as String).toLocal(),
      );
}
