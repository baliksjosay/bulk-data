import { Injectable } from '@nestjs/common';
import { User } from 'src/modules/users/entities/user.entity';

@Injectable()
export class AuthPolicyService {
  determineAllowedMethods(user: User) {
    return {
      allowPassword: true,
      allowGoogle: true,
      allowMicrosoft: true,
      allowPasskey: true,
      requireStepUpMfa: user.mfaEnabled === true,
    };
  }
}
