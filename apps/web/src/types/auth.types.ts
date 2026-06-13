import type { AuthMeResponse } from '@ethics/dto';

export type CurrentUser = AuthMeResponse;

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
