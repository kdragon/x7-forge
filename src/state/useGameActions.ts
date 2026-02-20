import { useCallback } from 'react';
import type { GameState } from './gameTypes';
import { useGameContext } from './GameContext';

export const useGameActions = () => {
  const { state, dispatch } = useGameContext();

  const setState = useCallback(
    (updater: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => {
      const payload = typeof updater === 'function' ? updater(state) : updater;
      dispatch({ type: 'SET_STATE', payload });
    },
    [dispatch, state],
  );

  const addLog = useCallback((message: string) => {
    dispatch({ type: 'ADD_LOG', payload: message });
  }, [dispatch]);

  return { setState, addLog };
};
