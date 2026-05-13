import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
const configService = new ConfigService();

export interface HttpsOptions {
  key?: Buffer;
  cert?: Buffer;
}

/**
 * Ensures that self-signed HTTPS certificates exist for localhost.
 * If missing, generates them using OpenSSL and returns the key/cert buffers.
 */
export async function ensureLocalhostSSL(): Promise<HttpsOptions> {
  const sslPath = configService.get<string>('LOCALHOST_SSL_PATH', '../../../../ssl');
  if (!sslPath) {
    console.error('❌ LOCALHOST_SSL_PATH is not set in environment variables.');
    process.exit(1);
  }
  const SSL_DIR = path.join(sslPath, '.localhost-ssl');
  const KEY_PATH = path.join(SSL_DIR, 'localhost.key');
  const CERT_PATH = path.join(SSL_DIR, 'localhost.crt');

  try {
    // Ensure SSL directory exists
    if (!fs.existsSync(SSL_DIR)) {
      fs.mkdirSync(SSL_DIR, { recursive: true });
    }

    // If certs exist, just load them
    if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
      return {
        key: fs.readFileSync(KEY_PATH),
        cert: fs.readFileSync(CERT_PATH),
      };
    }

    // Otherwise, generate self-signed certs
    console.log('🔐 Generating self-signed localhost certificates...');
     execSync(
      `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -subj "/CN=localhost"`,
      { stdio: 'inherit' },
    );

    console.log(`✅ Certificates generated at: ${SSL_DIR}`);
    return {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH),
    };
  } catch (err) {
    console.error('❌ Failed to set up HTTPS certificates:', err);
    console.error('Please ensure OpenSSL is installed and available in PATH.');
    process.exit(1);
  }
}
