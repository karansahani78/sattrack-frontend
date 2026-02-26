import { Client, type StompSubscription } from '@stomp/stompjs';
import type { SatellitePosition } from '../types';

type PositionCallback = (position: SatellitePosition) => void;

/**
 * STOMP WebSocket client with SockJS fallback.
 *
 * Uses @stomp/stompjs v7's built-in webSocketFactory so we can supply
 * SockJS without a separate import that Vite might struggle to resolve.
 *
 * Gracefully degrades: if the WebSocket server is unreachable the app
 * still works via REST polling (useLivePosition hook handles both paths).
 */
class SatelliteWebSocketService {
  private client: Client | null = null;
  private subscriptions = new Map<string, StompSubscription>();
  private callbacks = new Map<string, Set<PositionCallback>>();
  private _connected = false;
  private pendingSubscriptions: Array<() => void> = [];

  connect() {
    const wsBase = (import.meta.env.VITE_API_URL || '')
      .replace('/api', '')
      .replace('http://', 'ws://')
      .replace('https://', 'wss://');

    const sockJsUrl = `${window.location.origin}/ws`;

    this.client = new Client({
      // SockJS is loaded via script tag in index.html to avoid Vite CJS issues
      webSocketFactory: () => {
        // @ts-ignore — SockJS is a global loaded via CDN script
        if (typeof SockJS !== 'undefined') {
          // @ts-ignore
          return new SockJS(sockJsUrl);
        }
        // Native WebSocket fallback
        return new WebSocket(sockJsUrl.replace('http', 'ws'));
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        this._connected = true;
        this.pendingSubscriptions.forEach((sub) => sub());
        this.pendingSubscriptions = [];
      },
      onDisconnect: () => {
        this._connected = false;
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers['message']);
      },
    });

    this.client.activate();
  }

  disconnect() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.callbacks.clear();
    this.client?.deactivate();
  }

  subscribeToSatellite(noradId: string, callback: PositionCallback): () => void {
    if (!this.callbacks.has(noradId)) {
      this.callbacks.set(noradId, new Set());
    }
    this.callbacks.get(noradId)!.add(callback);

    const doSubscribe = () => {
      if (!this.subscriptions.has(noradId) && this.client) {
        const sub = this.client.subscribe(
          `/topic/satellites/${noradId}`,
          (message) => {
            try {
              const pos: SatellitePosition = JSON.parse(message.body);
              this.callbacks.get(noradId)?.forEach((cb) => cb(pos));
            } catch (e) {
              console.error('Failed to parse WS position message', e);
            }
          }
        );
        this.subscriptions.set(noradId, sub);
      }
    };

    if (this._connected) {
      doSubscribe();
    } else {
      this.pendingSubscriptions.push(doSubscribe);
    }

    return () => {
      const callbacks = this.callbacks.get(noradId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.get(noradId)?.unsubscribe();
          this.subscriptions.delete(noradId);
          this.callbacks.delete(noradId);
        }
      }
    };
  }

  isConnected() {
    return this._connected;
  }
}

export const wsService = new SatelliteWebSocketService();
