# Ludo v1 Rules and Engine Acceptance Cases

**Rules version:** `classic-private-v1`  
Every proposed rule marked **[CONFIRM]** needs product approval before Phase 4 implementation. The server freezes the approved `rules_version` and full `rules_snapshot` at game start.

## 1. Seats, pieces and board coordinate model

- 2–4 authenticated human players, each with 4 tokens indexed 0–3 **[CONFIRM]**.
- Seat/color order is frozen at game start. Two-player games use opposite colors: Red and Yellow **[CONFIRM]**.
- The shared loop has 52 absolute squares: 0–51. Color start and home-column entry indices:

| Color | Start square | Home-column entry (last shared-loop square) | Start-safe |
|---|---:|---:|---:|
| Red | 0 | 51 | 0 |
| Green | 13 | 12 | 13 |
| Yellow | 26 | 25 | 26 |
| Blue | 39 | 38 | 39 |

- A token state is `BASE`, `TRACK(local_index 0..51)`, or `HOME(column_index 0..5)`. For a track token, `absolute_square = (color_start + local_index) mod 52`.
- `TRACK(51)` is that color's home-column entry. One next step is `HOME(0)`; `HOME(5)` is final home. Total progress is BASE, 0–51 track, then 52–57 home. A die roll may advance only when resulting progress is at most 57 **[CONFIRM]**.
- Safe absolute squares are four color starts `{0,13,26,39}` and stars `{8,21,34,47}` **[CONFIRM]**.
- Same-color tokens can share any legal square. A same-color stack is immune. Blockades are disabled: a stack does not prevent passing **[CONFIRM]**.
- A token may not land on an opposing stack. Landing on one opposing token on a non-safe track square captures it and returns it to BASE. Capture never occurs on a safe square **[CONFIRM]**.

## 2. Turn state machine

```text
PRE_GAME_ENTROPY
  -> AWAIT_ROLL
  -> AWAIT_MOVE (when roll has one or more legal moves)
  -> RESOLVE_MOVE
  -> AWAIT_ROLL (extra roll after eligible 6)
  -> ADVANCE_TURN
  -> AWAIT_ROLL
  -> FINISHED | VOIDED | FORFEITED

AWAIT_ROLL
  -> RESOLVE_TIMEOUT (deadline passes)
  -> DISCONNECTED_WAIT (connection absent; deadline remains authoritative)
  -> FORFEITED (third consecutive timeout)
```

- At `AWAIT_ROLL`, only the active seat may request a roll. Server derives the result, records it and determines legal moves.
- A 6 moves a BASE token to `TRACK(0)`; it does not advance beyond start on the same roll **[CONFIRM]**.
- A 6 grants one extra roll if it produces a legal move and is not the third consecutive 6 **[CONFIRM]**.
- The third consecutive 6 is recorded but forfeits the roll: no token moves and turn passes. The consecutive-six count resets on turn change **[CONFIRM]**.
- If no legal move exists, turn passes. A 6 with no legal move gives no extra roll **[CONFIRM]**.
- Capture and reaching `HOME(5)` give no bonus roll **[CONFIRM]**.
- Game events model every transition; clients animate after receiving events only.

## 3. Legal-move algorithm

```text
legalMoves(state, seat, die):
  require state.phase == AWAIT_MOVE
  require state.activeSeat == seat
  moves = []

  for token in seat.tokens ordered by tokenIndex:
    if token == BASE:
      if die == 6 and destination TRACK(0) is legal:
        moves.add(enterBase(token))
      continue

    progress = token.progress        # 0..57
    destination = progress + die
    if destination > 57:
      continue
    if destination is TRACK and target has opposing protected stack:
      continue
    moves.add(advance(token, destination))

  return moves

resolveMove(selectedMove):
  require selectedMove in legalMoves(...)
  apply token state change
  if destination is non-safe TRACK with exactly one opposing token:
    return opposing token to BASE
  append canonical event/snapshot/outbox atomically
  if die == 6 and this was not third consecutive 6:
    phase = AWAIT_ROLL for same seat
  else:
    advance to next non-forfeited seat and phase = AWAIT_ROLL
```

The server rejects a request that changes any unselected token, assumes a client-reported destination, arrives with stale game version, repeats an idempotency key, or is outside the current phase.

## 4. Timers, disconnects, forfeit and end

