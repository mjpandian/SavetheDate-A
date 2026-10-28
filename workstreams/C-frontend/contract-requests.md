# Frontend (stream C): contract requests and hand-off

The five screens are built against `workstreams/CONTRACT.md` with `NEXT_PUBLIC_USE_MOCKS=1`. This file lists what the UI needs from the API that the frozen contract does not give it. Per the plan, these go in as a contract PR (all three owners approve), not as local workarounds.

## Run it

```bash
cp .env.example .env.local        # then set NEXT_PUBLIC_USE_MOCKS=1
npm run dev                        # http://localhost:3000, no backend needed
```

Mock mode serves `fixtures/` and keeps ratings, votes and removals in memory until the page is reloaded. Unset the variable to call the real `/api` routes. Only `lib/api-client.ts` calls `fetch` and only it reads fixtures.

## Requests (most important first)

1. **`Candidate` has no activity name, category or price, and the catalog is not exposed (still open after v2).** v2 adds `Run.discovered`, and the UI uses it for agent-found activities. But catalog activities (ids not starting `disc:`) still cannot be resolved by the frontend, because no route returns them and `Candidate` only carries `activityId` (plus `priceIsEstimate`). Every card must show the name and the price per person, and the shortlist must be grouped by category. Preferred fix: add `activityName: string`, `category: Category` and `pricePerPerson: number` to `Candidate` and `CandidateSchema`. Alternative: add `GET /activities` returning `Activity[]`. Right now `api.listActivities()` calls `GET /api/activities`, and if that route is missing it returns `[]`, so cards show the activity id, no price and land in an "Other" group. This is the one change needed for the integration step to work without screen edits.
2. **No time zone.** Slot times are ISO strings and the UI shows them in the viewer's time zone, so a team slot at 17:30 can read as 09:30 for someone abroad. Add `timeZone: string` (IANA, for example `Europe/Lisbon`) to `Team` so every member sees team-local times.
3. **A member cannot read their own ratings.** `GET /events` returns only `teamAvgRating`, so the rating control cannot show what a member rated before. Add `myRating: 1|2|3|4|5|null` to `GET /events`, or `GET /ratings?memberId=`. Until then the UI shows only ratings made in the current session.
4. **A member cannot read their own ballot.** To prefill the vote screen after a reload, add `GET /votes/mine?runId=&memberId=` returning a `Ballot | null`.
5. **`criteria.C2` is ambiguous.** The type comment and the tests treat it as a share (0.5) while the MVP spec says count. The UI therefore ignores the number and shows `matchedMemberIds.length`. Please fix one meaning in `CONTRACT.md`.
6. **No organizer role.** The contract has no auth, so the Remove button on `/plan` shows for everyone. Fine for the MVP, worth stating.
7. **Currency is typed as EUR.** `Team.currency` in `lib/types.ts` is the literal `"EUR"` and `CONTRACT.md` says "EUR per person". The team asked for US dollars. The UI now formats every price with the team's `currency` field (default USD) and the mock data is in dollars, so no screen needs to change. Please widen the type to `"EUR" | "USD"`, update the comment to "per person, in the team currency", and set `"currency": "USD"` in `data/team.json`. Until then, prices show whatever currency the backend sends.

## Holiday theme (frontend only, no API)

The whole UI follows the calendar: colors, floating glyphs, ticker text and the hero headline change to the next upcoming US holiday (Halloween now, Thanksgiving next, then Christmas, New Year's Eve, Valentine's Day, St. Patrick's Day, Easter, Memorial Day weekend, July 4 and Labor Day). `components/holidays.ts` holds the calendar and words, `app/(screens)/holidays.css` the palettes. For demos use the Theme picker in the nav, `?holiday=christmas`, or `?date=2026-11-20` to preview another day.

## Routes the UI calls

`GET /members`, `GET /members/:id`, `PUT /members/:id`, `GET /events`, `POST /ratings`, `GET /team`, `PUT /team` (partial: limit, windowDays, attendanceThresholdPct, noveltyWeeks), `POST /plan`, `GET /runs/latest`, `DELETE /runs/:runId/candidates/:candidateId`, `POST /votes`, `GET /votes/tally?runId=` (polled every 3 s on `/vote`), `GET /result?runId=`, `GET /result/ics?runId=` (link target for the download), plus the proposed `GET /activities`.

The UI expects errors as `{error: string}` and shows that text.

## What the mock does beyond the fixtures

`POST /plan` in mock mode filters the fixture candidates by the saved budget and attendance threshold, so changing Settings visibly changes the next run. This is only a stand-in for stream A's engine, not a copy of its rules.
