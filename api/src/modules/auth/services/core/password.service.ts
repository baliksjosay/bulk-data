import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

/**
 * Encapsulates password hashing and verification behavior.
 */
@Injectable()
export class PasswordService {
  private readonly rounds = 12;

  /**
   * Hashes a plain-text password.
   *
   * @param password Plain-text password
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  /**
   * Compares a plain-text password to a stored hash.
   *
   * @param plain Plain-text password
   * @param hash Stored password hash
   */
  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
