# 2026-06-04 Wave 1084 - Feed Velocity Condition Fallback

## Decision
- Feed cards should use the same velocity availability model as detail views.
- The feed previously fetched only `condition_class = all`, so products with condition-specific velocity could show sale speed in detail but no rotation badge in the feed.

## Implemented
- Feed velocity loading now fetches all velocity rows for the pool comparable keys.
- It builds labels per PID, preferring the matching condition row and falling back to the `all` aggregate.

## Note
- Daangn distance badges still require the user's saved home region and a resolvable listing region.
