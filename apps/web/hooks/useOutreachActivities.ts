import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ticketsApi, type OutreachActivityList, type OutreachActivityRow } from "@/lib/tickets-api";
import { ticketKeys } from "@/lib/query-keys";

export function useOutreachActivities(org: string, concertId: string) {
  const queryClient = useQueryClient();
  const queryKey = ticketKeys.outreach(org, concertId);
  const query = useQuery({
    queryKey,
    queryFn: () => ticketsApi.listOutreachActivities(org, concertId),
  });

  const patch = (fn: (activities: OutreachActivityRow[]) => OutreachActivityRow[]) => {
    queryClient.setQueryData<OutreachActivityList>(queryKey, (prev) =>
      prev ? { ...prev, activities: fn(prev.activities) } : prev,
    );
    if (queryClient.isFetching({ queryKey }) > 0) {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    addActivity: (activity: OutreachActivityRow) => patch((prev) => [activity, ...prev]),
    updateActivity: (activity: OutreachActivityRow) =>
      patch((prev) => prev.map((a) => (a.id === activity.id ? activity : a))),
    removeActivity: (activityId: string) =>
      patch((prev) => prev.filter((a) => a.id !== activityId)),
  };
}
