export interface AuthUser {
  sub:     string
  name:    string
  email:   string
  picture: string
}

/**
 * What every way in answers with: password login, registration and Google sign-in all
 * return the same pair, so a caller never has to know which door it came through.
 *
 * Five places described this inline — both auth pages twice each and GoogleButton — which
 * is how a field could be renamed on one route and noticed on none.
 */
export interface AuthResponse {
  token: string
  user:  AuthUser
}

/**
 * Weekly-summary preference. `day` is 0–6 with 0 = Sunday, `time` is 'HH:MM' local to the
 * viewer. A user created before the feature existed has none stored and reads as defaults.
 */
export interface DigestPreference {
  enabled: boolean
  day:     number
  time:    string
}
