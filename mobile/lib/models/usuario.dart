/// Espejo de `UsuarioResponse` (backend/app/schemas/usuario.py), respuesta
/// de GET /usuarios/me. Solo se mapea lo que el móvil usa: la app es de
/// lectura de horarios, no administra perfiles.
class Usuario {
  final String idUsuario;
  final String nombre;
  final String email;
  final String estado;
  final String? sigla;
  final List<Rol> roles;

  const Usuario({
    required this.idUsuario,
    required this.nombre,
    required this.email,
    this.estado = 'activo',
    this.sigla,
    this.roles = const [],
  });

  factory Usuario.fromJson(Map<String, dynamic> json) {
    return Usuario(
      idUsuario: json['idUsuario']?.toString() ?? '',
      nombre: json['nombre'] ?? '',
      email: json['email'] ?? '',
      estado: json['estado'] ?? 'activo',
      sigla: json['sigla'],
      roles: (json['roles'] as List?)
              ?.map((r) => Rol.fromJson(r as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  bool get esInstructor => _tieneRol('Instructor');
  bool get esAprendiz => _tieneRol('Aprendiz');
  bool get esCoordinador => _tieneRol('Coordinador');
  bool get esAdmin => _tieneRol('Administrador');

  bool _tieneRol(String nombre) => roles.any((r) => r.nombre == nombre);

  /// Etiqueta que se muestra bajo el nombre en el saludo del Home.
  ///
  /// Un mismo usuario puede tener varios roles (un instructor que además
  /// coordina). Se elige el que determina QUÉ horario ve — el mismo orden
  /// que usa [HorarioProvider] para decidir el endpoint.
  String get rolPrincipal {
    if (esAprendiz) return 'Aprendiz';
    if (esInstructor) return 'Instructor';
    if (esCoordinador) return 'Coordinador';
    if (esAdmin) return 'Administrador';
    return 'Sin rol asignado';
  }

  /// Primer nombre, para el saludo. "Ana María Gómez" -> "Ana".
  String get primerNombre => nombre.trim().split(RegExp(r'\s+')).first;
}

class Rol {
  final int idRol;
  final String nombre;

  const Rol({required this.idRol, required this.nombre});

  factory Rol.fromJson(Map<String, dynamic> json) {
    return Rol(
      idRol: json['idRol'] ?? 0,
      nombre: json['nombre'] ?? '',
    );
  }
}
