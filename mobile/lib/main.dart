import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config/app_config.dart';
import 'providers/auth_provider.dart';
import 'providers/horario_provider.dart';
import 'services/auth_service.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await AppConfig().init();

  await Supabase.initialize(
    url: AppConfig().supabaseUrl,
    // `anonKey` está marcado como deprecado a favor de `publishableKey`,
    // pero el proyecto todavía usa la anon key JWT clásica — la misma que
    // leen backend/.env y frontend/.env. El día que Supabase emita una
    // publishable key (`sb_publishable_...`) se cambian los tres a la vez.
    // ignore: deprecated_member_use
    anonKey: AppConfig().supabaseAnonKey,
  );

  // Antes de armar los providers: si en el último login se desmarcó
  // "Mantener sesión iniciada", la sesión guardada se descarta acá.
  await AuthService.cerrarSesionSiNoSeDebeRecordar();

  runApp(const SihsApp());
}

class SihsApp extends StatelessWidget {
  const SihsApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => HorarioProvider()),
      ],
      child: MaterialApp(
        title: 'SIHS',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.claro,
        darkTheme: AppTheme.oscuro,
        // Los diseños entregados (mobile/diseños movil/) solo definen el
        // esquema claro; el oscuro de AppTheme es una derivación nuestra
        // que nadie validó contra la marca. Hasta que exista un diseño
        // oscuro aprobado, la app se ve como el diseño. Volver a seguir la
        // preferencia del sistema es cambiar esta línea por
        // ThemeMode.system.
        themeMode: ThemeMode.light,
        home: const PuertaDeEntrada(),
      ),
    );
  }
}

/// Decide qué pantalla mostrar según la sesión. Es el único lugar que
/// navega entre Login y Home: así, cerrar sesión desde cualquier punto
/// (incluido el 401 del ErrorInterceptor) devuelve al Login sin que nadie
/// más tenga que enterarse.
class PuertaDeEntrada extends StatelessWidget {
  const PuertaDeEntrada({super.key});

  @override
  Widget build(BuildContext context) {
    final autenticado = context.select<AuthProvider, bool>((a) => a.isAuthenticated);
    return autenticado ? const HomeScreen() : const LoginScreen();
  }
}
