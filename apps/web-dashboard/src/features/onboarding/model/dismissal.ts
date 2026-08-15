/** Where the "I have seen this" flag lives. Permanent: a panel that reappears nags. */
export const DISMISS_KEY = 'ps-onboarding-dismissed';

export function isDismissed(): boolean {
  return localStorage.getItem(DISMISS_KEY) === '1';
}

export function dismissForGood(): void {
  localStorage.setItem(DISMISS_KEY, '1');
}
