class Usuario {
  final String idUsuario;
  final String nombre;
  final String email;
  final String? numeroDocumento;
  final List<Rol> roles;

  Usuario({
    required this.idUsuario,
    required this.nombre,
    required this.email,
    this.numeroDocumento,
    this.roles = const [],
  });

  factory Usuario.fromJson(Map<String, dynamic> json) {
    return Usuario(
      idUsuario: json['idUsuario'] ?? '',
      nombre: json['nombre'] ?? '',
      email: json['email'] ?? '',
      numeroDocumento: json['numeroDocumento'],
      roles: (json['roles'] as List?)
              ?.map((r) => Rol.fromJson(r))
              .toList() ??
          [],
    );
  }

  bool get esInstructor => roles.any((r) => r.nombre == 'Instructor');
  bool get esAprendiz => roles.any((r) => r.nombre == 'Aprendiz');
  bool get esCoordinador => roles.any((r) => r.nombre == 'Coordinador');
  bool get esAdmin => roles.any((r) => r.nombre == 'Administrador');
}

class Rol {
  final String nombre;
  final String? descripcion;

  Rol({
    required this.nombre,
    this.descripcion,
  });

  factory Rol.fromJson(Map<String, dynamic> json) {
    return Rol(
      nombre: json['nombre'] ?? '',
      descripcion: json['descripcion'],
    );
  }
}
