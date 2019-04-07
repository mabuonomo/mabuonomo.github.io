---
title: "Spring Boot: live reload with Docker"
layout: post
date: 2019-04-01 20:00
image: /assets/images/spring/logo.png
headerImage: false
comments: true
lang: en
tag:
- spring boot
- live reload
- java
- docker
- gradle
- tutorial
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
- [Build and Run!](#build-and-run)

---

## Overview

When we develop web applications with Spring Boot, we have to restart the server to pick up all our changes. This kills productivity. Spring Boot Developers Tools provides solutions to automatically pick up changes without a complete server restart. 


## The Problem With Server Restarts

When we develop our applications (web or RESTful API), we want to be able to test our changes quickly.
Typically, in the Java world, we need to restart the server to pick up changes.

That's where Spring Boot Developer Tools comes into the picture.

Adding Spring Boot Developer Tools to your project is very simple. First, add this dependency to your Spring Boot Project gradle.build:

{% highlight gradle %}
compile 'org.springframework.boot:spring-boot-devtools'
{% endhighlight %}

## Dockerizer

Create a file in the root of the project, called 'Dockerfile', I've used this <a href="https://github.com/keeganwitt/docker-gradle/blob/0c2624d788edb813667a1e72659f8be612d420f3/jdk11/Dockerfile" target="_blank">Dockerfile</a>'s template:

{% highlight dockerfile %}
FROM openjdk:11-jre

CMD ["gradle"]

ENV GRADLE_HOME /opt/gradle
ENV GRADLE_VERSION 5.3.1

ARG GRADLE_DOWNLOAD_SHA256=1c59a17a054e9c82f0dd881871c9646e943ec4c71dd52ebc6137d17f82337436
RUN set -o errexit -o nounset \
    && echo "Downloading Gradle" \
    && wget --no-verbose --output-document=gradle.zip "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" \
    \
    && echo "Checking download hash" \
    && echo "${GRADLE_DOWNLOAD_SHA256} *gradle.zip" | sha256sum --check - \
    \
    && echo "Installing Gradle" \
    && unzip gradle.zip \
    && rm gradle.zip \
    && mv "gradle-${GRADLE_VERSION}" "${GRADLE_HOME}/" \
    && ln --symbolic "${GRADLE_HOME}/bin/gradle" /usr/bin/gradle \
    \
    && echo "Adding gradle user and group" \
    && groupadd --system --gid 1000 gradle \
    && useradd --system --gid gradle --uid 1000 --shell /bin/bash --create-home gradle \
    && mkdir /home/gradle/.gradle \
    && chown --recursive gradle:gradle /home/gradle \
    \
    && echo "Symlinking root Gradle cache to gradle Gradle cache" \
    && ln -s /home/gradle/.gradle /root/.gradle

USER gradle
VOLUME "/home/gradle/.gradle"
WORKDIR /home/gradle

RUN set -o errexit -o nounset \
    && echo "Testing Gradle installation" \
    && gradle --version
{% endhighlight %}

Info: this is the official <a href="https://hub.docker.com/_/gradle" target="_blank">Gradle Docker Hub</a>

Create a file in the root of the project, called 'docker-compose.yml':

{% highlight yaml %}
version: '3.3'
services:
  spring-boot-test:
    build:
      context: ./
      dockerfile: Dockerfile  
    volumes:
      - ./:/app
    working_dir: /app
    command: sh run.sh
    ports:
      - 8080:8080
{% endhighlight %}

And create another file in the root of the project, called 'run.sh':

{% highlight bash %}
#!/bin/bash
gradle --stop
gradle build --continuous --quiet &
gradle bootRun
{% endhighlight %}

## Build and Run!
{% highlight bash %}
docker-compose build
docker-compose up
{% endhighlight %}