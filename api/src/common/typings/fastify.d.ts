import { MultipartFile } from '@fastify/multipart';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

declare module 'fastify' {
  export interface FastifyRequest {
    storedFiles: Record<string, MultipartFile>;
    user?: AuthenticatedUser;
    sessionId?: string;
    cookies?: {
      [key: string]: string;
    };
    files?: {
      buffer: Buffer;
      fieldname: string;
      filename: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buuffer: Buffer;
    }[];
    file?: {
      buffer: Buffer;
      fieldname: string;
      filename: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buuffer: Buffer;
    };
    csRFToken?: string;
  }
}

declare module '@fastify/multipart' {
  export interface MultipartFile {
    buffer: Buffer;
    fieldname: string;
    filename: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buuffer: Buffer;
  }
  export interface Multipart {
    file: MultipartFile;
    files: MultipartFile[];
  }
}
