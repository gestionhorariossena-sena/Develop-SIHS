import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Configuración leída de `mobile/.env` (ver `.env.example`).
///
/// Las credenciales son las del MISMO proyecto Supabase que usan
/// `backend/.env` y `frontend/.env`: los tres clientes hablan con la misma
/// base de datos, y el JWT que emite Supabase para el móvil es el que
/// valida `backend/app/core/supabase_auth.py`.
class AppConfig {
  static final AppConfig _instance = AppConfig._internal();

  factory AppConfig() => _instance;

  AppConfig._internal();

  late String supabaseUrl;
  late String supabaseAnonKey;
  late String apiBaseUrl;

  Future<void> init() async {
    await dotenv.load(fileName: '.env');

    supabaseUrl = _requerido('SUPABASE_URL');
    supabaseAnonKey = _requerido('SUPABASE_ANON_KEY');
    apiBaseUrl = _urlParaEstaPlataforma(
      dotenv.env['API_BASE_URL'] ?? 'http://127.0.0.1:8000/api/v1',
    );
  }

  /// Falla al arrancar y no en la primera petición: sin estas dos claves la
  /// app no puede autenticar a nadie, y un `.env` incompleto se manifestaría
  /// si no como un "credenciales incorrectas" que manda a buscar el problema
  /// al lado equivocado.
  String _requerido(String clave) {
    final valor = dotenv.env[clave];
    if (valor == null || valor.isEmpty) {
      throw StateError(
        'Falta $clave en mobile/.env. Cópialo de .env.example y usa los '
        'mismos valores de backend/.env.',
      );
    }
    return valor;
  }

  /// El emulador de Android no ve el `localhost` del PC: su 127.0.0.1 es el
  /// del propio emulador. 10.0.2.2 es el alias que el emulador enruta hacia
  /// la máquina anfitriona. Se traduce acá para que un mismo `.env` sirva en
  /// escritorio, web y emulador sin tener que acordarse de editarlo.
  static String _urlParaEstaPlataforma(String url) {
    if (kIsWeb || !Platform.isAndroid) return url;
    return url
        .replaceFirst('//127.0.0.1', '//10.0.2.2')
        .replaceFirst('//localhost', '//10.0.2.2');
  }

  String get supabaseAuthUrl => '$supabaseUrl/auth/v1';
}
