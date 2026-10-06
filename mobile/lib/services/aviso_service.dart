import '../models/aviso.dart';
import 'api_client.dart';

/// Interfaz por el mismo motivo que [HorarioGateway]: permitir un doble en
/// los tests sin red ni Supabase.
abstract class AvisoGateway {
  /// `GET /avisos/`: el backend ya devuelve solo los que le tocan a quien
  /// pregunta (los de su ficha, su sede o generales).
  Future<List<Aviso>> obtenerAvisos();

  /// `GET /notificaciones/`: las personales (cambios de horario,
  /// respuestas a solicitudes...). Solo lectura: marcarlas como leídas es
  /// un `PATCH` y el móvil no escribe (ARQUITECTURA_MOBILE.md).
  Future<List<Notificacion>> obtenerNotificaciones();
}

class AvisoService implements AvisoGateway {
  final ApiClient _apiClient;

  AvisoService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  @override
  Future<List<Aviso>> obtenerAvisos() async {
    final respuesta = await _apiClient.get<List<dynamic>>('/avisos/');
    return respuesta.map((a) => Aviso.fromJson(a as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<Notificacion>> obtenerNotificaciones() async {
    final respuesta = await _apiClient.get<List<dynamic>>('/notificaciones/');
    return respuesta
        .map((n) => Notificacion.fromJson(n as Map<String, dynamic>))
        .toList();
  }
}
