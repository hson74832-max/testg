import GameCanvas from './components/GameCanvas';
import { useEffect, useState } from 'react';
import { GameNetwork, NetworkState } from './game/network';

export default function App() {
  const [networkState, setNetworkState] = useState<NetworkState>({ status: 'connecting', playerId: null, players: new Map(), lastServerTime: null });

  useEffect(() => {
    const network = new GameNetwork();
    const unsubscribe = network.subscribe(setNetworkState);
    network.connect();
    return () => { unsubscribe(); network.disconnect(); };
  }, []);

  const label = networkState.status === 'connected' ? 'SERVER CONNECTED' : networkState.status === 'connecting' ? 'CONNECTING…' : networkState.status === 'error' ? 'SERVER ERROR' : 'SERVER OFFLINE';
  const dot = networkState.status === 'connected' ? 'bg-green-400' : networkState.status === 'connecting' ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <GameCanvas />
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-white/15 bg-black/70 px-3 py-2 font-mono text-xs text-white shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${dot}`} /><span>{label}</span></div>
        {networkState.status === 'connected' && <div className="mt-1 text-white/70">Players online: {networkState.players.size}</div>}
      </div>
    </div>
  );
}