- Turn deadline is 30 seconds, stored as `GAMES.turn_deadline_at` and shown to all participants **[CONFIRM]**.
- On timeout, server obtains a fair dice roll and selects the furthest-advanced legal token; ties choose lowest token index. If no legal move, it passes per the normal rule. This automatic action is explicit in the event history **[CONFIRM]**.
- Disconnect does not pause or reset the deadline. Reconnect is allowed until forfeit and receives server snapshot/events **[CONFIRM]**.
- Three consecutive timed-out turns for the same seat forfeit that seat. Its tokens leave the board; the seat cannot rejoin that game. A manual successful turn resets that seat's timeout streak **[CONFIRM]**.
- A match finishes when first player brings all four tokens to `HOME(5)`. Remaining placements rank by total token progress; if all but one seat forfeit, the last non-forfeited seat wins **[CONFIRM]**.
- A rematch creates a new game in the same room, with new seats frozen, a new seed commitment, new entropy protocol and a new event chain **[CONFIRM]**.
- No human seat is silently replaced by a bot **[CONFIRM]**.

## 5. Golden engine scenarios

All are mandatory Phase 4 tests. `R0` means Red token 0; `T(x)` means track local index x; `H(x)` home column; omitted tokens stay unchanged.

| # | Initial state | Action | Expected result |
|---:|---|---|---|
| 1 | Red active; all Red tokens BASE | roll 5 | no legal move; turn passes |
| 2 | Red active; all Red tokens BASE | roll 6, choose R0 | R0 -> T(0); Red extra roll |
| 3 | Red active; R0 BASE, R1 T(4) | roll 6, choose R1 | R1 -> T(10); Red extra roll |
| 4 | Red has two prior consecutive sixes; R0 BASE | third roll 6 | no move; turn passes |
| 5 | Red rolled 6; all Red tokens BASE; start square blocked by opposing protected stack | resolve | no legal move; no extra roll; turn passes |
| 6 | Red R0 T(0) | roll 3, choose R0 | R0 -> T(3) |
| 7 | Red R0 T(50) | roll 1 | R0 -> T(51), absolute 51 |
| 8 | Red R0 T(51) | roll 1 | R0 -> H(0) |
| 9 | Red R0 H(4) | roll 1 | R0 -> H(5), token finished |
| 10 | Red R0 H(4) | roll 2 | illegal; no move for R0 |
| 11 | Red R0 H(5) | roll 1 | finished token has no legal move |
| 12 | Red R0 T(7); Blue R0 at absolute 8 alone | roll 1 | Red lands safe 8; Blue remains |
| 13 | Red R0 T(8); Blue R0 at absolute 9 alone | roll 1 | Blue captured to BASE; Red at T(9) |
| 14 | Red R0 T(8); Blue R0/R1 at absolute 9 | roll 1 | landing is illegal; opponent stack is protected |
| 15 | Red R0 T(8); Red R1 T(9) | roll 1 R0 | same-color share legal; both at T(9) |
| 16 | Red R0 T(48) | roll 6 | R0 -> H(2); normal six extra roll |
| 17 | Red R0 T(48); roll result 4 | choose R0 | R0 -> H(0) |
| 18 | Red R0 T(50); Yellow R0 at absolute 51 | roll 1 | capture Yellow; Red -> T(51) |
| 19 | Red R0 T(0); Green R0 absolute 13 | roll 13 | Red -> T(13); Green remains because safe |
| 20 | Red active; R0 T(20), R1 T(10); deadline expires; fair die 3 | auto move | R0 -> T(23); event marks automatic |
| 21 | Red active; all Red BASE; deadline expires; fair die 4 | auto move | no legal move; turn passes |
| 22 | Red active; R0 T(20); deadline expires; fair die 6 | auto move | R0 -> T(26); Red extra roll |
| 23 | Red has timeout streak 2; deadline expires | resolve timeout | Red forfeits; all Red tokens removed |
| 24 | Three seats; Red and Green forfeited | Yellow remains non-forfeited | Yellow wins; finished_reason=forfeit |
| 25 | Two seats; Red has all tokens H(5) after legal move | resolve move | game finishes once; winner Red; fairness reveal queued |
| 26 | Game at version 12; Red sends move expectedVersion 11 | submit command | GAME_VERSION_CONFLICT; no event |
| 27 | Red repeats accepted roll idempotency key | retry roll | original result returned; no extra roll/event |
| 28 | Player disconnects with 12 seconds remaining | reconnect before deadline | receives sanitized snapshot plus missed ordered events |
| 29 | Entropy reveal mismatches commitment | submit reveal | game start cancels; room returns lobby; no penalty |
| 30 | Player fails entropy reveal before start deadline | deadline resolves | game start cancels; room returns lobby; no penalty |
