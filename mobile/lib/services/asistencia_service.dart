import '../models/asistencia.dart';
import 'api_client.dart';

/// Interfaz por el mismo motivo que [HorarioGateway]: permitir un doble en
/// los tests sin red ni Supabase.
abstract class AsistenciaGateway {
  /// Solo para Aprendiz (`GET /asistencias/mias`): lo propio y nada más.
  /// El backend lo impone con `require_aprendiz`, no es una convención del
  /// cliente.
  Future<MiAsistencia> obtenerMiAsistencia();
}

class AsistenciaService implements AsistenciaGateway {
  final ApiClient _apiClient;

  AsistenciaService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  @override
  Future<MiAsistencia> obtenerMiAsistencia() async {
    final respuesta = await _apiClient.get<Map<String, dynamic>>('/asistencias/mias');
    return MiAsistencia.fromJson(respuesta);
  }
}
