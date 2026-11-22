# 0018. Open the Landmarks map with all pins in 3D

- **Status:** Proposed
- **Date:** 2026-11-21
- **Builds on:** [0013](0013-landmark-map-tower-pins.md) and [0014](0014-theme-tokens-and-dark-mode.md)

## Context

ADR 0013 opens both maps at campus zoom to show 3D buildings. On `/landmarks` this hides the off-campus pins. The default basemaps omit building geometry from the lower-zoom tiles used to frame all the landmarks.

## Decision

Fit the initial `/landmarks` camera to the landmark coordinates with a pitched view and room for the tower pins. Space nearby pins horizontally at overview zoom so they can be selected individually. Selecting a landmark still zooms into it and opens its popup.

The default light and dark MapLibre basemaps use a bounded source for Montréal building tiles at zoom 14. An overview-only extrusion layer uses those tiles beneath the regular building layer. The Explore MapLibre map keeps the campus starting view from ADR 0013. Custom MapLibre styles keep their own building layers and tile coverage. When Google Maps is configured, its overview fits the pins using Google's own camera and rendering.

## Consequences

The initial view shows campus and off-campus landmarks together. The default basemaps request extra building tiles for Montréal while the 3D overview is visible.
