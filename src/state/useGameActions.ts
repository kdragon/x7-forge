import { useCallback, useEffect, useRef } from 'react';
import type { GameState } from './gameTypes';
import { useGameContext } from './GameContext';

export const useGameActions = () => {
  const { state, dispatch } = useGameContext();
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setState = useCallback(
    (updater: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => {
      const payload = typeof updater === 'function' ? updater(stateRef.current) : updater;
      dispatch({ type: 'SET_STATE', payload });
    },
    [dispatch],
  );

  const addLog = useCallback((message: string) => {
    dispatch({ type: 'ADD_LOG', payload: message });
  }, [dispatch]);

  return { setState, addLog };
};
