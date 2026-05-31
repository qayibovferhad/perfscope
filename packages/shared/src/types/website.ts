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

export interface WebsiteDoc {
  _id:         string
  userId:      string
  url:         string
  name:        string
  session?:    WebsiteSession | null
  automation?: WebsiteAutomation
  createdAt:   string
}
