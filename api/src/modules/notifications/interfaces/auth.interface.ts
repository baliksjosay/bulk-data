
export interface UserInvitedEvent {
  userId: string;
  email: string;
  firstName?: string;
}

export interface AccountActivatedEvent {
  userId: string;
  email: string;
}

export interface PasswordResetRequestedEvent {
  userId: string;
  email: string;
}

export interface PasswordResetCompletedEvent {
  userId: string;
  email: string;
}

export interface EmailVerificationRequestedEvent {
  userId: string;
  email: string;
}

export interface EmailVerifiedEvent {
  userId: string;
  email: string;
}

export interface PhoneVerificationRequestedEvent {
  userId: string;
  phoneNumber?: string;
}

export interface PhoneVerifiedEvent {
  userId: string;
  phoneNumber?: string;
}

export interface LoginWarningThresholdReachedEvent {
  userId: string;
  email: string;
  failedAttempts: number;
}

export interface AccountLockedEvent {
  userId: string;
  email: string;
  lockedUntil?: string | Date;
  reason?: string;
}

export interface AccountUnlockedEvent {
  userId: string;
  email: string;
}

export interface MfaEnabledEvent {
  userId: string;
  email: string;
  method?: string;
}

export interface MfaDisabledEvent {
  userId: string;
  email: string;
  method?: string;
}
