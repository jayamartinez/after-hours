import { QueryClient } from '@tanstack/react-query';

/** The app's one query cache (provided in the root layout; also updated by chat events). */
export const queryClient = new QueryClient();
