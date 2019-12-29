---
title: "Tutorial: how use spring boot with redis"
layout: post
date: 2019-06-03 20:00
image: /assets/images/redis/redis-spring-boot.png
headerImage: false
comments: true
lang: en
tag:
- redis
- spring boot
- docker
- docker-compose
- tutorial
- gradle
category: blog
author: mabuonomo
description: "Tutorial: how use spring boot with redis, in cache/database/message mode"
---

<img src="/assets/images/redis/redis-spring-boot.png" />

---

#### Summary
- [Overview](#overview)
- [What Is Redis?](#what-is-redis)
- [Initialize with Gradle](#initialize-with-gradle)

---

## Overview
We will build an application that demonstrates how to perform CRUD operations Redis through a web interface. The full source code for this project is available on <a href="https://github.com/mabuonomo/example-springboot-redis" target="_blank">GitHub</a>.

## What Is Redis?
Redis is an open-source, in-memory key-value data store, used as a database, cache, and message broker. In terms of implementation, Key-Value stores represent one of the largest and oldest members in the NoSQL space. Redis supports data structures such as strings, hashes, lists, sets, and sorted sets with range queries.

The Spring Data Redis framework makes it easy to write Spring applications that use the Redis Key-Value store by providing an abstraction to the data store.

## Initialize with Gradle
To define the connection settings between the application client and the Redis server instance, we need to use a Redis client.

There is a number of Redis client implementations available for Java. In this tutorial, we’ll use Jedis – a simple and powerful Redis client implementation.

There is good support for both XML and Java configuration in the framework; for this tutorial, we’ll use Java-based configuration.

{% highlight gradle %}
compile "org.springframework.boot:spring-boot-starter-data-redis"
compile "redis.clients:jedis"
{% endhighlight %}
