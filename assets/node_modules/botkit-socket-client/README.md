# WIP: Botkit socket client

A small botkit (https://botkit.ai/) socket client library written in typescript

## Usage
Import the library
```html
 <script src="../dist/dev/botkit.js"></script>
```

Create a client and send a message
```js
const config = {
    ws_url: "ws://localhost:3000",
    reconnect_timeout: 3000,
    max_reconnect: 5,
    enable_history: false
}

let client = new Botkit.BotKitClient(config);
client.send("Demo sender")
```

## Are you a dev? You are welcome!

Initialize the project
```sh
make install
```

Build in dev mode
```sh
make build-prod
```

Build in prod mode
```sh
make watch-dev
```