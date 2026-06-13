import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../constants/auth-route.metadata.js';

/** Dış form, takip, health ve OIDC callback — session/policy guard muaf */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
