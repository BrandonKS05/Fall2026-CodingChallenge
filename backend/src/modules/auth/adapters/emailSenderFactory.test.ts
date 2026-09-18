import { describe, expect, it, vi } from 'vitest';
import type { FetchFn } from '../../../infrastructure/http/fetch.js';
import type { Logger } from '../../../infrastructure/logging/Logger.js';
import { LoggingCodeSender } from './LoggingCodeSender.js';
import { ResendEmailSender } from './ResendEmailSender.js';
import { UnconfiguredEmailSender } from './UnconfiguredEmailSender.js';
import { createEmailSender } from './emailSenderFactory.js';

const fetchFn = (() => Promise.resolve(new Response('{}'))) as unknown as FetchFn;

function spyLogger() {
  const error = vi.fn();
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error,
    child: () => logger,
  } as unknown as Logger;
  return { logger, error };
}

describe('createEmailSender', () => {
  it('sends real email when both settings are there', () => {
    const { logger, error } = spyLogger();
    const sender = createEmailSender(
      { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Wumboo <hello@example.com>' },
      fetchFn,
      logger,
    );
    expect(sender).toBeInstanceOf(ResendEmailSender);
    expect(error).not.toHaveBeenCalled();
  });

  it('writes codes to the log when neither is there, and says nothing about it', () => {
    const { logger, error } = spyLogger();
    expect(createEmailSender({}, fetchFn, logger)).toBeInstanceOf(LoggingCodeSender);
    expect(error).not.toHaveBeenCalled();
  });

  it('refuses to pretend in production, where a logged code reaches nobody', async () => {
    const { logger } = spyLogger();
    const sender = createEmailSender({ NODE_ENV: 'production' }, fetchFn, logger);

    expect(sender).toBeInstanceOf(UnconfiguredEmailSender);
    // Sign-up fails rather than telling somebody a code is on its way.
    await expect(
      sender.send({ to: 'ada@example.com', subject: 'Your code', text: '123456' }),
    ).rejects.toThrow(/cannot send the code/i);
  });

  it('keeps serving, and complains, when only one of them is set', () => {
    const { logger, error } = spyLogger();
    const sender = createEmailSender({ RESEND_API_KEY: 're_test' }, fetchFn, logger);

    expect(sender).toBeInstanceOf(LoggingCodeSender);
    expect(error).toHaveBeenCalledWith(
      { missing: 'EMAIL_FROM', present: 'RESEND_API_KEY' },
      expect.stringContaining('EMAIL_FROM'),
    );
  });

  it('treats an address a host left blank as an address nobody set', () => {
    const { logger, error } = spyLogger();
    const sender = createEmailSender(
      { RESEND_API_KEY: 're_test', EMAIL_FROM: '   ' },
      fetchFn,
      logger,
    );

    expect(sender).toBeInstanceOf(LoggingCodeSender);
    expect(error).toHaveBeenCalledWith(
      { missing: 'EMAIL_FROM', present: 'RESEND_API_KEY' },
      expect.any(String),
    );
  });

  it('trims a value that arrived with the quotes or spaces still on it', () => {
    const { logger } = spyLogger();
    const sender = createEmailSender(
      { RESEND_API_KEY: ' re_test ', EMAIL_FROM: ' Wumboo <hello@example.com> ' },
      fetchFn,
      logger,
    );
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });
});
