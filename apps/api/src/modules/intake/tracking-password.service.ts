import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Docs/07 §1.3 — argon2id memory ≥64 MB, iterations ≥3, parallelism ≥1 */
const ARGON2_OPTIONS: argon2.Options & { type: typeof argon2.argon2id } = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
};

@Injectable()
export class TrackingPasswordService {
  async hashPassword(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON2_OPTIONS);
  }

  async verifyPassword(plaintext: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plaintext, ARGON2_OPTIONS);
  }

  isArgon2idHash(hash: string): boolean {
    return hash.startsWith('$argon2id$');
  }
}
