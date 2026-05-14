import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MailerOptions } from '@nestjs-modules/mailer';
const templatesDir = join(process.cwd(), 'src', 'shared', 'templates');
export const mailerConfig = (config: ConfigService): MailerOptions => {
  const smtpUser = config.get<string>('SMTP_USER', '');
  const smtpPass = config.get<string>('SMTP_PASS', '');
  const smtpSecure = config.get<boolean | string>('SMTP_SECURE', false);

  return {
    transport: {
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(config.get<number | string>('SMTP_PORT', 25)),
      secure: smtpSecure === true || smtpSecure === 'true',
      ...(smtpUser
        ? {
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
        : {}),
    },
    defaults: {
      from: {
        name: config.get<string>('SENDER_NAME', 'MTN Bulk Data'),
        address:
          config.get<string>('SENDER_ADDRESS', '') ||
          smtpUser ||
          'bulkdata@mtn.co.ug',
      },
    },
    // preview: {
    //   dir: templatesDir,
    //   open: false, // config.get<boolean>('SMTP_PREVIEW_EMAIL', false),
    // },
    template: {
      dir: templatesDir,
      adapter: new HandlebarsAdapter({
        eq: (a: unknown, b: unknown) => a === b,
        ne: (a: unknown, b: unknown) => a !== b,
      }),
      options: { strict: true },
    },
  };
};
