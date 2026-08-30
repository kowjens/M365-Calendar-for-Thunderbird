# M365 Calendar for Thunderbird V2.32

## Native calendar visibility repair

- Performs a one-time full delete/re-adopt migration of every M365 cache row, including Teams meetings and recurring Graph occurrences.
- Uses mapping marker `2.32-full-cache-readopt`.
- Keeps Graph/Space synchronization unchanged.
- Diagnostic export now records real Thunderbird storage range queries with the event and occurrence filter masks used by calendar views.
- This release targets the V2.31 field case where Graph and `cache.sqlite` contained the events but the Thunderbird native calendar rendered almost none of them.

The migration is idempotent: after every row carries the V2.32 marker, unchanged Graph events are no longer rewritten.
