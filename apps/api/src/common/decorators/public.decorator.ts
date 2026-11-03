import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'loopwise:isPublic';

/** Skips the authentication requirement (upstream `publicProcedure`). The session is still read when present. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
