# 0017. Custom meeting spots and polling retirement

## Status

Proposed. Updates ADRs 0015 and 0016 for meetup creation and retires the poll UI described in ADR 0011.

## Decision

Students can use a campus location or describe a public meeting spot in 3–160 characters. Custom rows have null coordinates and no venue catalog ID. Catalog rows still require a complete coordinate pair and satisfy their existing foreign keys. Existing venue rows keep their location data. Hosts can still change only the cancellation status.

Google Places lookup remains optional for preview. Custom publishing saves only the instructions entered in the text field. Explore lists text-only meetups separately from mapped results and applies the same filters.

The application no longer loads or writes polls. The existing database schema and votes are retained.
