import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailerOptions } from '@nestjs-modules/mailer';
// templates folder should be at the root level of src
// make sure to adjust the path with the contents if it's located elsewhere
// find it at api/src/templates
const templatesDir = join(process.cwd(), 'src', 'shared', 'templates', 'email');
export const mailerConfig = (config: ConfigService): MailerOptions => ({
  transport: {
    host: config.get<string>('SMTP_HOST', 'localhost'),
    port: config.get<number>('SMTP_PORT', 25),
    secure: false,
    auth: {
      user: config.get<string>('SMTP_USER', ''),
      pass: config.get<string>('SMTP_PASS', ''),
    },
  },
  defaults: {
    from: {
      name: config.get<string>('SENDER_NAME', 'No Reply'),
      address: config.get<string>('SENDER_ADDRESS', ''),
    },
  },
  // preview: {
  //   dir: templatesDir,
  //   open: false, // config.get<boolean>('SMTP_PREVIEW_EMAIL', false),
  // },
  template: {
    dir: templatesDir,
    adapter: new HandlebarsAdapter({
      eq: (a: any, b: any) => a === b,
      ne: (a: any, b: any) => a !== b,
    }),
    options: { strict: true },
  },
});
