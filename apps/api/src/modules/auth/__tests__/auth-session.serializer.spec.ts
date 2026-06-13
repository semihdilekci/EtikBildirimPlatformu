import { describe, expect, it } from 'vitest';

import { AuthSessionSerializer } from '../session/auth-session.serializer.js';

describe('AuthSessionSerializer', () => {
  const serializer = new AuthSessionSerializer();

  it('serializeUser session payloadını olduğu gibi saklar', async () => {
    const payload = { userId: 'user-1' };

    const serialized = await new Promise<typeof payload>((resolve, reject) => {
      serializer.serializeUser(payload, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result as typeof payload);
      });
    });

    expect(serialized).toEqual(payload);
  });

  it('deserializeUser session payloadını geri yükler', async () => {
    const payload = { userId: 'user-2' };

    const deserialized = await new Promise<typeof payload>((resolve, reject) => {
      serializer.deserializeUser(payload, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result as typeof payload);
      });
    });

    expect(deserialized).toEqual(payload);
  });
});
