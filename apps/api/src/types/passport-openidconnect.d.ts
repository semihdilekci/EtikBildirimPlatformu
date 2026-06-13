declare module 'passport-openidconnect' {
  import type { Strategy } from 'passport';

  export interface Profile {
    id?: string;
    displayName?: string;
    emails?: Array<{ value: string }>;
  }

  class OpenIDConnectStrategy extends Strategy {
    constructor(options: Record<string, unknown>, verify?: (...args: unknown[]) => void);
  }

  export default OpenIDConnectStrategy;
  export { Profile };
}
