# 24h execution plan — four developers

## Frozen MVP
- Account sign-in and student profile
- Create meetup: title, category, description, approved campus place, start time
- Upcoming meetup feed and detail page
- Peck/unpeck to join/leave; Flap/unflap to like/unlike
- Cancellation by host, not by other people
- Map shows the same meetups as the feed
- Mobile layout and deployed URL

**Defer:** chat, private messaging, marketplace, feeds from other platforms, social graph, Feathers economy, photo unlocking, recommendations.

## Ownership, workload and first commit

### Developer 1 — Social Feed & UI (`feature/social-feed`) ~6–8h
Own: `app/meetups/page.tsx`, `app/profile/`, `components/feed/`, `components/layout/`
1. Replace mock MeetupCard design with actionable accessible buttons/links (but don't implement mutations; coordinate with Developer 4).
2. Add client-side category filter and loading/empty/error states.
3. Build responsive nav, profile placeholder.
4. Integrate `listMeetups()` when Developer 3 publishes it.
5. Verify phone viewport.
**First PR:** `feat: responsive meetup feed and navigation`.

### Developer 2 — Creation and Details (`feature/meetup-creation`) ~6–8h
Own: `app/meetups/new/`, `app/meetups/[id]/`, `components/forms/`
1. Build form using category and CAMPUS_LOCATIONS shared enums.
2. Validate title 3–80 chars, description ≤500, future start time.
3. Connect `createMeetup()` from Developer 3.
4. Add detail route and host-only cancel action.
5. Error/permission/expired-meetup states.
**First PR:** `feat: create meetup form and detail page`.

### Developer 3 — Auth, Supabase & Core Services (`feature/supabase-auth`) ~6–8h
Own: `supabase/`, `lib/supabase/`, `lib/meetups.ts`, starter auth paths
1. Create Supabase project; set URL/publishable key in local env (share securely).
2. Apply `supabase/migrations/001_mvp.sql`, create 2 test accounts.
3. Confirm profile trigger creates rows and RLS blocks impersonation.
4. Replace `lib/meetups.ts` mock functions with list/get/create/cancel real calls.
5. Implement validation and test that only the host can cancel their meetup.
**First PR:** `feat: Supabase schema auth and meetup service`.

### Developer 4 — Map, Reactions, Deployment (`feature/map-interactions`) ~6–8h
Own: `app/explore/`, `components/map/`, `components/social/`, `lib/social.ts` plus Vercel integration
1. Replace map's sample records with Developer 3's service data.
2. Build Peck/Flap/unPeck/unFlap services and UI with logged-in user.
3. Wire buttons into Developer 1's card through props and Developer 2's detail through small integration PRs.
4. Configure map style provider appropriate to Vercel domain; deploy to Vercel.
5. Add Realtime only after full journey works.
**First PR:** `feat: map discovery and peck flap interactions`.

## Hour checkpoints
- H0–H2: starter running, contracts committed, Supabase created, branches created.
- H2–H6: feed and create form mostly done with mocked data; schema/auth tested.
- H6–H10: data operations integrated; two test users can create/peck/flap.
- H10–H14: map connected to same meetups; cancel and error states.
- H14–H18: mobile polish, optional Realtime, deployment.
- H18–H21: freeze features, test security and end-to-end flow.
- H21–H24: fix blocking bugs, rehearse demo, keep backup recording.

## Merge convention
- No force-pushing shared branches.
- PR each feature in small changes; one reviewer approves before merge.
- Integrate `main` at least every 3–4h.
- Never edit another person's primary file without coordination.
- Use stub/mock data until shared service is ready. Switch to live API once, not bespoke fetches inside each component.

## Demo walkthrough (two separate accounts)
1. Student A signs in and creates "Coffee at Redpath" in 20 minutes.
2. Student B loads upcoming meetups, sees event on feed and map.
3. Student B taps Peck then Flap. Participant/like counts change after refresh.
4. Student B unpecks; Student A cancels meetup.
5. Show that cancelled meetup is removed from upcoming and different users cannot cancel it.
