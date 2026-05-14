export interface SecurityContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  os?: string | null;

  /**
   * Optional geolocation attributes if resolved upstream.
   */
  countryCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  /**
   * Optional current request timestamp override.
   */
  occurredAt?: Date | null;
}
