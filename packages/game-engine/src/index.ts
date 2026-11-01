/**
 * Deterministic, pure Ludo rules core.
 *
 * This package has no I/O, clock, random-number or database access. A server
 * supplies a verified dice value and commits each accepted transition as an
 * event. Clients may use this package only to render/explain server state.
 */
export const COLORS = ["red", "green", "yellow", "blue"] as const;
export type Color = (typeof COLORS)[number];
export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type GameStatus = "waiting" | "active" | "finished";

export interface Token {
  readonly id: string;
  readonly color: Color;
  /** -1: home; 0..51: shared track; 52..55: home lane; 56: finished. */
  readonly progress: number;
}

export interface Seat {
  readonly color: Color;
  readonly playerId: string;
  readonly tokens: readonly Token[];
}

export interface GameState {
  readonly gameId: string;
  readonly status: GameStatus;
  readonly seats: readonly Seat[];
  readonly activeColor: Color | null;
  readonly turn: number;
  /** Count of immediately preceding sixes by the active player. */
  readonly consecutiveSixes: number;
  readonly winnerOrder: readonly Color[];
}

export interface Move {
  readonly tokenId: string;
  readonly die: DieValue;
}

export interface AppliedMove {
  readonly state: GameState;
  readonly capturedTokenIds: readonly string[];
  readonly extraTurn: boolean;
  readonly gameFinished: boolean;
}

export type RuleErrorCode =
  | "GAME_NOT_ACTIVE"
  | "NOT_ACTIVE_SEAT"
  | "UNKNOWN_TOKEN"
  | "INVALID_DIE"
  | "ILLEGAL_MOVE"
  | "THIRD_SIX_FORFEITS_TURN";

export class RuleError extends Error {
  constructor(readonly code: RuleErrorCode, message: string) {
    super(message);
    this.name = "RuleError";
  }
}

const START_INDEX: Readonly<Record<Color, number>> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function assertDie(die: number): asserts die is DieValue {
  if (!Number.isInteger(die) || die < 1 || die > 6) {
    throw new RuleError("INVALID_DIE", "Dice value must be an integer from 1 through 6.");
  }
}

function nextColor(state: GameState, color: Color): Color | null {
  const start = COLORS.indexOf(color);
  for (let offset = 1; offset <= COLORS.length; offset += 1) {
    const candidate = COLORS[(start + offset) % COLORS.length];
    if (candidate !== undefined && !state.winnerOrder.includes(candidate) &&
      state.seats.some((seat) => seat.color === candidate)) {
      return candidate;
    }
  }
  return null;
}

function cloneSeat(seat: Seat, tokens: readonly Token[]): Seat {
  return { ...seat, tokens };
}

function tokenTrackIndex(token: Token): number | null {
  if (token.progress < 0 || token.progress > 51) return null;
  return (START_INDEX[token.color] + token.progress) % 52;
}

function withProgress(token: Token, progress: number): Token {
  return { ...token, progress };
}

function getSeat(state: GameState, color: Color): Seat {
  const seat = state.seats.find((candidate) => candidate.color === color);
  if (seat === undefined) throw new RuleError("NOT_ACTIVE_SEAT", "Seat is not part of this game.");
  return seat;
}

/** Returns token IDs that can legally consume the supplied server-authoritative die. */
export function legalTokenIds(state: GameState, color: Color, die: DieValue): readonly string[] {
  assertDie(die);
  if (state.status !== "active") return [];
  const seat = getSeat(state, color);
  return seat.tokens
    .filter((token) => {
      if (token.progress === -1) return die === 6;
      return token.progress >= 0 && token.progress + die <= 56;
    })
    .map((token) => token.id);
}

/** Creates a state before first server-authoritative turn. */
export function createGameState(gameId: string, players: readonly { playerId: string; color: Color }[]): GameState {
  if (players.length < 2 || players.length > 4) {
    throw new Error("A game requires 2 to 4 seats.");
  }
  if (new Set(players.map((player) => player.playerId)).size !== players.length ||
      new Set(players.map((player) => player.color)).size !== players.length) {
    throw new Error("Players and colors must be unique.");
  }

  return {
    gameId,
    status: "waiting",
    seats: players.map((player) => ({
      color: player.color,
      playerId: player.playerId,
      tokens: Array.from({ length: 4 }, (_, index) => ({
        id: `${player.color}-${index + 1}`,
        color: player.color,
        progress: -1,
      })),
    })),
    activeColor: null,
    turn: 0,
    consecutiveSixes: 0,
    winnerOrder: [],
  };
}

