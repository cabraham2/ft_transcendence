import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from './api';

// Runs an async UI action and turns failures into a visible message
// instead of an unhandled promise rejection in the console.
export function useGuardedAction() {
  const { t } = useTranslation();
  const [actionError, setActionError] = useState<string | null>(null);

  const guarded = useCallback(
    async (action: () => Promise<void>) => {
      setActionError(null);
      try {
        await action();
      } catch (unknownError) {
        setActionError(
          unknownError instanceof ApiError ? unknownError.message : t('common.error'),
        );
      }
    },
    [t],
  );

  return { actionError, guarded };
}
