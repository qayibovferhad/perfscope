export interface WebsiteSession {
  cookies:      Array<{
    name?:     string
    value?:    string
    domain?:   string
    path?:     string
    expires?:  number
    httpOnly?: boolean
    secure?:   boolean
    sameSite?: string
  }>
  localStorage: Record<string, string>
  capturedAt:   string
}

export interface WebsiteAutomation {
  enabled:      boolean
  routes:       string[]
  scheduleTime: string
  lastRunAt:    string | null
}

/** Set when an audit was redirected to a login screen; cleared once that same URL audits cleanly. */
export interface WebsiteLoginWall {
  url:        string
  loginUrl:   string
  detectedAt: string
}

export interface WebsiteDoc {
  _id:            string
  userId:         string
  url:            string
  name:           string
  session?:       WebsiteSession | null
  requiresLogin?: WebsiteLoginWall | null
  automation?:    WebsiteAutomation
  createdAt:      string
}
