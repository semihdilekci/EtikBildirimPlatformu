import 'express-session';

declare module 'express-session' {
  interface SessionData {
    returnUrl?: string;
    passport?: {
      user?: {
        userId: string;
      };
    };
  }
}

declare global {
  namespace Express {
    interface User {
      userId?: string;
      id?: string;
      email?: string;
      displayName?: string;
      roles?: string[];
      clearanceLevel?: string;
      companyId?: string | null;
      companyName?: string | null;
      isGeneralSecretary?: boolean;
    }
  }
}

export {};
