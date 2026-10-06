import '../models/asistencia.dart';
import 'api_client.dart';

/// Interfaz por el mismo motivo que [HorarioGateway]: permitir un doble en
/// los tests sin red ni Supabase.
abstract class AsistenciaGateway {
  /// Solo para Aprendiz (`GET /asistencias/mias`): lo propio y nada más.
  /// El backend lo impone con `require_aprendiz`, no es una convención del
  /// cliente.
  Future<MiAsistencia> obtenerMiAsistencia();

  /// Solo para Instructor (`GET /asistencias/sesion`), y solo de SUS
  /// clases: el backend responde 404 si el bloque es de otro.
  Future<SesionAsistencia> obtenerSesion({
    required int idHorario,
    required DateTime fecha,
  });

  /// Registra o corrige la lista completa de una sesión del instructor.
  /// El backend vuelve a validar que la clase sea suya y que la fecha
  /// corresponda a un día real del bloque.
  Future<void> registrarSesion({
    required int idHorario,
    required DateTime fecha,
    required Map<String, EstadoAsistencia> marcas,
    Map<String, String?> referenciasExcusa = const {},
  }) async {
    throw UnsupportedError('Este gateway no implementa escritura de asistencia.');
  }
}

class AsistenciaService implements AsistenciaGateway {
  final ApiClient _apiClient;

  AsistenciaService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  @override
  Future<MiAsistencia> obtenerMiAsistencia() async {
    final respuesta = await _apiClient.get<Map<String, dynamic>>('/asistencias/mias');
    return MiAsistencia.fromJson(respuesta);
  }

  @override
  Future<SesionAsistencia> obtenerSesion({
    required int idHorario,
    required DateTime fecha,
  }) async {
    final respuesta = await _apiClient.get<Map<String, dynamic>>(
      '/asistencias/sesion',
      queryParameters: {'idHorario': idHorario, 'fecha': soloFecha(fecha)},
    );
    return SesionAsistencia.fromJson(respuesta);
  }

  @override
  Future<void> registrarSesion({
    required int idHorario,
    required DateTime fecha,
    required Map<String, EstadoAsistencia> marcas,
    Map<String, String?> referenciasExcusa = const {},
  }) async {
    await _apiClient.post<Map<String, dynamic>>(
      '/asistencias/sesion',
      data: {
        'idHorario': idHorario,
        'fechaSesion': soloFecha(fecha),
        'marcas': marcas.entries
            .map((entry) => {
                  'idUsuarioAprendiz': entry.key,
                  'estado': entry.value.valorApi,
                  'referenciaExcusa': entry.value == EstadoAsistencia.excusa
                      ? referenciasExcusa[entry.key]
                      : null,
                })
            .toList(),
      },
    );
  }

  /// "2026-09-25". `toIso8601String()` no sirve: arrastra la hora y la
  /// zona, y el query param del backend es un `date` puro.
  static String soloFecha(DateTime fecha) =>
      '${fecha.year.toString().padLeft(4, '0')}-'
      '${fecha.month.toString().padLeft(2, '0')}-'
      '${fecha.day.toString().padLeft(2, '0')}';
}
