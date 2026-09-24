import '../models/ficha.dart';
import '../models/horario.dart';
import 'api_client.dart';

/// Lo que [HorarioProvider] consume. Interfaz por el mismo motivo que
/// [AuthGateway]: permitir un doble en los tests sin red ni Supabase.
abstract class HorarioGateway {
  Future<List<Horario>> obtenerHorarioDeMiFicha();
  Future<List<Horario>> obtenerMisHorariosComoInstructor();

  /// Solo para Aprendiz (GET /ficha-usuario/mi-ficha). Alimenta el
  /// encabezado del diseño: programa, código de ficha y nº de aprendices.
  Future<Ficha?> obtenerMiFicha();
}

class HorarioService implements HorarioGateway {
  final ApiClient _apiClient;

  HorarioService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Aprendiz: el horario de la ficha a la que está vinculado. Responde 404
  /// si todavía no tiene ficha — [ApiException.esNoEncontrado].
  @override
  Future<List<Horario>> obtenerHorarioDeMiFicha() =>
      _pedirLista('/ficha-usuario/mi-horario');

  /// Instructor: sus propias clases. El backend ya filtra a solo publicadas
  /// (HorarioService.obtener_publicados_por_instructor) — un instructor no
  /// debe ver el borrador que el coordinador todavía está armando.
  @override
  Future<List<Horario>> obtenerMisHorariosComoInstructor() =>
      _pedirLista('/usuarios/me/horarios');

  @override
  Future<Ficha?> obtenerMiFicha() async {
    final respuesta =
        await _apiClient.get<Map<String, dynamic>>('/ficha-usuario/mi-ficha');
    return Ficha.fromJson(respuesta);
  }

  Future<List<Horario>> _pedirLista(String ruta) async {
    final respuesta = await _apiClient.get<List<dynamic>>(ruta);
    return respuesta
        .map((h) => Horario.fromJson(h as Map<String, dynamic>))
        .toList();
  }
}
