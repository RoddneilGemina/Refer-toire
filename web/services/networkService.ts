import { Platform } from 'react-native';
import * as Network from 'expo-network';

type NetworkListener = (isOnline: boolean) => void;

class NetworkServiceManager {
  private _isOnline: boolean = true;
  private _simulated: boolean | null = null;
  private _listeners: Set<NetworkListener> = new Set();
  private _intervalId: any = null;
  private _initialized: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this._initialized) return;
    this._initialized = true;

    // Initial state check
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      this._isOnline = navigator.onLine;
    }

    // Web Event Listeners
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this._simulated = null;
        this.handleStatusChange(true);
      });
      window.addEventListener('offline', () => {
        this._simulated = null;
        this.handleStatusChange(false);
      });
    }

    // Native initial check
    if (Platform.OS !== 'web') {
      Network.getNetworkStateAsync()
        .then(state => {
          const online = Boolean(state.isConnected && state.isInternetReachable !== false);
          this.handleStatusChange(online);
        })
        .catch(() => {});
    }

    // Periodic check / heartbeat (every 3.5s) to guarantee accurate state across platforms
    this._intervalId = setInterval(async () => {
      try {
        if (this._simulated !== null) return;
        if (Platform.OS === 'web') {
          if (typeof navigator !== 'undefined') {
            this.handleStatusChange(navigator.onLine);
          }
        } else {
          const state = await Network.getNetworkStateAsync();
          const online = Boolean(state.isConnected && state.isInternetReachable !== false);
          this.handleStatusChange(online);
        }
      } catch {
        // Ignored
      }
    }, 3500);
  }

  private handleStatusChange(online: boolean) {
    if (this._isOnline === online) return;
    this._isOnline = online;
    this._listeners.forEach(listener => {
      try {
        listener(online);
      } catch (err) {
        console.warn('Network listener error:', err);
      }
    });
  }

  public isOnline(): boolean {
    if (this._simulated !== null) {
      return this._simulated;
    }
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return this._isOnline;
  }

  public setSimulatedStatus(online: boolean | null) {
    this._simulated = online;
    if (online !== null) {
      this.handleStatusChange(online);
    }
  }

  public subscribe(listener: NetworkListener): () => void {
    this._listeners.add(listener);
    // Call immediately with current state
    listener(this._isOnline);

    return () => {
      this._listeners.delete(listener);
    };
  }
}

export const NetworkService = new NetworkServiceManager();
