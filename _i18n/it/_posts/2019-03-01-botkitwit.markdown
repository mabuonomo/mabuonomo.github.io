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

## Summary

Un bot senza intelligenza artificiale può definirsi un bot? Ovviamente no.
In questo tutorial cercherò di spiegare com'è possibile, in poche righe di codice aggiungere 
Wit.ai al framework Botkit.ai.

Ma cosa sono Botkit.ai e Wit.ai?

## BotKit.ai overview

Botkit utilizza NodeJs. Il sito ufficiale del progetto è <a href="https://botkit.ai/" target="_blank">https://botkit.ai/</a>

E' descritto dai suoi autori in questo modo:

{% highlight html %}
BotKit is the leading developer tool for building chat bots, apps and 
custom integrations for major messaging platforms. 
We love bots, and want to make them easy and fun to build!
{% endhighlight %}

In poche parole Botkit.ai è un framework che permette di creare dei bot, in nodejs, in maniera davvero semplice, e supporta praticamente qualsiasi piattaforma di chat esistente: Web and Apps,Slack,Cisco Webex,Cisco Jabber,Microsoft Teams,Facebook Messenger,Twilio SMS,Twilio IPM,Microsoft Bot Framework,Google Hangouts Chat.

## Wit.ai overview

{% highlight html %}
Wit.ai makes it easy for developers to build applications and devices 
that you can talk or text to. Our vision is to empower developers with 
an open and extensible natural language platform. We'll use this blog 
to share news, feature announcements and stories from our community.
{% endhighlight %}

Di seguito la descrizione su github:

{% highlight html %}
Botkit is the leading developer tool for building chat bots, apps and custom integrations for major messaging platforms.

Botkit offers everything you need to design, build and operate an app:

* Easy-to-extend starter kits
* Fully-featured SDK with support for all major platforms
* Tons of plugins and middlewares

Plus, Botkit works with all the NLP services (like Microsoft LUIS and IBM Watson), can use any type of database you want, and runs on almost any hosting platform.
{% endhighlight %}

## Wit.ai overview

Wit.ai permette easily create text or voice based bots that humans can chat with on their preferred messaging platform.

Question? 
Turn off the lights

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
- [Wit.ai overview](#witai-overview-1)
    - [External Elements](#external-elements)
- [First step](#first-step)
- [Aggiungiamo Wit.ai tramite Botkitwit-ts: Botkitwit-ts in action](#aggiungiamo-witai-tramite-botkitwit-ts-botkitwit-ts-in-action)

#### External Elements
- [Gist](#gist)
- [Codepen](#codepen)
- [Slideshare](#slideshare)
- [Videos](#videos) -->

---

## First step

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
Your bot is alive!!!!! If you did this on your local computer, you should be able to load it in your browser at http://localhost:3000 and get to chatting!

## Aggiungiamo Wit.ai tramite Botkitwit-ts: Botkitwit-ts in action

Esempio di codice:

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
