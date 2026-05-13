/**
 * @file swagger.config.ts
 * @description Configures Swagger / OpenAPI documentation for the Bulk Data Wholesale API.
 * Includes security scheme, global tags, and server definitions.
 */

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Bootstrap Swagger documentation.
 * Available at /api/docs in development.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Bulk Data Wholesale API')
    .setDescription(
      `## Bulk Data Wholesale API

This API powers the Bulk Data Wholesale platform.

### Authentication
All protected endpoints require a **Bearer JWT** token obtained from \`POST /api/v1/auth/login\`.
      `,
    )
    .setVersion('1.0')
    .setContact('GDExperts Ltd.', 'https://gdexperts.com', 'dev@gdexperts.com')
    .setLicense('Proprietary', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
        name: 'Authorization',
      },
      'jwt',
    )
    .addCookieAuth('accessToken', {
      type: 'apiKey',
      in: 'cookie',
      scheme: 'bearer',
      name: 'accessToken',
      description:
        'Session or refresh token stored as cookie (e.g., authToken, refreshToken)',
    })
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
      },
      'x-api-key',
    )
    .addServer(
      process.env.BACKEND_URL || 'http://localhost:8086',
      'Local server',
    )
    .addServer('http://127.0.0.1:8086', 'Local IP')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Bulk Data Wholesale — API Docs',
    customfavIcon: 'https://bulk-data.com/favicon.ico',
  });
}
