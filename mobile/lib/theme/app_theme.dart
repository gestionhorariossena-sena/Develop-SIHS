import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tema del BRAND_GUIDE_SIHS_MOBILE.md.
///
/// Los ColorScheme se escriben a mano en vez de con `ColorScheme.fromSeed`:
/// la guía fija hex exactos (verde SENA #16a34a, superficies #f8fafc /
/// #0f172a) y `fromSeed` los reinterpreta con su algoritmo de armonización
/// — el resultado no sería el color de la marca.
class AppTheme {
  /// Las fuentes de la guía (Hanken Grotesk + Geist) las descarga
  /// google_fonts en tiempo de ejecución. En `flutter test` no hay red, y
  /// una fuente que no carga cambia las métricas de texto y vuelve
  /// frágiles los tests de layout. Los tests lo ponen en false y el tema
  /// cae a la tipografía del sistema.
  static bool usarFuentesRemotas = true;

  static ThemeData get claro => _construir(_esquemaClaro);
  static ThemeData get oscuro => _construir(_esquemaOscuro);

  static const ColorScheme _esquemaClaro = ColorScheme(
    brightness: Brightness.light,
    primary: Color(0xFF006b2c),
    onPrimary: Color(0xFFffffff),
    primaryContainer: Color(0xFF00873a),
    onPrimaryContainer: Color(0xFFf7fff2),
    secondary: Color(0xFF226d00),
    onSecondary: Color(0xFFffffff),
    secondaryContainer: Color(0xFF8afd5d),
    onSecondaryContainer: Color(0xFF257400),
    tertiary: Color(0xFF8d4b00),
    onTertiary: Color(0xFFffffff),
    tertiaryContainer: Color(0xFFffdcc3),
    onTertiaryContainer: Color(0xFF6e3900),
    error: Color(0xFFba1a1a),
    onError: Color(0xFFffffff),
    errorContainer: Color(0xFFffdad6),
    onErrorContainer: Color(0xFF93000a),
    surface: Color(0xFFfaf8ff),
    onSurface: Color(0xFF131b2e),
    surfaceDim: Color(0xFFd2d9f4),
    surfaceBright: Color(0xFFfaf8ff),
    surfaceContainerLowest: Color(0xFFffffff),
    surfaceContainerLow: Color(0xFFf2f3ff),
    surfaceContainer: Color(0xFFeaedff),
    surfaceContainerHigh: Color(0xFFe2e7ff),
    surfaceContainerHighest: Color(0xFFdae2fd),
    onSurfaceVariant: Color(0xFF3e4a3d),
    outline: Color(0xFF6e7b6c),
    outlineVariant: Color(0xFFbdcaba),
    inverseSurface: Color(0xFF283044),
    onInverseSurface: Color(0xFFeef0ff),
    inversePrimary: Color(0xFF62df7d),
  );

  /// Los diseños de Stitch solo traen el esquema claro. Este oscuro se
  /// deriva de sus mismos tonos (primary/secondary fixed-dim, inverse) para
  /// que la app no quede ilegible de noche sin inventar una marca nueva.
  static const ColorScheme _esquemaOscuro = ColorScheme(
    brightness: Brightness.dark,
    primary: Color(0xFF62df7d),
    onPrimary: Color(0xFF002109),
    primaryContainer: Color(0xFF005320),
    onPrimaryContainer: Color(0xFF7ffc97),
    secondary: Color(0xFF6fdf43),
    onSecondary: Color(0xFF052100),
    secondaryContainer: Color(0xFF185200),
    onSecondaryContainer: Color(0xFF8afd5d),
    tertiary: Color(0xFFffb77d),
    onTertiary: Color(0xFF2f1500),
    tertiaryContainer: Color(0xFF6e3900),
    onTertiaryContainer: Color(0xFFffdcc3),
    error: Color(0xFFffb4ab),
    onError: Color(0xFF690005),
    errorContainer: Color(0xFF93000a),
    onErrorContainer: Color(0xFFffdad6),
    surface: Color(0xFF111318),
    onSurface: Color(0xFFe2e2e9),
    surfaceDim: Color(0xFF111318),
    surfaceBright: Color(0xFF37393e),
    surfaceContainerLowest: Color(0xFF0c0e13),
    surfaceContainerLow: Color(0xFF191c20),
    surfaceContainer: Color(0xFF1d2024),
    surfaceContainerHigh: Color(0xFF282a2f),
    surfaceContainerHighest: Color(0xFF33353a),
    onSurfaceVariant: Color(0xFFc4c6d0),
    outline: Color(0xFF8e9099),
    outlineVariant: Color(0xFF44474e),
    inverseSurface: Color(0xFFe2e2e9),
    onInverseSurface: Color(0xFF2e3036),
    inversePrimary: Color(0xFF006b2c),
  );

  static ThemeData _construir(ColorScheme esquema) {
    final base = ThemeData(colorScheme: esquema, useMaterial3: true);

    return base.copyWith(
      textTheme: _textTheme(base.textTheme),
      scaffoldBackgroundColor: esquema.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: esquema.primary,
        foregroundColor: esquema.onPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: _titulo(base.textTheme.titleLarge!).copyWith(
          color: esquema.onPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 1,
        color: esquema.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: esquema.surfaceContainerLow,
        contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: esquema.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: esquema.primary, width: 2),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: esquema.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      dividerTheme: DividerThemeData(
        color: esquema.outlineVariant,
        thickness: 1,
        space: 1,
      ),
    );
  }

  /// Hanken Grotesk para display/títulos, Geist para cuerpo — guía §Tipografía.
  static TextTheme _textTheme(TextTheme base) {
    return base.copyWith(
      displayLarge: _titulo(base.displayLarge!),
      displayMedium: _titulo(base.displayMedium!),
      displaySmall: _titulo(base.displaySmall!),
      headlineLarge: _titulo(base.headlineLarge!),
      headlineMedium: _titulo(base.headlineMedium!),
      headlineSmall: _titulo(base.headlineSmall!),
      titleLarge: _titulo(base.titleLarge!),
      titleMedium: _titulo(base.titleMedium!),
      bodyLarge: _cuerpo(base.bodyLarge!),
      bodyMedium: _cuerpo(base.bodyMedium!),
      bodySmall: _cuerpo(base.bodySmall!),
      labelLarge: _cuerpo(base.labelLarge!),
      labelMedium: _cuerpo(base.labelMedium!),
      labelSmall: _cuerpo(base.labelSmall!),
    );
  }

  static TextStyle _titulo(TextStyle base) {
    final conPeso = base.copyWith(fontWeight: FontWeight.w700);
    if (!usarFuentesRemotas) return conPeso;
    return GoogleFonts.hankenGrotesk(textStyle: conPeso);
  }

  static TextStyle _cuerpo(TextStyle base) {
    if (!usarFuentesRemotas) return base;
    return GoogleFonts.geist(textStyle: base);
  }
}
