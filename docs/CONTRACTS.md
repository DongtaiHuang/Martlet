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

## Achievements (ADR 0015)

Server (`lib/achievements.ts`; the user always comes from the session):

```typescript
listMyAchievements(): Promise<EarnedMap | null>   // null = no account (signed out or mock mode)
recordAchievement(id: AchievementId): Promise<"new" | "already" | "guest">
```

Server action `earnAchievement(id: unknown): Promise<EarnResult>` (`app/achievements/actions.ts`). In the browser, call `earn(id)` from `components/achievements/earn.ts`, or mark an element with `data-achievement="<id>"` to earn it on hover/focus. Ids and copy live in `lib/achievement-catalog.ts`.

## Data interpretation
- A meetup's host is automatically participating without a `meetup_pecks` row.
- `attendee_count = 1 + pecks count`.
- `has_pecked` true only when the *current user* has a peck row.
- `has_flapped` true only when the *current user* has a flap row.
- `status='cancelled'` hides meetup from the upcoming feed, but can still render a cancelled detail page.
- Cancelled/past meetups cannot receive new pecks or flaps.
- Time is stored in UTC `timestamptz`; display in user's local timezone.
- Campus locations are chosen from `CAMPUS_LOCATIONS`; frontend must submit name and coordinates from the selected entry, not free-form coordinates. Server should revalidate the approved location rather than trust client-side coordinate values.
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
- Future timestamp and approved campus place validation prevents bad data.
- Mobile screen 375px wide usable without horizontal scroll.
