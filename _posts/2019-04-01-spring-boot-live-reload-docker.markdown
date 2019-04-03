---
title: "Spring Boot: live reload with Docker"
layout: post
date: 2019-03-01 20:00
image: /assets/images/spring/logo.jpg
headerImage: false
comments: true
lang: en
tag:
- spring boot
- live reload
- java
- docker
- gradle
category: blog
author: mabuonomo
description: "Spring Boot: live reload with Docker"
---

<img src="/assets/images/spring/logo.png" />

---

#### Summary
- [Overview](#overview)
- [The Problem With Server Restarts](#the-problem-with-server-restarts)
- [Dockerizer](#dockerizer)
- [Run!](#run)

---

## Overview

When we develop web applications with Java, we have to restart the server to pick up all our changes. This kills productivity. Spring Boot Developers Tools provides solutions to automatically pick up changes without a complete server restart. Let's get productive with Spring Boot Developer Tools.


## The Problem With Server Restarts

When we develop our applications (web or RESTful API), we want to be able to test our changes quickly.

Typically, in the Java world, we need to restart the server to pick up changes. Sure, there are plugins like JRebel that help, but you need shell out money for them.

Restarting a server takes about 1-5 minutes based on the size of the application. A typical developer does 30-40 restarts in a day. I leave it as an exercise in basic math to determine how much time a developer can save if changes are automatically picked up as soon as they're made.

That's where Spring Boot Developer Tools comes into the picture.

Adding Spring Boot Developer Tools to your project is very simple. First, add this dependency to your Spring Boot Project gradle.build:

{% highlight gradle %}
compile 'org.springframework.boot:spring-boot-devtools'
{% endhighlight %}

## Dockerizer
And create a file in the root of the project, called 'docker-compose.yml':

{% highlight yaml %}
version: '3.3'
services:
  spring-boot-test:
    image: openjdk:8
    volumes:
      - ./:/app
    working_dir: /app
    command: sh run.sh
    ports:
      - 8080:8080
{% endhighlight %}

And create a file in the root of the project, called 'run.sh':

{% highlight bash %}
#!/bin/bash
./gradlew build --continuous & 
./gradlew --project-cache-dir /tmp/gradle-cache bootRun
{% endhighlight %}

## Run!
{% highlight bash %}
docker-compose up
{% endhighlight %}