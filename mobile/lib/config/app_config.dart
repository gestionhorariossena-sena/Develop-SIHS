import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  static final AppConfig _instance = AppConfig._internal();

  factory AppConfig() {
    return _instance;
  }

  AppConfig._internal();

  late String supabaseUrl;
  late String supabaseAnonKey;
  late String apiBaseUrl;

  Future<void> init() async {
    await dotenv.load(fileName: '.env');

    supabaseUrl = dotenv.env['SUPABASE_URL'] ?? 'https://your-project.supabase.co';
    supabaseAnonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';
    apiBaseUrl = dotenv.env['API_BASE_URL'] ?? 'http://127.0.0.1:8000/api/v1';
  }

  String get supabaseAuthUrl => '$supabaseUrl/auth/v1';
}
