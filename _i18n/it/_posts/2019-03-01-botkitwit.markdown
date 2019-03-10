---
title: "BotKit.ai with Wit.ai"
layout: post
date: 2019-02-01 20:00
image: /assets/images/markdown.jpg
headerImage: false
lang: it
tag:
- botkit
- nodejs
- typescript
- botkitwit
- wit.ai
category: blog
author: mabuonomo
description: Markdown summary with different options
---

<img src="/assets/images/bot/main.jpg" />

---

## Summary

Un bot senza intelligenza artificiale può definirsi un bot? Ovviamente no.
In questo tutorial cercherò di spiegare com'è possibile, in poche righe di codice aggiungere 
Wit.ai al framework Botkit.ai.

Ma cosa sono Botkit.ai e Wit.ai?

---

## BotKit.ai overview

Botkit utilizza NodeJs. Il sito ufficiale del progetto è <a href="https://botkit.ai/" target="_blank">https://botkit.ai/</a>

E' descritto dai suoi autori in questo modo:

{% highlight html %}
BotKit is the leading developer tool for building chat bots, apps and 
custom integrations for major messaging platforms. 
We love bots, and want to make them easy and fun to build!
{% endhighlight %}

In poche parole Botkit.ai è un framework che permette di creare dei bot, in nodejs, in maniera davvero semplice, e supporta praticamente qualsiasi piattaforma di chat esistente: Web and Apps,Slack,Cisco Webex,Cisco Jabber,Microsoft Teams,Facebook Messenger,Twilio SMS,Twilio IPM,Microsoft Bot Framework,Google Hangouts Chat.

---

## Wit.ai overview

Wit.ai è un progetto made by Facebook. Il suo scopo è quello di permettere di inserire l'intelligenza artificiale in maniera semplice e free nelle nostre applicazioni. 

Il sito ufficiale del progetto è <a href="https://wit.ai/ target="_blank">https://wit.ai/</a>

E' descritto dai suoi autori in questo modo:

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

User: Turn off the lights

{% highlight json %}
{  
   "confidence":0.496,
   "intent":"lights",
   "_text":"Turn off the lights",
   "entities":{  
      "on_off":[  
         {  
            "value":"off"
         }
      ]
   }
}
{% endhighlight %}

Il valore entity indica l'azione calcolata, mentre value il valore ricevuto, nel caso precedente è stato riconosciuto un on_off con valore off, potremo per esempio interpretarlo come lo spegnimento di qualcosa.



<!-- #### Especial Elements
- [Summary](#summary)
- [BotKit.ai overview](#botkitai-overview)
- [Wit.ai overview](#witai-overview)
    - [External Elements](#external-elements)
- [First step, creiamo un progetto Botkit.ai](#first-step-creiamo-un-progetto-botkitai)
- [Botkitwit-ts in action](#botkitwit-ts-in-action)

#### External Elements
- [Gist](#gist)
- [Codepen](#codepen)
- [Slideshare](#slideshare)
- [Videos](#videos) -->

---

## First step, creiamo un progetto Botkit.ai

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
Botkit.ai permette di utilizzare dei middleware, degli oggetti che intercetteranno le nostre domende, le invieranno prima a Wit.ai e restituiranno il json con la risposta elaborata a botkit.ai.

In questo tutorial utilizzerò il middleware da me sviluppato, in typescript, <a href="https://github.com/mabuonomo/botkitwit-ts" target="_blank">botkitwit-ts</a>

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


[1]: http://daringfireball.net/projects/markdown/
[2]: http://www.fileformat.info/info/unicode/char/2163/index.htm
[3]: http://www.markitdown.net/
[4]: http://daringfireball.net/projects/markdown/basics
[5]: http://daringfireball.net/projects/markdown/syntax
[6]: http://kune.fr/wp-content/uploads/2013/10/ghost-blog.jpg
