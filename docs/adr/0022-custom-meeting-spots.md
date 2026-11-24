# 0022. Custom meeting spots and polling retirement

- **Status:** Accepted
- **Date:** 2026-11-21
- **Updates:** [0015](0015-public-meetup-venues.md) and [0016](0016-google-maps-and-place-ids.md) for meetup creation; retires the poll UI from [0011](0011-meetup-polls.md)

## Decision

Students can use a campus location or describe a public meeting spot in 3–160 characters. Custom rows have null coordinates and no venue catalog ID. Catalog rows still require a complete coordinate pair and satisfy their existing foreign keys. Existing venue rows keep their location data. Hosts can still change only the cancellation status.

Google Places lookup remains optional for preview. Custom publishing saves only the instructions entered in the text field. Explore lists text-only meetups separately from mapped results and applies the same filters.

The application no longer loads or writes polls. The existing database schema and votes are retained.
