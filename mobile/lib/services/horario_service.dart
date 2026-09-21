import '../models/horario.dart';
import '../models/usuario.dart';
import 'api_client.dart';

class HorarioService {
  final ApiClient _apiClient = ApiClient();

  Future<List<Horario>> obtenerMiHorario() async {
    try {
      final response = await _apiClient.get<List<dynamic>>(
        '/ficha-usuario/mi-horario',
      );

      return (response as List<dynamic>)
          .map((h) => Horario.fromJson(h as Map<String, dynamic>))
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<List<Horario>> obtenerHorariosInstructor() async {
    try {
      final response = await _apiClient.get<List<dynamic>>(
        '/usuarios/me/horarios',
      );

      return (response as List<dynamic>)
          .map((h) => Horario.fromJson(h as Map<String, dynamic>))
          .toList();
    } catch (e) {
      rethrow;
    }
  }

  Future<Horario?> obtenerHorarioPorId(int id) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '/horarios/$id',
      );
      return Horario.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }
}
