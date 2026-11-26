# Shared contracts (freeze before branching)

Use `types/meetup.ts` and `lib/locations.ts` from this starter.

## Core service functions — Developer 3 (`lib/meetups.ts`)

```typescript
listMeetups(): Promise<MeetupSummary[]>
getMeetup(id: string): Promise<MeetupSummary | null>
createMeetup(input: CreateMeetupInput): Promise<Meetup>
cancelMeetup(id: string): Promise<void>
```

The starter's `listMeetups` and `getMeetup` initially return mock data. Developer 3 replaces their internals (not their signatures).

Implemented (see `docs/SUPABASE_SETUP.md`): the functions are **server-only**. Additional exports, no signature changes:
`getMeetupDataMode(): "live" | "mock"`, error classes `AuthRequiredError`, `MeetupValidationError` (`fieldErrors`), `MeetupNotFoundError`, `MockModeError`.
Client-safe validation lives in `lib/meetup-validation.ts` (`validateCreateMeetupInput`, `MEETUP_CATEGORIES`).

## Social service functions — Developer 4 (`lib/social.ts`)

```typescript
peck(meetupId: string): Promise<void>
unpeck(meetupId: string): Promise<void>
flap(meetupId: string): Promise<void>
unflap(meetupId: string): Promise<void>
```

Use the authenticated Supabase user ID internally; **never accept a `userId` argument from the browser**.

## Achievements (ADR 0019)

Server (`lib/achievements.ts`; the user always comes from the session):

```typescript
listMyAchievements(): Promise<EarnedMap | null>   // null = no account (signed out or mock mode)
recordAchievement(id: AchievementId): Promise<"new" | "already" | "guest">
```

Server action `earnAchievement(id: unknown): Promise<EarnResult>` (`app/achievements/actions.ts`). In the browser, call `earn(id)` from `components/achievements/earn.ts`, or mark an element with `data-achievement="<id>"` to earn it on hover/focus. Ids and copy live in `lib/achievement-catalog.ts`.

## Trend service functions — `lib/trends.ts` (issue #43, ADR 0017)

```typescript
listTrends(type?: TrendType, limit?: number): Promise<TrendEntry[]>
createTrend(input: CreateTrendInput): Promise<void>
setTrendLike(id: string, liked: boolean): Promise<void>
```

Server-only. Types in `types/trend.ts`; client-safe validation in `lib/trend-validation.ts` (`validateCreateTrendInput`, `TREND_TYPES`).

- Data interpretation: one like per user per entry (composite primary key); rank = like count descending, then newest first. `likedByMe`/`createdByMe` are computed for the current user only.
- Coffee and study entries may reference an approved `CAMPUS_LOCATIONS` id; recipes and songs are address-free. Links must be empty or start with `https://`.
- Errors: `TrendError`; `AuthRequiredError` and `MockModeError` are reused from `lib/meetups.ts`. Mutations run through the RPCs in `supabase/migrations/010_trends.sql`.

## Prediction markets — `lib/markets.ts` (issue #139, ADR 0033)

```typescript
listMarkets(view: "open" | "settled"): Promise<Market[] | null>
getMarket(id: string): Promise<MarketPage | null>        // market, history, position, balance, moderator
getBalance(): Promise<number | null>
getMarketLeaderboard(limit?: number): Promise<Leaderboard | null>
listMyProposals(): Promise<Market[]>
listPendingMarkets(): Promise<Market[]>                   // moderators; RLS returns nothing to others
proposeMarket(input: { question: string; details: string; closesAt: string }): Promise<string>
tradeMarket(id: string, side: Side, action: "buy" | "sell", amount: number): Promise<TradeResult>
reviewMarket(id: string, approve: boolean): Promise<void>
resolveMarket(id: string, outcome: "yes" | "no" | "cancelled"): Promise<number>
```

Server-only. `null` means signed out or migration 018 not applied; preview mode returns `lib/mock-markets.ts`. Writes throw `MarketError` with a message safe to show. Pricing math for previews is in `lib/market-math.ts` (client-safe); the database (`trade_market`) is the source of truth. Points are play money only.

## Blackjack — `lib/blackjack.ts` (ADR 0034)

