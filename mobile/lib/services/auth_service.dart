import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/usuario.dart';
import 'api_client.dart';

/// Lo que [AuthProvider] necesita de la autenticación. Existe como interfaz
/// para que los tests de widget puedan inyectar una implementación falsa:
/// [AuthService] toca `Supabase.instance`, que no está inicializado en un
/// `flutter test`.
abstract class AuthGateway {
  bool get isAuthenticated;
  Stream<AuthState> get authStateChanges;
  Future<void> signInWithEmail(String email, String password);
  Future<void> signOut();
  Future<Usuario?> obtenerUsuarioActual();
  Future<void> recordarSesion(bool mantener);
  Future<void> enviarCorreoDeRecuperacion(String email);
}

class AuthService implements AuthGateway {
  final ApiClient _apiClient;

  AuthService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  // Lazy y no un campo: `Supabase.instance` revienta si se toca antes de
  // `Supabase.initialize`, y esta clase se construye al armar los providers.
  SupabaseClient get _supabase => Supabase.instance.client;

  @override
  Future<void> signInWithEmail(String email, String password) async {
    await _supabase.auth.signInWithPassword(email: email, password: password);
  }

  @override
  Future<void> signOut() => _supabase.auth.signOut();

  /// Clave del "Mantener sesión iniciada" del login.
  static const _claveMantenerSesion = 'sihs.mantener_sesion';

  /// supabase_flutter persiste la sesión SIEMPRE (no tiene una opción de
  /// sesión efímera), así que el checkbox se respeta al revés: se recuerda
  /// la decisión y, si fue "no", [cerrarSesionSiNoSeDebeRecordar] la
  /// descarta en el siguiente arranque. En un teléfono compartido eso es la
  /// diferencia entre que el siguiente que lo abra vea tu horario o no.
  @override
  Future<void> recordarSesion(bool mantener) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_claveMantenerSesion, mantener);
  }

  static Future<void> cerrarSesionSiNoSeDebeRecordar() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_claveMantenerSesion) == false) {
      await Supabase.instance.client.auth.signOut();
    }
  }

  /// Supabase manda el correo de restablecimiento. Es el mismo flujo del
  /// cliente web: el enlace abre la web, no la app (el móvil no tiene deep
  /// link configurado todavía).
  @override
  Future<void> enviarCorreoDeRecuperacion(String email) =>
      _supabase.auth.resetPasswordForEmail(email.trim());

  @override
  bool get isAuthenticated => _supabase.auth.currentSession != null;

  @override
  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  /// El perfil real (con roles) vive en la BD del backend, no en Supabase
  /// Auth: el JWT solo trae id y email. Sin esta llamada no se sabe si quien
  /// entró es Instructor o Aprendiz, que es justo lo que decide qué horario
  /// pedir.
  @override
  Future<Usuario?> obtenerUsuarioActual() async {
    if (!isAuthenticated) return null;
    final respuesta = await _apiClient.get<Map<String, dynamic>>('/usuarios/me');
    return Usuario.fromJson(respuesta);
  }
}
