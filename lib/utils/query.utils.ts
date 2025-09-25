export const STALE_TIMES = {
  SHORT: 1 * 60 * 1000,      // 1 minute
  MEDIUM: 5 * 60 * 1000,     // 5 minutes  
  LONG: 10 * 60 * 1000,      // 10 minutes
  VERY_LONG: 60 * 60 * 1000, // 1 hour
  INFINITE: Infinity,
} as const;

export const REFETCH_INTERVALS = {
  FAST: 10000,    // 10 seconds
  NORMAL: 30000,  // 30 seconds
  SLOW: 60000,    // 1 minute
} as const;

export const createQueryKeyFactory = <T extends readonly string[]>(
  base: T
) => {
  return {
    all: base,
    lists: () => [...base, 'list'] as const,
    list: (filters: Record<string, any>) => [...base, 'list', filters] as const,
    details: () => [...base, 'detail'] as const,
    detail: (id: string | number) => [...base, 'detail', id] as const,
  };
};

export const getCommonMutationCallbacks = <TData = unknown, TError = Error>() => ({
  onError: (error: TError) => {
    console.error('Mutation failed:', error);
  },
  onSuccess: (data: TData) => {
    console.log('Mutation succeeded:', data);
  },
});