```typescript
getBlackjackTable(): Promise<BlackjackTable | null>       // hand in play, today's record, balance
dealHand(bet: number): Promise<HandState>
playHand(id: string, action: "hit" | "stand" | "double"): Promise<HandState>
```

Server-only; the database deals and pays (migration 019) and never returns the deck or the hole card while a hand is in play. `null` means the practice table (signed out, preview mode or migration missing). Rules, card names and the practice engine are in `lib/blackjack-engine.ts` (client-safe). Errors: `BlackjackError`.

## Meetup photo albums — `lib/meetup-photos.ts` (issue #117, ADR 0039)

```typescript
getMeetupAlbum(meetup: { id: string; host_id: string }): Promise<Album | null>   // null: not the host or going
addMeetupPhoto(meetupId: string, image: Uint8Array): Promise<void>               // JPEG, resized in the browser
removeMeetupPhoto(photoId: string): Promise<void>                                // uploader, host or moderator
purgeMyDeadMeetupPhotos(): Promise<number>                                       // background Storage clean-up
```

Server-only. Album rules (7 days, 20 photos per person) are in `lib/meetup-album.ts` (client-safe); the database (migration 025) enforces them. Reports reuse `reportContent("photo", id, …)` from `lib/board.ts`. Errors: `AlbumError`.

## Weather and feed layout

- `lib/weather.ts` (issue #138, ADR 0032): `getCampusWeather(): Promise<Forecast | null>` fetches Open-Meteo for the fixed campus coordinates, cached 15 minutes; `null` when unreachable. Pure helpers: `parseForecast`, `forecastAt`, `upcomingHours`, `weatherTip`, `describeWeather`.
- `lib/dashboard.ts` (issue #46, ADR 0031): `parseLayout(cookie)` / `serializeLayout(layout)` for the `martlet.dashboard` cookie, plus `moveWidget`, `toggleWidget`, `visibleWidgets`. A new feed widget is an entry in `WIDGETS` and a slot in `app/meetups/page.tsx`.

## Data interpretation

- Meetups store one to three unique categories in selection order. Other stands alone. The legacy `category` is the first value and controls the card accent and map marker. Study can be anywhere in the list for course selection and filtering.
- A meetup's host is automatically participating without a `meetup_pecks` row.
- `attendee_count = 1 + pecks count`.
- `has_pecked` true only when the *current user* has a peck row.
- `has_flapped` true only when the *current user* has a flap row.
- `status='cancelled'` hides meetup from the upcoming feed, but can still render a cancelled detail page.
- Cancelled/past meetups cannot receive new pecks or flaps.
- Time is stored in UTC `timestamptz`; display in user's local timezone.
- The creation form submits an approved campus ID or a custom meeting spot. The server resolves campus IDs to canonical coordinates. Custom locations store 3–160 characters of trimmed text and null coordinates. Existing public venue rows retain their verified coordinates. Consumers must check both coordinates before rendering a marker.
- `auth.users` handles auth; `profiles` contains public-facing display names.

## UX component API

```typescript
type MeetupCardProps = {
  meetup: MeetupSummary;
  viewerId?: string | null; // signed-in user (live mode); null = read-only counts
}
```

Cards render Developer 4's `PeckButton`/`FlapButton` (which call `lib/social.ts`) when `viewerId` is set; Peck is disabled for the host. Developer 2's detail page can reuse the same reaction components.

## Validation
- title 3–80 characters, description max 500
- category one of `coffee | study | food | sports | gaming | other`
- starts_at in the future; recommend within next 7 days for hackathon
- max one Peck / one Flap per user and meetup (database primary keys)
- non-host may join/leave; host can cancel; host counted as participant automatically
- no exact live geolocation or private addresses

## End-to-end acceptance tests
- Two users: A creates, B sees feed and map; B pecks/flaps; A sees counts.
- B cannot cancel A's meetup via UI **or direct database API**.
- Unauthorized user cannot create, like, join, or cancel.
- Duplicate peck/flap does not increase count.
- Past/cancelled meetups cannot be joined.
- Future timestamp and approved location validation prevents bad data.
- Mobile screen 375px wide usable without horizontal scroll.
