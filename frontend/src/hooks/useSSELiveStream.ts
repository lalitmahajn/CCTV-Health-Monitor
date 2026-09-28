import { useEffect, useRef, useState, useCallback } from 'react';
import type { SSEEventData } from '../lib/types';
import { soundManager } from '../lib/audio';

export type SSEConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseSSEOptions {
  onEvent?: (event: SSEEventData) => void;
  soundAlerts?: boolean;
}

export function useSSELiveStream(options: UseSSEOptions = {}) {
  const [status, setStatus] = useState<SSEConnectionStatus>('connecting');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus('connecting');
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.onopen = () => {
      setStatus('connected');
      setLastHeartbeat(new Date());
      reconnectDelayRef.current = 1000; // Reset backoff
    };

    es.onmessage = (event) => {
      setLastHeartbeat(new Date());
      try {
        const data: SSEEventData = JSON.parse(event.data);
        if (data.type === 'CAMERA_DOWN') {
          if (optionsRef.current.soundAlerts !== false) {
            soundManager.playAlertBeep();
          }
        } else if (data.type === 'CAMERA_RECOVERED') {
          if (optionsRef.current.soundAlerts !== false) {
            soundManager.playSuccessChime();
          }
        }

        if (optionsRef.current.onEvent) {
          optionsRef.current.onEvent(data);
        }
      } catch (err) {
        console.warn('Failed to parse SSE payload:', err);
      }
    };

    es.onerror = () => {
      setStatus('disconnected');
      es.close();

      // Exponential backoff reconnect
      const delay = Math.min(reconnectDelayRef.current * 1.5, 10000);
      reconnectDelayRef.current = delay;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    status,
    lastHeartbeat,
    reconnect: connect,
  };
}
