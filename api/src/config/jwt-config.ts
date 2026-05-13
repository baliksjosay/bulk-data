import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const jwtConfig = async (config: ConfigService): Promise<JwtModuleOptions> => ({
  secret: config.get<string>('jwt.accessSecret'),
  signOptions: {
    expiresIn: config.get<number>('jwt.accessExpiresIn'),
  },
  verifyOptions: {
    algorithms: ['HS256'],
  },
  global: true,
});
