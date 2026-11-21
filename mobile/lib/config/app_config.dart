import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// Configuración inyectada por Flutter con `--dart-define-from-file`.
///
/// Las credenciales son las del MISMO proyecto Supabase que usan
/// `backend/.env` y `frontend/.env`: los tres clientes hablan con la misma
/// base de datos, y el JWT que emite Supabase para el móvil es el que
/// valida `backend/app/core/supabase_auth.py`.
class AppConfig {
  static final AppConfig _instance = AppConfig._internal();
  static const _supabaseUrlDefinida = String.fromEnvironment('SUPABASE_URL');
  static const _supabaseAnonKeyDefinida = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
  );
  static const _apiBaseUrlDefinida = String.fromEnvironment('API_BASE_URL');

  factory AppConfig() => _instance;

  AppConfig._internal();

  late String supabaseUrl;
  late String supabaseAnonKey;
  late String apiBaseUrl;

  Future<void> init() async {
    supabaseUrl = _urlParaEstaPlataforma(
      _requerido('SUPABASE_URL', _supabaseUrlDefinida),
    );
    supabaseAnonKey = _requerido('SUPABASE_ANON_KEY', _supabaseAnonKeyDefinida);
    apiBaseUrl = _urlParaEstaPlataforma(
      _apiBaseUrlDefinida.isNotEmpty
          ? _apiBaseUrlDefinida
          : 'http://127.0.0.1:8000/api/v1',
    );
  }

  /// Falla al arrancar en lugar de mostrar un error engañoso de credenciales.
  String _requerido(String clave, String valor) {
    if (valor.isEmpty) {
      throw StateError(
        'Falta $clave. Proporciona la configuración con '
        '--dart-define-from-file.',
      );
    }
    return valor;
  }

  /// El emulador de Android no ve el `localhost` del PC: su 127.0.0.1 es el
  /// del propio emulador. 10.0.2.2 es el alias que el emulador enruta hacia
  /// la máquina anfitriona. Se traduce acá para que la configuración local
  /// sirva en escritorio, web y emulador sin tener que editar URLs.
  static String _urlParaEstaPlataforma(String url) {
    if (kIsWeb || !Platform.isAndroid) return url;
    return url
        .replaceFirst('//127.0.0.1', '//10.0.2.2')
        .replaceFirst('//localhost', '//10.0.2.2');
  }

  String get supabaseAuthUrl => '$supabaseUrl/auth/v1';
}
