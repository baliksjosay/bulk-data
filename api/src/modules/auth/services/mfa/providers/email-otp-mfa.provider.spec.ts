import { EmailOtpMfaProvider } from './email-otp-mfa.provider';
import { MfaMethod } from '../../../enums/mfa-method.enum';

describe('EmailOtpMfaProvider', () => {
  it('keeps the stored challenge method as email OTP when context has a method field', async () => {
    const savedChallenges: Array<Record<string, unknown>> = [];
    const repo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => {
        const saved = { ...input, id: 'challenge-1' };
        savedChallenges.push(saved);
        return saved;
      }),
    };
    const provider = new EmailOtpMfaProvider(
      repo as never,
      { hash: jest.fn(async () => 'hashed-otp') } as never,
      {
        requireById: jest.fn(async () => ({
          id: 'user-1',
          email: 'jo@example.com',
        })),
      } as never,
      {
        sendEmailOtpMfaRequested: jest.fn(async (): Promise<void> => undefined),
      } as never,
    );

    await provider.createChallenge('user-1', {
      method: 'password',
      entryMethod: 'password',
    });

    expect(savedChallenges[0]).toMatchObject({
      payload: expect.objectContaining({
        method: MfaMethod.EMAIL_OTP,
        entryMethod: 'password',
        otpHash: 'hashed-otp',
      }),
    });
  });
});
