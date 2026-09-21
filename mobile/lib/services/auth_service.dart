import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/usuario.dart';
import 'api_client.dart';

class AuthService {
  final SupabaseClient _supabase = Supabase.instance.client;
  final ApiClient _apiClient = ApiClient();

  Future<AuthResponse> signInWithEmail(String email, String password) async {
    return await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
  }

  Future<void> signOut() async {
    await _supabase.auth.signOut();
  }

  Session? get currentSession => _supabase.auth.currentSession;

  User? get currentUser => _supabase.auth.currentUser;

  bool get isAuthenticated => currentSession != null;

  Stream<AuthState> get authStateChanges => _supabase.auth.onAuthStateChange;

  Future<Usuario?> obtenerUsuarioActual() async {
    try {
      if (!isAuthenticated) return null;

      final response = await _apiClient.get<Map<String, dynamic>>(
        '/usuarios/me',
      );
      return Usuario.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }
}
