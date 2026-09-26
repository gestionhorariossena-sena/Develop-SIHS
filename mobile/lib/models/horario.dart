/// Espejo de `HorarioResponse` (backend/app/schemas/horario.py).
///
/// Ojo con la forma real: el backend NO devuelve objetos anidados de
/// ficha/instructor/ambiente ni un `idDia` suelto. Devuelve ids planos,
/// `dias` como lista de idDia (una clase puede repetirse varios días, ver
/// la tabla puente `horario_dia`) y cuatro campos ya resueltos a texto
/// (`instructorNombre`, `fichaCodigo`, `ambienteNombre`,
/// `resultadoDescripcion`) para que el cliente no tenga que pedir los
/// catálogos aparte — importante acá porque un Aprendiz ni siquiera tiene
/// permiso de leer /dias-semana ni /ambientes.
class Horario {
  final int idHorario;

  /// "HH:MM:SS" — un `datetime.time` de Pydantic serializado.
  final String horaInicio;
  final String horaFin;

  final int idJornada;
  final int idTrimestre;
  final int idAmbiente;
  final String idInstructor;
  final int idFicha;
  final int idResultado;

  /// idDia de `diasDeLaSemana`: 1=Lunes .. 6=Sábado.
  final List<int> dias;

  final bool activo;
  final bool publicado;

  final String? instructorNombre;
  final String? fichaCodigo;
  final String? ambienteNombre;
  final String? resultadoCodigo;
  final String? resultadoDescripcion;

  const Horario({
    required this.idHorario,
    required this.horaInicio,
    required this.horaFin,
    this.idJornada = 0,
    this.idTrimestre = 0,
    this.idAmbiente = 0,
    this.idInstructor = '',
    this.idFicha = 0,
    this.idResultado = 0,
    this.dias = const [],
    this.activo = true,
    this.publicado = false,
    this.instructorNombre,
    this.fichaCodigo,
    this.ambienteNombre,
    this.resultadoCodigo,
    this.resultadoDescripcion,
  });

  factory Horario.fromJson(Map<String, dynamic> json) {
    return Horario(
      idHorario: json['idHorario'] ?? 0,
      horaInicio: json['horaInicio'] ?? '00:00:00',
      horaFin: json['horaFin'] ?? '00:00:00',
      idJornada: json['idJornada'] ?? 0,
      idTrimestre: json['idTrimestre'] ?? 0,
      idAmbiente: json['idAmbiente'] ?? 0,
      idInstructor: json['idInstructor']?.toString() ?? '',
      idFicha: json['idFicha'] ?? 0,
      idResultado: json['idResultado'] ?? 0,
      dias: (json['dias'] as List?)?.map((d) => d as int).toList() ?? const [],
      activo: json['activo'] ?? true,
      publicado: json['publicado'] ?? false,
      instructorNombre: json['instructorNombre'],
      fichaCodigo: json['fichaCodigo'],
      ambienteNombre: json['ambienteNombre'],
      resultadoCodigo: json['resultadoCodigo'],
      resultadoDescripcion: json['resultadoDescripcion'],
    );
  }

  String get fichaTexto => fichaCodigo ?? 'Ficha sin código';
  String get ambienteTexto => ambienteNombre ?? 'Ambiente por asignar';
  String get instructorTexto => instructorNombre ?? 'Instructor por asignar';
  String get temaTexto =>
      resultadoDescripcion ?? resultadoCodigo ?? 'Sin resultado de aprendizaje';

  /// Una clase programada en tres días es UNA fila en `horarios`, pero tres
  /// bloques distintos en la agenda de quien la ve. La pantalla lista
  /// bloques, no filas, así que acá se abre uno por día.
  List<SesionHorario> get sesiones =>
      dias.map((idDia) => SesionHorario(horario: this, idDia: idDia)).toList();
}

/// Un bloque concreto: este horario, en este día. Es lo que se dibuja como
/// tarjeta en "Mi horario".
class SesionHorario {
  final Horario horario;
  final int idDia;

  const SesionHorario({required this.horario, required this.idDia});

  /// 1=Lunes .. 6=Sábado, el orden de inserción de `diasDeLaSemana`
  /// (database/02_datos_prueba.sql). El catálogo /dias-semana exige rol de
  /// Coordinador/Admin/Instructor, así que un Aprendiz no puede pedirlo:
  /// el nombre se resuelve acá en vez de con una llamada que le daría 403.
  static const Map<int, String> nombresDia = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo',
  };

  String get diaTexto => nombresDia[idDia] ?? 'Día $idDia';

  String get horaInicioTexto => formatoHora12(horario.horaInicio);
  String get horaFinTexto => formatoHora12(horario.horaFin);
  String get rangoHorarioTexto => '$horaInicioTexto a $horaFinTexto';

  /// Clave estable para las animaciones de lista y para los tests.
  String get id => 'horario-${horario.idHorario}-dia-$idDia';

  /// "06:15:00" -> "6:15 a. m.". Mismo criterio de lectura que la web
  /// (frontend/src/components/horario/CeldaHorario.tsx).
  static String formatoHora12(String hora24) {
    final partes = hora24.split(':');
    if (partes.length < 2) return hora24;

    final horas = int.tryParse(partes[0]);
    final minutos = int.tryParse(partes[1]);
    if (horas == null || minutos == null) return hora24;

    final sufijo = horas < 12 ? 'a. m.' : 'p. m.';
    final hora12 = horas % 12 == 0 ? 12 : horas % 12;
    return '$hora12:${minutos.toString().padLeft(2, '0')} $sufijo';
  }

  /// Orden de agenda: primero por día de la semana, y dentro del día por
  /// hora de inicio. Sin esto, el orden es el que devolvió la base (por id
  /// de horario), que para quien mira su semana no significa nada.
  static List<SesionHorario> ordenar(List<SesionHorario> sesiones) {
    final copia = [...sesiones];
    copia.sort((a, b) {
      final porDia = a.idDia.compareTo(b.idDia);
      if (porDia != 0) return porDia;
      return a.horario.horaInicio.compareTo(b.horario.horaInicio);
    });
    return copia;
  }

  /// Expande y ordena en un paso — lo que consume la pantalla.
  static List<SesionHorario> desdeHorarios(List<Horario> horarios) =>
      ordenar([for (final h in horarios) ...h.sesiones]);
}
