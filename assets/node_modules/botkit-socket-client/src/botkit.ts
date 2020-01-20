import { IBotkitConfig } from './interfaces/config.interface';
import { IBotkitMessage } from './interfaces/message.interface';
import { ConnectEvent, generateGuid, ListenerEvent } from './utils';

export class BotKitClient {
  config: IBotkitConfig;
  socket: WebSocket;
  constructor(config: IBotkitConfig) {
    this.config = config;
    this.connectWebsocket();
  }

  private getGuid() {
    if (!this.config.userGuid) {
      this.config.userGuid = generateGuid();
    }

    return this.config.userGuid;
  }

  /**
   * Send e text message
   * @param text
   */
  send(text: string) {
    this.deliverMessage({
      type: ConnectEvent.MESSAGE,
      text,
      user: this.getGuid(),
      channel: 'websocket',
    });

    return false;
  }

  /**
   * Create a json version of IbotKitMessage
   * @param message
   */
  private deliverMessage(message: IBotkitMessage) {
    console.log(message);
    this.socket.send(JSON.stringify(message));
  }

  /**
   * Connect to remote botkit websocket
   */
  private connectWebsocket() {
    // Create WebSocket connection.
    this.socket = new WebSocket(this.config.ws_url);
    const self = this;

    // Connection opened
    this.socket.addEventListener(ListenerEvent.OPEN, (event) => {
      console.log('CONNECTED TO SOCKET');

      self.deliverMessage({
        type: self.config.userGuid === undefined ? ConnectEvent.HELLO : ConnectEvent.WELCOME_BACK,
        user: self.getGuid(),
        channel: 'socket',
      });
    });

    this.socket.addEventListener(ListenerEvent.ERROR, (event) => {
      console.error('ERROR', event);
    });

    this.socket.addEventListener(ListenerEvent.CLOSE, (event) => {
      console.log('SOCKET CLOSED!');
    });

    // Listen for messages
    this.socket.addEventListener(ListenerEvent.MESSAGE, (event) => {
      let message = null;
      try {
        console.log('Response: ', event.data);
        message = JSON.parse(event.data);
      } catch (err) {
        return;
      }
    });
  }
}
