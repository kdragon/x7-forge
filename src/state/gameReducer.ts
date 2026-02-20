import type { GameAction, GameState } from './gameTypes';

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'ADD_LOG':
      return { ...state, log: [action.payload, ...state.log].slice(0, 10) };
    default:
      return state;
  }
};
