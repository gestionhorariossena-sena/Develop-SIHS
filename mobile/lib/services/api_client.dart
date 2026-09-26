import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

/// Error ya traducido a algo que se le puede mostrar a una persona.
///
/// El backend responde `{"detail": "..."}` en todos sus errores
/// (FastAPI), y esos mensajes están escritos para leerse — "No tienes una
/// ficha vinculada", "No autorizado". Mostrar en su lugar el
/// `DioException` crudo cambiaría eso por "DioException [bad response]",
/// que no le dice nada a nadie.
class ApiException implements Exception {
  final int? statusCode;
  final String mensaje;

  ApiException(this.mensaje, {this.statusCode});

  /// El recurso existe pero la persona todavía no tiene el vínculo que hace
  /// falta (aprendiz sin ficha). La pantalla lo trata distinto de un error.
  bool get esNoEncontrado => statusCode == 404;

  bool get esNoAutorizado => statusCode == 401 || statusCode == 403;

  @override
  String toString() => mensaje;
}

class ApiClient {
  final Dio _dio;

  /// [dio] se inyecta en los tests; en la app se arma con la baseUrl del
  /// `.env` y los dos interceptores.
  ApiClient({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig().apiBaseUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 20),
              contentType: 'application/json',
            )) {
    if (dio == null) {
      _dio.interceptors.add(AuthInterceptor());
      _dio.interceptors.add(ErrorInterceptor());
    }
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final respuesta = await _dio.get<T>(path, queryParameters: queryParameters);
      return respuesta.data as T;
    } on DioException catch (e) {
      throw traducirError(e);
    }
  }

  Future<T> post<T>(String path, {dynamic data}) async {
    try {
      final respuesta = await _dio.post<T>(path, data: data);
      return respuesta.data as T;
    } on DioException catch (e) {
      throw traducirError(e);
    }
  }

  /// Público porque los tests del cliente lo ejercitan directamente.
  static ApiException traducirError(DioException e) {
    final codigo = e.response?.statusCode;
    final cuerpo = e.response?.data;

    if (cuerpo is Map && cuerpo['detail'] != null) {
      final detalle = cuerpo['detail'];
      return ApiException(
        detalle is String ? detalle : detalle.toString(),
        statusCode: codigo,
      );
    }

    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return ApiException(
          'El servidor está tardando demasiado en responder. Inténtalo de nuevo.',
          statusCode: codigo,
        );
      case DioExceptionType.connectionError:
        return ApiException(
          'No se pudo conectar con el servidor. Revisa tu conexión.',
          statusCode: codigo,
        );
      default:
        return ApiException(
          'El servidor tuvo un problema procesando la solicitud.',
          statusCode: codigo,
        );
    }
  }
}

/// Adjunta el access token de Supabase. Se lee en cada request (y no una
/// vez al construir el cliente) porque el SDK lo renueva solo con el
/// refresh token: cachearlo serviría un token vencido después de una hora.
class AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final sesion = Supabase.instance.client.auth.currentSession;
    if (sesion != null) {
      options.headers['Authorization'] = 'Bearer ${sesion.accessToken}';
    }
    return handler.next(options);
  }
}

/// Un 401 quiere decir que el token ya no sirve y Supabase no pudo
/// renovarlo. Cerrar sesión devuelve a Login en vez de dejar la pantalla
/// fallando en bucle contra un token muerto.
///
/// El 403 NO entra acá: ahí el token es válido y lo que falta es el rol
/// (un coordinador pidiendo /ficha-usuario/mi-horario). Sacarlo de la
/// sesión por eso sería expulsarlo por un endpoint que no le tocaba.
class ErrorInterceptor extends Interceptor {
  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      await Supabase.instance.client.auth.signOut();
    }
    return handler.next(err);
  }
}
