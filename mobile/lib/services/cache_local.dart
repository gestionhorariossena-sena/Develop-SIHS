import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Caché en disco del último perfil y horario vistos.
///
/// Motivo medido (2026-09-24, contra la base real): GET /usuarios/me tarda
/// ~2,4s y GET /usuarios/me/horarios ~1,7s — y la segunda llamada al mismo
/// endpoint sigue tardando ~1,9s, así que no es la validación del token
/// (que el backend ya cachea 30s) sino la latencia contra Supabase. Como el
/// móvil es de solo lectura y el horario cambia como mucho una vez por
/// trimestre, mostrar lo último conocido de inmediato y refrescar por
/// detrás convierte 5 segundos de pantalla vacía en una app que abre al
/// instante.
class CacheLocal {
  static const _clavePerfil = 'sihs.cache.perfil';
  static const _claveHorarios = 'sihs.cache.horarios';
  static const _claveFicha = 'sihs.cache.ficha';

  Future<void> guardarPerfil(Map<String, dynamic> perfil) =>
      _guardar(_clavePerfil, perfil);

  Future<Map<String, dynamic>?> leerPerfil() async =>
      await _leer(_clavePerfil) as Map<String, dynamic>?;

  Future<void> guardarHorarios(List<dynamic> horarios) =>
      _guardar(_claveHorarios, horarios);

  Future<List<dynamic>?> leerHorarios() async =>
      await _leer(_claveHorarios) as List<dynamic>?;

  Future<void> guardarFicha(Map<String, dynamic> ficha) =>
      _guardar(_claveFicha, ficha);

  Future<Map<String, dynamic>?> leerFicha() async =>
      await _leer(_claveFicha) as Map<String, dynamic>?;

  /// Al cerrar sesión. En un teléfono compartido, el horario de quien salió
  /// no puede quedar visible para el siguiente.
  Future<void> limpiar() async {
    final prefs = await SharedPreferences.getInstance();
    await Future.wait([
      prefs.remove(_clavePerfil),
      prefs.remove(_claveHorarios),
      prefs.remove(_claveFicha),
    ]);
  }

  Future<void> _guardar(String clave, Object valor) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(clave, jsonEncode(valor));
  }

  Future<Object?> _leer(String clave) async {
    final prefs = await SharedPreferences.getInstance();
    final crudo = prefs.getString(clave);
    if (crudo == null) return null;
    try {
      return jsonDecode(crudo);
    } catch (_) {
      // Formato viejo tras un cambio de modelo: se descarta en silencio,
      // la red trae lo bueno enseguida.
      return null;
    }
  }
}
