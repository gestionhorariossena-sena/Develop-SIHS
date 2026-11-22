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
    primary: Color(0xFF176b45),
    onPrimary: Color(0xFFffffff),
    primaryContainer: Color(0xFFddeee2),
    onPrimaryContainer: Color(0xFF17573a),
    secondary: Color(0xFF39a900),
    onSecondary: Color(0xFF17221d),
    secondaryContainer: Color(0xFFeaf2df),
    onSecondaryContainer: Color(0xFF315a16),
    tertiary: Color(0xFFa95c18),
    onTertiary: Color(0xFFffffff),
    tertiaryContainer: Color(0xFFf7e9d8),
    onTertiaryContainer: Color(0xFF79400f),
    error: Color(0xFFb53a36),
    onError: Color(0xFFffffff),
    errorContainer: Color(0xFFf9e6e2),
    onErrorContainer: Color(0xFF842c28),
    surface: Color(0xFFf7f8f4),
    onSurface: Color(0xFF17221d),
    surfaceDim: Color(0xFFe4e9e1),
    surfaceBright: Color(0xFFffffff),
    surfaceContainerLowest: Color(0xFFffffff),
    surfaceContainerLow: Color(0xFFeef1ea),
    surfaceContainer: Color(0xFFe4e9e1),
    surfaceContainerHigh: Color(0xFFd6dcd3),
    surfaceContainerHighest: Color(0xFFb5c0b5),
    onSurfaceVariant: Color(0xFF59655e),
    outline: Color(0xFFb9c4b9),
    outlineVariant: Color(0xFFd6dcd3),
    inverseSurface: Color(0xFF26332b),
    onInverseSurface: Color(0xFFf7f8f4),
    inversePrimary: Color(0xFF72c88b),
  );

  /// Los diseños de Stitch solo traen el esquema claro. Este oscuro se
  /// deriva de sus mismos tonos (primary/secondary fixed-dim, inverse) para
  /// que la app no quede ilegible de noche sin inventar una marca nueva.
  static const ColorScheme _esquemaOscuro = ColorScheme(
    brightness: Brightness.dark,
    primary: Color(0xFF72c88b),
    onPrimary: Color(0xFF102b1c),
    primaryContainer: Color(0xFF193d29),
    onPrimaryContainer: Color(0xFFbce5c7),
    secondary: Color(0xFF9bd36c),
    onSecondary: Color(0xFF19300c),
    secondaryContainer: Color(0xFF293c20),
    onSecondaryContainer: Color(0xFFcce5b8),
    tertiary: Color(0xFFe5aa6e),
    onTertiary: Color(0xFF3b220d),
    tertiaryContainer: Color(0xFF55351e),
    onTertiaryContainer: Color(0xFFf3d8ba),
    error: Color(0xFFefa39a),
    onError: Color(0xFF3e1716),
    errorContainer: Color(0xFF5a2926),
    onErrorContainer: Color(0xFFf8cbc5),
    surface: Color(0xFF141a16),
    onSurface: Color(0xFFecf1ea),
    surfaceDim: Color(0xFF101511),
    surfaceBright: Color(0xFF344139),
    surfaceContainerLowest: Color(0xFF1c241f),
    surfaceContainerLow: Color(0xFF202a23),
    surfaceContainer: Color(0xFF28352c),
    surfaceContainerHigh: Color(0xFF344139),
    surfaceContainerHighest: Color(0xFF46554a),
    onSurfaceVariant: Color(0xFFb6c0b7),
    outline: Color(0xFF516056),
    outlineVariant: Color(0xFF344139),
    inverseSurface: Color(0xFFecf1ea),
    onInverseSurface: Color(0xFF17221d),
    inversePrimary: Color(0xFF176b45),
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
