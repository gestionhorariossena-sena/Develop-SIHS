import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:sihs_mobile/models/ficha.dart';
import 'package:sihs_mobile/models/horario.dart';
import 'package:sihs_mobile/models/usuario.dart';
import 'package:sihs_mobile/providers/auth_provider.dart';
import 'package:sihs_mobile/providers/horario_provider.dart';
import 'package:sihs_mobile/services/auth_service.dart';
import 'package:sihs_mobile/services/horario_service.dart';
import 'package:sihs_mobile/theme/app_theme.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// En `flutter test` no hay red: google_fonts no puede descargar Hanken ni
/// Geist. Se apaga la descarga para que el tema use la tipografía del
/// sistema y las métricas de texto sean estables entre corridas.
void usarFuentesDelSistema() {
  AppTheme.usarFuentesRemotas = false;
  GoogleFonts.config.allowRuntimeFetching = false;
}

/// Doble de [AuthGateway]: [AuthService] real toca `Supabase.instance`, que
/// no está inicializado en los tests.
class AuthFalso implements AuthGateway {
  final _eventos = StreamController<AuthState>.broadcast();

  bool autenticado;
  Usuario? perfil;
  Object? errorAlEntrar;
  bool cerroSesion = false;
  List<String> credencialesRecibidas = [];

  AuthFalso({this.autenticado = false, this.perfil});

  @override
  bool get isAuthenticated => autenticado;

  @override
  Stream<AuthState> get authStateChanges => _eventos.stream;

  @override
  Future<void> signInWithEmail(String email, String password) async {
    credencialesRecibidas = [email, password];
    if (errorAlEntrar != null) throw errorAlEntrar!;
    autenticado = true;
  }

  @override
  Future<void> signOut() async {
    cerroSesion = true;
    autenticado = false;
  }

  @override
  Future<Usuario?> obtenerUsuarioActual() async => perfil;

  bool? mantenerSesionPedido;
  String? correoDeRecuperacion;
  Object? errorAlRecuperar;

  @override
  Future<void> recordarSesion(bool mantener) async =>
      mantenerSesionPedido = mantener;

  @override
  Future<void> enviarCorreoDeRecuperacion(String email) async {
    if (errorAlRecuperar != null) throw errorAlRecuperar!;
    correoDeRecuperacion = email;
  }

  void cerrar() => _eventos.close();
}

/// Doble de [HorarioGateway]. Registra qué endpoint pidió el provider, que
/// es justo lo que distingue el camino de aprendiz del de instructor.
class HorariosFalsos implements HorarioGateway {
  List<Horario> deFicha;
  List<Horario> deInstructor;
  Object? error;
  final List<String> llamadas = [];

  HorariosFalsos({
    this.deFicha = const [],
    this.deInstructor = const [],
    this.error,
  });

  @override
  Future<List<Horario>> obtenerHorarioDeMiFicha() async {
    llamadas.add('ficha');
    if (error != null) throw error!;
    return deFicha;
  }

  @override
  Future<List<Horario>> obtenerMisHorariosComoInstructor() async {
    llamadas.add('instructor');
    if (error != null) throw error!;
    return deInstructor;
  }

  Ficha? ficha;

  @override
  Future<Ficha?> obtenerMiFicha() async {
    llamadas.add('mi-ficha');
    return ficha;
  }
}

Usuario usuarioDePrueba({
  String nombre = 'Ana María Gómez',
  List<String> roles = const ['Aprendiz'],
}) {
  return Usuario(
    idUsuario: '11111111-1111-1111-1111-111111111111',
    nombre: nombre,
    email: 'ana@sena.edu.co',
    roles: [
      for (var i = 0; i < roles.length; i++) Rol(idRol: i + 1, nombre: roles[i]),
    ],
  );
}

Horario horarioDePrueba({
  int idHorario = 1,
  String horaInicio = '06:15:00',
  String horaFin = '09:00:00',
  List<int> dias = const [1],
  bool publicado = true,
  bool activo = true,
  String? instructorNombre = 'Carlos Ruiz',
  String? fichaCodigo = '2758392',
  String? ambienteNombre = 'Ambiente 201',
  String? resultadoDescripcion = 'Programar aplicaciones móviles',
}) {
  return Horario(
    idHorario: idHorario,
    horaInicio: horaInicio,
    horaFin: horaFin,
    dias: dias,
    publicado: publicado,
    activo: activo,
    instructorNombre: instructorNombre,
    fichaCodigo: fichaCodigo,
    ambienteNombre: ambienteNombre,
    resultadoDescripcion: resultadoDescripcion,
  );
}

/// Monta un widget con el tema real y los providers ya inyectados.
Widget envolver(
  Widget hijo, {
  AuthProvider? auth,
  HorarioProvider? horarios,
}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider.value(value: auth ?? AuthProvider(auth: AuthFalso())),
      ChangeNotifierProvider.value(
        value: horarios ?? HorarioProvider(servicio: HorariosFalsos()),
      ),
    ],
    child: MaterialApp(theme: AppTheme.claro, home: hijo),
  );
}
