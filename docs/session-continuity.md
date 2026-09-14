# Research session continuity

Collection and Value filters are read from the current URL. Bookmarks and shared
links take precedence over the last session: opening `/` explicitly starts an
unfiltered collection. The Collection navigation link, logo, and detail/compare
return links reopen the last collection URL; the Value navigation link reopens
its last URL.

- Collection parameters: `q`, `status`, `priority` (comma-separated tiers),
  `fresh=1`, and `sort`.
- Value parameters: `q`, `status`, `priority`, `category`, `min`, `max`, `design`,
  `confidence`, `deal=1`, and `sort`.
- Default values are omitted. Invalid enums and numeric filters fall back to
  defaults; unknown parameters are preserved when changing a known filter.
- Discrete changes add a history entry. Typing search text or price bounds
  replaces the current entry to avoid one Back step per keystroke. Filter resets
  update the URL once. Browser Back/Forward restores controls from the URL.

The grid/table preference lives in local storage (`vitrine:collection-view:v1`)
and is shared by tabs on the same origin. Comparison IDs and last research URLs
live in session storage and survive navigation/reload within the tab. A new tab
has its own shortlist. Selection is deduplicated and capped at four; IDs absent
from the collection do not count toward its limit. The shortlist is reopened from
the collection's selection tray; there is no Compare navigation link.

Storage failures fall back to memory for the current page session; filters still
work through the URL. Server snapshots use safe defaults, then restore browser
state after hydration. The same behavior works in the read-only Pages export,
including its base path and trailing slashes. No watch data is written.