/** Starts a fully initialized game after the fairness commit-reveal protocol completes. */
export function startGame(state: GameState, firstColor: Color): GameState {
  if (state.status !== "waiting") throw new Error("Only a waiting game can start.");
  getSeat(state, firstColor);
  return { ...state, status: "active", activeColor: firstColor, turn: 1, consecutiveSixes: 0 };
}

/**
 * Advances the turn without a move. Call only after a valid roll with no
 * legal move, or after a third six. It is intentionally separate from dice
 * generation so the caller must persist the actual roll event first.
 */
export function passTurn(state: GameState, die: DieValue): GameState {
  assertDie(die);
  if (state.status !== "active" || state.activeColor === null) {
    throw new RuleError("GAME_NOT_ACTIVE", "The game has no active turn.");
  }
  const next = nextColor(state, state.activeColor);
  return {
    ...state,
    activeColor: next,
    turn: state.turn + 1,
    consecutiveSixes: 0,
  };
}

/**
 * Applies exactly one legal move. The calling service must verify player,
 * game version and idempotency before invoking this deterministic function.
 */
export function applyMove(state: GameState, actorColor: Color, move: Move): AppliedMove {
  assertDie(move.die);
  if (state.status !== "active" || state.activeColor === null) {
    throw new RuleError("GAME_NOT_ACTIVE", "The game is not accepting moves.");
  }
  if (state.activeColor !== actorColor) {
    throw new RuleError("NOT_ACTIVE_SEAT", "Only the active seat may move.");
  }
  if (move.die === 6 && state.consecutiveSixes >= 2) {
    throw new RuleError("THIRD_SIX_FORFEITS_TURN", "A third consecutive six forfeits the turn.");
  }

  const seat = getSeat(state, actorColor);
  const token = seat.tokens.find((candidate) => candidate.id === move.tokenId);
  if (token === undefined) throw new RuleError("UNKNOWN_TOKEN", "Token is not in the active seat.");
  if (!legalTokenIds(state, actorColor, move.die).includes(token.id)) {
    throw new RuleError("ILLEGAL_MOVE", "The selected token cannot use this die value.");
  }

  const destination = token.progress === -1 ? 0 : token.progress + move.die;
  const moved = withProgress(token, destination);
  const destinationTrack = tokenTrackIndex(moved);
  const capturedTokenIds: string[] = [];

  const seatsAfterCapture = state.seats.map((candidateSeat) => {
    if (candidateSeat.color === actorColor || destinationTrack === null || SAFE_TRACK_INDICES.has(destinationTrack)) {
      return candidateSeat;
    }
    const tokens = candidateSeat.tokens.map((candidateToken) => {
      if (tokenTrackIndex(candidateToken) === destinationTrack) {
        capturedTokenIds.push(candidateToken.id);
        return withProgress(candidateToken, -1);
      }
      return candidateToken;
    });
    return cloneSeat(candidateSeat, tokens);
  });

  const ownSeat = seatsAfterCapture.find((candidateSeat) => candidateSeat.color === actorColor);
  if (ownSeat === undefined) throw new Error("Active seat disappeared.");
  const movedTokens = ownSeat.tokens.map((candidateToken) =>
    candidateToken.id === moved.id ? moved : candidateToken,
  );
  const seats = seatsAfterCapture.map((candidateSeat) =>
    candidateSeat.color === actorColor ? cloneSeat(candidateSeat, movedTokens) : candidateSeat,
  );

  const finished = movedTokens.every((candidateToken) => candidateToken.progress === 56);
  const winnerOrder = finished && !state.winnerOrder.includes(actorColor)
    ? [...state.winnerOrder, actorColor]
    : state.winnerOrder;
  const remaining = seats.filter((candidateSeat) => !winnerOrder.includes(candidateSeat.color));
  const gameFinished = remaining.length <= 1;
  const extraTurn = move.die === 6 && !gameFinished;

  return {
    state: {
      ...state,
      seats,
      status: gameFinished ? "finished" : "active",
      activeColor: gameFinished ? null : (extraTurn ? actorColor : nextColor({ ...state, seats, winnerOrder }, actorColor)),
      turn: gameFinished ? state.turn : state.turn + 1,
      consecutiveSixes: extraTurn ? state.consecutiveSixes + 1 : 0,
      winnerOrder: gameFinished && remaining.length === 1 && remaining[0] !== undefined
        ? [...winnerOrder, remaining[0].color]
        : winnerOrder,
    },
    capturedTokenIds,
    extraTurn,
    gameFinished,
  };
}

/** Shared-track position for rendering, or null for home/home-lane/finished tokens. */
export function publicTrackIndex(token: Token): number | null {
  return tokenTrackIndex(token);
}
