export const ROLE_OPERATOR = "operator";
export const ROLE_ROBOT = "robot";
export const ROLE_VISITOR = "visitor";

export const EVENT_JOIN = "join";
export const EVENT_SIGNAL = "signal";
export const EVENT_CONTROL = "control";
export const EVENT_STATUS = "status";
export const EVENT_VIDEO_QUALITY = "video-quality";
export const EVENT_HANGUP = "hangup";
export const EVENT_LEAVE = "leave";

export const EVENT_JOINED = "joined";
export const EVENT_PEER_JOINED = "peer-joined";
export const EVENT_PEER_LEFT = "peer-left";
export const EVENT_ROOM_STATE = "room-state";
export const EVENT_REPLACED = "replaced";
export const EVENT_SESSION_EXPIRED = "session-expired";
export const EVENT_ERROR_MESSAGE = "error-message";

export const SIGNAL_OFFER = "offer";
export const SIGNAL_ANSWER = "answer";
export const SIGNAL_ICE_CANDIDATE = "ice-candidate";

export const CLIENT_TO_SERVER = [
  EVENT_JOIN,
  EVENT_SIGNAL,
  EVENT_CONTROL,
  EVENT_STATUS,
  EVENT_VIDEO_QUALITY,
  EVENT_HANGUP,
  EVENT_LEAVE,
];

export const SERVER_TO_CLIENT = [
  EVENT_JOINED,
  EVENT_PEER_JOINED,
  EVENT_PEER_LEFT,
  EVENT_ROOM_STATE,
  EVENT_REPLACED,
  EVENT_SESSION_EXPIRED,
  EVENT_SIGNAL,
  EVENT_CONTROL,
  EVENT_STATUS,
  EVENT_VIDEO_QUALITY,
  EVENT_HANGUP,
  EVENT_ERROR_MESSAGE,
];
