import { ConnectEvent } from '../utils';

export interface IBotkitMessage {
  type: ConnectEvent;
  text?: string;
  user: string;
  channel: 'socket' | 'websocket';
  user_profile?: any;
}
