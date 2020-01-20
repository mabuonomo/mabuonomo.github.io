export function generateGuid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

export enum ConnectEvent {
  HELLO = 'hello',
  WELCOME_BACK = 'welcome_back',
  MESSAGE = 'message',
}

export enum ListenerEvent {
  OPEN = 'open',
  MESSAGE = 'message',
  ERROR = 'error',
  CLOSE = 'close',
}
