# Release Notes – V2.29

## Native non-online event visibility repair

Real Thunderbird testing showed a narrower failure than Graph synchronization: ordinary Microsoft 365 calendar events were present in the Space and in Thunderbird `cache.sqlite`, while Teams/online meetings from the same Graph calendar were visible in the built-in Calendar UI. V2.29 changes the client-side migration path for non-online events. When their native mapping version is outdated, the cached row is deleted and re-adopted instead of only modified. The reconciliation path no longer wraps provider replay in a storage batch, so Thunderbird receives the full per-item observer lifecycle for these repairs.

New diagnostics expose `syncCacheVisibilityRepairs`. The repair is mapping-version gated and therefore runs once per affected cached item, not on every sync.

## Microsoft 365 Space views

The Space calendar now supports **Month**, **Week**, **Day**, and **Agenda** views. Navigation and Graph query ranges adapt to the selected view, and the selected view is persisted.

## Metadata / UI

- Technical manifest version: `2.0.29`
- Visible product version: `V2.29`
- Author: `Jens Kowalsky, 3-5 Power Electronics GmbH`
- Existing address-book selection/autocomplete behavior is unchanged.
