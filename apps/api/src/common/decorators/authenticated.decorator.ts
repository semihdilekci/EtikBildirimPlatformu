import { SetMetadata } from '@nestjs/common';

import { IS_AUTHENTICATED_KEY } from '../constants/auth-route.metadata.js';

/** Oturum zorunlu; RBAC permission kontrolü yok (ör. auth/me, auth/logout) */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true);
