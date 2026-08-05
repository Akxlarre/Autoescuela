export interface RequestGuard {
  next(): number;
  isCurrent(token: number): boolean;
}

export function createRequestGuard(): RequestGuard {
  let latestToken = 0;

  return {
    next(): number {
      latestToken += 1;
      return latestToken;
    },
    isCurrent(token: number): boolean {
      return token === latestToken;
    },
  };
}
