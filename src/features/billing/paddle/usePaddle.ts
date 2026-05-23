import { useEffect, useState } from 'react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';

const TOKEN = process.env.REACT_APP_PADDLE_CLIENT_TOKEN;
const ENVIRONMENT = (process.env.REACT_APP_PADDLE_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';

let paddleSingleton: Paddle | undefined;

export function usePaddle(): Paddle | undefined {
  const [paddle, setPaddle] = useState<Paddle | undefined>(paddleSingleton);

  useEffect(() => {
    if (paddleSingleton) {
      setPaddle(paddleSingleton);
      return;
    }
    if (!TOKEN) {
      // Don't initialise without a token — log once and bail.
      console.warn('REACT_APP_PADDLE_CLIENT_TOKEN not set; checkout disabled');
      return;
    }
    initializePaddle({ token: TOKEN, environment: ENVIRONMENT })
      .then((instance) => {
        paddleSingleton = instance;
        setPaddle(instance);
      })
      .catch((err) => console.error('Failed to initialize Paddle', err));
  }, []);

  return paddle;
}
