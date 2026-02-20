import { useGameContext } from './GameContext';

export const useGameState = () => {
  const { state } = useGameContext();
  return state;
};
