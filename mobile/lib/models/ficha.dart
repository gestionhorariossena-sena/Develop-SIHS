/// Subconjunto de `FichaResponse` (backend/app/schemas/ficha.py) que el
/// móvil muestra en el encabezado del aprendiz: GET /ficha-usuario/mi-ficha.
class Ficha {
  final int idFicha;
  final String codigoFicha;
  final String? programaNombre;
  final String? trimestreNombre;
  final String? sedeNombre;
  final int aprendicesTotales;

  const Ficha({
    required this.idFicha,
    required this.codigoFicha,
    this.programaNombre,
    this.trimestreNombre,
    this.sedeNombre,
    this.aprendicesTotales = 0,
  });

  factory Ficha.fromJson(Map<String, dynamic> json) {
    final programa = json['programa'] as Map<String, dynamic>?;
    final trimestre = json['trimestre'] as Map<String, dynamic>?;
    final sede = json['sede'] as Map<String, dynamic>?;

    return Ficha(
      idFicha: json['idFicha'] ?? 0,
      codigoFicha: json['codigoFicha']?.toString() ?? '',
      programaNombre: programa?['nombre'] ?? programa?['nombrePrograma'],
      trimestreNombre: trimestre?['nombre'],
      sedeNombre: sede?['nombre'] ?? sede?['nombreSede'],
      aprendicesTotales: json['aprendicesTotales'] ?? 0,
    );
  }

  /// "Análisis y Desarrollo de Software · Ficha 2501234"
  String get descripcion {
    final programa = programaNombre;
    if (programa == null || programa.isEmpty) return 'Ficha $codigoFicha';
    return '$programa · Ficha $codigoFicha';
  }
}
