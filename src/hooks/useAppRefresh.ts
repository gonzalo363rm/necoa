import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

/** Pull-to-refresh / tap-to-refresh: invalida y refetch de queries activas. */
export function useAppRefresh() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['families'] }),
        qc.invalidateQueries({ queryKey: ['members'] }),
        qc.invalidateQueries({ queryKey: ['budget-goals'] }),
        qc.invalidateQueries({ queryKey: ['tags'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['transaction'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return { refreshing, onRefresh };
}
