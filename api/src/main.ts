import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { setupSwagger } from './config/swagger.config';
import { ensureLocalhostSSL } from './common/utils/ssl.util';

async function bootstrap() {
  try {
    const httpsEnabled = process.env.API_HTTPS_ENABLED !== 'false';
    const httpsOptions = httpsEnabled ? await ensureLocalhostSSL() : undefined;
    const fastifyAdapter = new FastifyAdapter({
      logger: true,
      ...(httpsOptions ? { https: httpsOptions } : {}),
      trustProxy: true,
    });

    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      fastifyAdapter,
      { cors: false, bufferLogs: true },
    );
    const config = app.get(ConfigService);

    // CORS
    const corsOrigins = config.get<string>('ALLOWED_ORIGINS', '');
    if (!corsOrigins) {
      throw new Error('CORS_ORIGIN must be set in environment variables');
    }

    await app.register(cors, {
      origin: corsOrigins.split(',').map((o) => o.trim()),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: 'Content-Type, Authorization',
      credentials: true,
      maxAge: 86400,
    });

    // Security
    await app.register(helmet, { crossOriginResourcePolicy: false });

    await app.register(rateLimit, { max: 100, timeWindow: '15 minutes' });

    // Cookies & multipart
    await app.register(cookie, {
      hook: 'onRequest',
      secret: config.get<string>('COOKIE_SECRET'),
    });

    await app.register(multipart, {
      limits: { fileSize: 15 * 1024 * 1024, files: 10 },
    });
    // Global configurations
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidUnknownValues: true,
      }),
    );

    app.getHttpAdapter().get('/', (req, res) => {
      // return server is healthy
      res.status(200).send('API is healthy');
    });

    // redirect '/api' to api/docs
    app.getHttpAdapter().get('/api', (req, res) => {
      res.redirect('/api/docs');
    });

    // app.useGlobalFilters(new HttpExceptionFilter());
    app.useLogger(['error', 'warn', 'log', 'debug', 'verbose']);
    app.useWebSocketAdapter(new IoAdapter(app));
    // Swagger
    // ── Swagger (non-production only, or enable via env flag) ────────────
    if (
      process.env.NODE_ENV !== 'production' ||
      config.get<boolean>('SWAGGER_ENABLED')
    ) {
      setupSwagger(app);
      Logger.log(`Swagger UI: ${process.env.BACKEND_URL}/api/docs`);
    }
    app.getHttpAdapter().get('/health', async (req, res) => {
      res.status(200).send('API is running');
    });

    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    // App listen
    const port = config.get<number>('PORT', 8086);
    await app.listen(port, '0.0.0.0');
    Logger.log(`Application running on ${await app.getUrl()}`, 'Bootstrap');
  } catch (error) {
    Logger.error(
      'Error starting application',
      error instanceof Error ? error.stack : undefined,
      'Bootstrap',
    );
    process.exit(1);
  }
}

bootstrap();
