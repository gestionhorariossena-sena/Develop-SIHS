import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/usuario.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthGateway _auth;
  StreamSubscription<AuthState>? _suscripcion;

  Usuario? _usuarioActual;
  bool _isLoading = false;
  bool _cargandoPerfil = false;
  String? _error;

  AuthProvider({AuthGateway? auth}) : _auth = auth ?? AuthService() {
    _suscripcion = _auth.authStateChanges.listen(_alCambiarSesion);
    if (_auth.isAuthenticated) {
      // Sesión restaurada del almacenamiento local al abrir la app: no
      // dispara signedIn, así que sin esto la app arrancaría autenticada
      // pero sin saber el rol de quien entró.
      unawaited(cargarPerfil());
    }
  }

  Usuario? get usuarioActual => _usuarioActual;
  bool get isLoading => _isLoading;
  bool get cargandoPerfil => _cargandoPerfil;
  String? get error => _error;
  bool get isAuthenticated => _auth.isAuthenticated;

  void _alCambiarSesion(AuthState estado) {
    if (estado.event == AuthChangeEvent.signedOut) {
      _usuarioActual = null;
    } else if (estado.event == AuthChangeEvent.signedIn) {
      unawaited(cargarPerfil());
    }
    notifyListeners();
  }

  /// Trae el perfil del backend (GET /usuarios/me), que es donde están los
  /// roles. Un fallo acá no cierra la sesión: se muestra el error y el botón
  /// de reintentar del Home sigue sirviendo.
  Future<void> cargarPerfil() async {
    _cargandoPerfil = true;
    notifyListeners();
    try {
      _usuarioActual = await _auth.obtenerUsuarioActual();
      _error = null;
    } catch (e) {
      _error = 'No se pudo cargar tu perfil: $e';
    } finally {
      _cargandoPerfil = false;
      notifyListeners();
    }
  }

  Future<bool> signIn(
    String email,
    String password, {
    bool mantenerSesion = true,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _auth.signInWithEmail(email.trim(), password);
      await _auth.recordarSesion(mantenerSesion);
      // No se arma un Usuario de mentira con el email: el perfil con roles
      // lo trae `cargarPerfil`, disparado por el evento signedIn.
      _isLoading = false;
      notifyListeners();
      return true;
    } on AuthException catch (e) {
      _error = _mensajeDeSupabase(e);
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Supabase responde en inglés ("Invalid login credentials"). Quien usa la
  /// app no tiene por qué leer eso, y "Email not confirmed" además necesita
  /// una instrucción distinta a "revisa tu contraseña".
  String _mensajeDeSupabase(AuthException e) {
    final mensaje = e.message.toLowerCase();
    if (mensaje.contains('invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }
    if (mensaje.contains('email not confirmed')) {
      return 'Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.';
    }
    return e.message;
  }

  Future<void> signOut() async {
    _isLoading = true;
    notifyListeners();
    try {
      await _auth.signOut();
      _usuarioActual = null;
      _error = null;
    } catch (e) {
      _error = 'No se pudo cerrar sesión: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Devuelve null si salió bien, o el mensaje de error si no. La pantalla
  /// no distingue si el correo existe: decirlo permitiría averiguar quién
  /// tiene cuenta en el sistema probando correos.
  Future<String?> enviarCorreoDeRecuperacion(String email) async {
    try {
      await _auth.enviarCorreoDeRecuperacion(email);
      return null;
    } catch (e) {
      return 'No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.';
    }
  }

  void limpiarError() {
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _suscripcion?.cancel();
    super.dispose();
  }
}
