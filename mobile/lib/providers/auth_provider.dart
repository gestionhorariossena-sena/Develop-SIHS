import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/usuario.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  AuthState? _authState;
  Usuario? _usuarioActual;
  bool _isLoading = false;
  String? _error;

  AuthState? get authState => _authState;
  Usuario? get usuarioActual => _usuarioActual;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _authService.isAuthenticated;

  AuthProvider() {
    _inicializarSuscripcion();
    _cargarUsuarioActual();
  }

  void _inicializarSuscripcion() {
    _authService.authStateChanges.listen((authState) {
      _authState = authState;
      if (authState.event == AuthChangeEvent.signedOut) {
        _usuarioActual = null;
      } else if (authState.event == AuthChangeEvent.signedIn) {
        _cargarUsuarioActual();
      }
      notifyListeners();
    });
  }

  Future<void> _cargarUsuarioActual() async {
    try {
      _usuarioActual = await _authService.obtenerUsuarioActual();
      _error = null;
      notifyListeners();
    } catch (e) {
      _error = 'No se pudo cargar el usuario actual';
      notifyListeners();
    }
  }

  Future<bool> signIn(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _authService.signInWithEmail(email, password);
      _usuarioActual = Usuario(
        idUsuario: response.user!.id,
        nombre: response.user!.email?.split('@').first ?? 'Usuario',
        email: response.user!.email ?? '',
      );
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = 'Error al iniciar sesión: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> signOut() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _authService.signOut();
      _usuarioActual = null;
      _error = null;
    } catch (e) {
      _error = 'Error al cerrar sesión: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
