// Collectible tokens scattered across levels (#100).
// Optional collectibles contributing to per-level completion metric.
// Tokens interact with the mutation system: they can appear/disappear between attempts.

import { aabbOverlap, type Body } from '../engine/physics';

export interface Token {
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
}

export interface TokenCollectionState {
  tokens: Token[];
  totalCollected: number;
  totalTokens: number;
}

export function createTokens(positions: readonly { x: number; y: number }[]): TokenCollectionState {
  const tokens: Token[] = positions.map(p => ({
    x: p.x, y: p.y, width: 8, height: 8, collected: false,
  }));
  return { tokens, totalCollected: 0, totalTokens: tokens.length };
}

export function stepTokens(state: TokenCollectionState, playerBody: Body): TokenCollectionState {
  let collected = 0;
  const tokens = state.tokens.map(token => {
    if (token.collected) return token;
    if (aabbOverlap(playerBody, { x: token.x, y: token.y, width: token.width, height: token.height })) {
      collected++;
      return { ...token, collected: true };
    }
    return token;
  });
  return {
    tokens,
    totalCollected: state.totalCollected + collected,
    totalTokens: state.totalTokens,
  };
}

export function resetTokens(state: TokenCollectionState): TokenCollectionState {
  return {
    tokens: state.tokens.map(t => ({ ...t, collected: false })),
    totalCollected: 0,
    totalTokens: state.totalTokens,
  };
}

export function getCompletionPercent(state: TokenCollectionState): number {
  if (state.totalTokens === 0) return 1;
  return state.totalCollected / state.totalTokens;
}

export function isFullyCollected(state: TokenCollectionState): boolean {
  return state.totalCollected === state.totalTokens;
}

// Mutation support: tokens can appear or disappear between attempts
export function applyTokenMutation(
  state: TokenCollectionState,
  visibleIndices: readonly number[],
): TokenCollectionState {
  const tokens = state.tokens.map((t, i) => ({
    ...t,
    // Hide tokens not in the visible set (but don't un-collect already collected ones)
    collected: t.collected || !visibleIndices.includes(i) ? t.collected : t.collected,
  }));
  return { ...state, tokens };
}
