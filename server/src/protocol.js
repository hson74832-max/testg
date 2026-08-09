export const PROTOCOL_VERSION = 1;

export const CLIENT_MESSAGES = Object.freeze({
  PING: 'ping',
  SET_NAME: 'set_name',
});

export const SERVER_MESSAGES = Object.freeze({
  WELCOME: 'welcome',
  PLAYER_JOINED: 'player_joined',
  PLAYER_UPDATED: 'player_updated',
  PLAYER_LEFT: 'player_left',
  WORLD_SNAPSHOT: 'world_snapshot',
  PONG: 'pong',
  ERROR: 'error',
});
