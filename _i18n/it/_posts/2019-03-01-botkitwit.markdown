---
title: "BotKit.ai + Wit.ai in action"
layout: post
date: 2019-02-01 20:00
image: /assets/images/markdown.jpg
headerImage: false
lang: it
tag:
- botkit.ai
- nodejs
- typescript
- botkitwit-ts
- wit.ai
category: blog
author: mabuonomo
description: Markdown summary with different options
---

<img src="/assets/images/bot/main.jpg" />

---

#### Summary
- [Overview](#overview)
- [BotKit.ai](#botkitai)
- [Wit.ai](#witai)
- [Primo passo, creiamo un progetto Botkit.ai](#primo-passo-creiamo-un-progetto-botkitai)
- [Botkitwit-ts in action](#botkitwit-ts-in-action)

---

## Overview

Un bot senza intelligenza artificiale può definirsi un bot? Ovviamente no.
In questo tutorial cercherò di spiegare com'è possibile, in poche righe di codice aggiungere 
Wit.ai al framework Botkit.ai.

Cosa sono Botkit.ai e Wit.ai?

---

## BotKit.ai

Botkit.ai è descritto dai suoi autori in questo modo:

{% highlight html %}
BotKit is the leading developer tool for building chat bots, apps and 
custom integrations for major messaging platforms. 
We love bots, and want to make them easy and fun to build!
{% endhighlight %}

Il sito ufficiale del progetto è <a href="https://botkit.ai/" target="_blank">https://botkit.ai/</a>

Semplificando, Botkit.ai è un framework che permette di creare dei bot, in nodejs, in maniera davvero semplice, e supporta praticamente qualsiasi piattaforma di chat esistente: Web and Apps,Slack,Cisco Webex,Cisco Jabber,Microsoft Teams,Facebook Messenger,Twilio SMS,Twilio IPM,Microsoft Bot Framework,Google Hangouts Chat.

---

## Wit.ai

Wit.ai è un progetto made by Facebook, grazie ad esso il bot impara da solo, grazie al machine learning, come rispondere agli utenti, basandosi su esempi di conversazione che gli vengono sottoposti.

Il sito ufficiale del progetto è <a href="https://wit.ai/" target="_blank">https://wit.ai/</a>

Wit.ai è descritto dai suoi autori in questo modo:

{% highlight html %}
Wit.ai makes it easy for developers to build applications and devices 
that you can talk or text to. Our vision is to empower developers with 
an open and extensible natural language platform. We'll use this blog 
to share news, feature announcements and stories from our community.
{% endhighlight %}

Per chiarire meglio il funzionamento di Wit.ai possiamo fare riferimento alla schermata in basso

<img src="/assets/images/bot/wit-ai.png" />

La frase di un utente (in modalità text o voice) viene elaborata e strutturata. Il servizio ci restituirà delle intent e dei valori che ci permetteranno di gestire la conversazione o l'operazione da eseguire

Analizziamo un json d'esempio di risposta ricevuta da Wit.ai

<strong>User says: "Turn off the lights"</strong>

{% highlight json %}
{  
   "confidence":0.496,
   "intent":"lights",
   "_text":"Turn off the lights", 
   "entities":{  
      "on_off":[  // <-- result entity/action
         {  
            "value":"off" // <-- result value 
         }
      ]
   }
}
{% endhighlight %}

Il valore entity indica l'azione calcolata, mentre value il valore ricevuto, nel caso precedente è stato riconosciuto un on_off con valore off, potremo per esempio interpretarlo come lo spegnimento di qualcosa.

---

## Primo passo, creiamo un progetto Botkit.ai

Entriamo nel vivo dell'azione

Install Botkit
Use npm to install Botkit. Use the "-g" flag to install it globally, which makes Botkit's command line tool available.

{% highlight bash %}
npm install -g botkit
{% endhighlight %}

Create your bot
It's time to create new Botkit app!

{% highlight bash %}
botkit new --platform web
{% endhighlight %}

The command line tool will collect a few pieces of information from you, like the name of your bot. Then, it will create a pre-configured and ready-to-customize bot project for you.

Installation complete! To start your bot, type:
{% highlight bash %}
cd my_project && node .
{% endhighlight %}

Boot it up and say Hello!
Next, run the app from the project folder. It'll boot up and you'll be able to chat with the bot in your web browser!

{% highlight bash %}
cd my_project
node .
{% endhighlight %}

You'll see...

I AM ONLINE! COME TALK TO ME: <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>

---

## Botkitwit-ts in action

In precedenza ho detto che dobbiamo aggiungere Wit.ai a Botkit.ai. Come si fa?
Botkit.ai permette di utilizzare dei middleware, degli oggetti che intercetteranno le nostre domande, le invieranno prima a Wit.ai e inoltreranno il json con la risposta elaborata a botkit.ai.

In questo tutorial utilizzerò il middleware da me sviluppato, in typescript, <a href="https://github.com/mabuonomo/botkitwit-ts" target="_blank">botkitwit-ts</a> (se lo trovi interessante votalo :))

Prima di tutto dobbiamo aggiungere il middleware al progetto

{% highlight bash %}
npm install --save botkitwit
{% endhighlight %}

Una volta aggiunto possiamo passare all'azione vera e propria:

{% highlight typescript %}
import { BotKitWit } from './src/botkitwit'
import { WebConfiguration, WebController } from 'botkit';
import { IConfig } from './src/types/IConfig';

let config: IConfig = { token: 'PUT_HERE_WIT_ACCESS_TOKEN', minimum_confidence: 0.5 }
let wit = new BotKitWit(config)

var Botkit = require('botkit');
var bot_options: WebConfiguration = {
    replyWithTyping: true,
};
var controller: WebController = Botkit.socketbot(bot_options);

var webserver = require(__dirname + '/components/express_webserver.js')(controller);
require(__dirname + '/components/plugin_identity.js')(controller);

// Open the web socket server
controller.openSocketServer(controller.httpserver);
controller.startTicking();

controller.middleware.receive.use(wit.receive);

controller.hears(
    [
        'greeting',
        'booking_info',
        'weather'
    ],
    'message_received',
    wit.heard,
    function (bot: any, message: any) {
        console.log(message);
        bot.reply(message, 'Hello!');
        bot.reply(message, message.text);
        bot.reply(message, message.response);
    }
);

console.log('I AM ONLINE! COME TALK TO ME: http://localhost:' + (process.env.PORT || 3000))
{% endhighlight %}

E infine possiamo testare il nostro bot navigando a <a href="http://localhost:3000" target="_blank">http://localhost:3000</a>

<img src="/assets/images/bot/botkit2.png"/>