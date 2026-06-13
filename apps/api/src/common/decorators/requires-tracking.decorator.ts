import { SetMetadata } from '@nestjs/common';

import { REQUIRES_TRACKING_KEY } from '../constants/tracking-route.metadata.js';

/** Anonim takip header doğrulaması — TrackingGuard tarafından uygulanır */
export const RequiresTracking = () => SetMetadata(REQUIRES_TRACKING_KEY, true);
