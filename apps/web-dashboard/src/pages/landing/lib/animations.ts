export function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
