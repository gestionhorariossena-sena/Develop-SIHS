class Horario {
  final int idHorario;
  final int idFicha;
  final int? idInstructor;
  final int? idAmbiente;
  final int idDia;
  final String? horaInicio;
  final String? horaFin;
  final int? idTrimestre;
  final bool activo;
  final bool publicado;
  final String? observaciones;

  // Datos relacionados (incluidos en la respuesta)
  final Ficha? ficha;
  final Instructor? instructor;
  final Ambiente? ambiente;
  final Dia? dia;

  Horario({
    required this.idHorario,
    required this.idFicha,
    this.idInstructor,
    this.idAmbiente,
    required this.idDia,
    this.horaInicio,
    this.horaFin,
    this.idTrimestre,
    this.activo = true,
    this.publicado = false,
    this.observaciones,
    this.ficha,
    this.instructor,
    this.ambiente,
    this.dia,
  });

  factory Horario.fromJson(Map<String, dynamic> json) {
    return Horario(
      idHorario: json['idHorario'] ?? 0,
      idFicha: json['idFicha'] ?? 0,
      idInstructor: json['idInstructor'],
      idAmbiente: json['idAmbiente'],
      idDia: json['idDia'] ?? 0,
      horaInicio: json['horaInicio'],
      horaFin: json['horaFin'],
      idTrimestre: json['idTrimestre'],
      activo: json['activo'] ?? true,
      publicado: json['publicado'] ?? false,
      observaciones: json['observaciones'],
      ficha: json['ficha'] != null ? Ficha.fromJson(json['ficha']) : null,
      instructor: json['instructor'] != null ? Instructor.fromJson(json['instructor']) : null,
      ambiente: json['ambiente'] != null ? Ambiente.fromJson(json['ambiente']) : null,
      dia: json['dia'] != null ? Dia.fromJson(json['dia']) : null,
    );
  }

  String get horaTexto => '${horaInicio ?? "--"} a ${horaFin ?? "--"}';
  String get diaTexto => dia?.nombre ?? 'Día desconocido';
  String get fichaTexto => ficha?.nombre ?? 'Ficha desconocida';
  String get ambienteTexto => ambiente?.nombre ?? 'Ambiente no asignado';
}

class Ficha {
  final int idFicha;
  final String nombre;
  final String? codigoFicha;
  final int? nivelFormacion;

  Ficha({
    required this.idFicha,
    required this.nombre,
    this.codigoFicha,
    this.nivelFormacion,
  });

  factory Ficha.fromJson(Map<String, dynamic> json) {
    return Ficha(
      idFicha: json['idFicha'] ?? 0,
      nombre: json['nombre'] ?? '',
      codigoFicha: json['codigoFicha'],
      nivelFormacion: json['nivelFormacion'],
    );
  }
}

class Instructor {
  final String idInstructor;
  final String nombre;
  final String? email;

  Instructor({
    required this.idInstructor,
    required this.nombre,
    this.email,
  });

  factory Instructor.fromJson(Map<String, dynamic> json) {
    return Instructor(
      idInstructor: json['idInstructor'] ?? '',
      nombre: json['nombre'] ?? '',
      email: json['email'],
    );
  }
}

class Ambiente {
  final int idAmbiente;
  final String nombre;
  final String? codigo;
  final int? capacidad;

  Ambiente({
    required this.idAmbiente,
    required this.nombre,
    this.codigo,
    this.capacidad,
  });

  factory Ambiente.fromJson(Map<String, dynamic> json) {
    return Ambiente(
      idAmbiente: json['idAmbiente'] ?? 0,
      nombre: json['nombre'] ?? '',
      codigo: json['codigo'],
      capacidad: json['capacidad'],
    );
  }
}

class Dia {
  final int idDia;
  final String nombre;
  final int numeroOrden;

  Dia({
    required this.idDia,
    required this.nombre,
    this.numeroOrden = 0,
  });

  factory Dia.fromJson(Map<String, dynamic> json) {
    return Dia(
      idDia: json['idDia'] ?? 0,
      nombre: json['nombre'] ?? '',
      numeroOrden: json['numeroOrden'] ?? 0,
    );
  }
}
