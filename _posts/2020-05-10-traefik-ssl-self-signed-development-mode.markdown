---
title: "Dev Mode: Traefik with ssl self signed using mkcert"
layout: post
date: 2020-05-10 01:00
image: /assets/images/traefik/traefik-architecture.png
headerImage: false
comments: true
lang: en
tag:
    - microservices
    - docker
    - docker-compose
    - traefik
    - mkcert
category: blog
author: mabuonomo
description: "Dev Mode: Traefik with ssl self signed using mkcert, without Let's encrypt"
---

<img src="/assets/images/traefik/traefik-architecture.png" />

---

#### Summary

-   [Overview](#overview)
-   [The ssl problem](#the-ssl-problem)
-   [What is mkcert](#what-is-mkcert)
-   [Traefik and Mkcert](#traefik-and-mkcert)
-   [References](#references)

---

## Overview

Traefik is an open-source Edge Router that makes publishing your services a fun and easy experience. It receives requests on behalf of your system and finds out which components are responsible for handling them.

What sets Traefik apart, besides its many features, is that it automatically discovers the right configuration for your services. The magic happens when Traefik inspects your infrastructure, where it finds relevant information and discovers which service serves which request.

Traefik is natively compliant with every major cluster technology, such as Kubernetes, Docker, Docker Swarm, AWS, Mesos, Marathon, and the list goes on; and can handle many at the same time. (It even works for legacy software running on bare metal.)

With Traefik, there is no need to maintain and synchronize a separate configuration file: everything happens automatically, in real time (no restarts, no connection interruptions). With Traefik, you spend time developing and deploying new features to your system, not on configuring and maintaining its working state.

## The SSL problem

When we develop in a development environment we have a classic ssl problem, it's very difficult to create a valid ssl certificate per domains like localhost, 127.0.0.1, \*.examples.com etc.

Let's encrypt simplified the process for obtain a valid ssl certificate but not work for these environment domains. An alternative solution is use mkcert

## What is Mkcert

A simple zero-config tool to make locally trusted development certificates with any names you'd like. <a href="https://mkcert.dev">https://mkcert.dev</a>

```sh
$ mkcert -install
Created a new local CA at "/Users/filippo/Library/Application Support/mkcert" 💥
The local CA is now installed in the system trust store! ⚡️
The local CA is now installed in the Firefox trust store (requires browser restart)! 🦊

$ mkcert example.com "*.example.com" example.test localhost 127.0.0.1 ::1
Using the local CA at "/Users/filippo/Library/Application Support/mkcert" ✨

Created a new certificate valid for the following names 📜
 - "example.com"
 - "*.example.com"
 - "example.test"
 - "localhost"
 - "127.0.0.1"
 - "::1"

The certificate is at "./example.com+5.pem" and the key at "./example.com+5-key.pem" ✅
```

## Traefik and Mkcert

The project structure:

```sh
config
--- ssl
----- key.pem
----- cert.pem
---- ssl.toml
---- traefik.toml
docker-compose.yml
```

traefik.toml

```toml
[serversTransport]
insecureSkipVerify = true

[entryPoints]

[entryPoints.http]
address = ":80"

[entryPoints.https]
address = ":443"

[providers]

[providers.docker]
watch = true
endpoint = "unix:///var/run/docker.sock"
exposedByDefault = false

[api]
insecure = true
dashboard = true
debug = true

[log]
level = "DEBUG"

[accesslog]

[providers.file]
  filename = "/root/.config/ssl.toml"
```

ssl.toml

```toml
[tls]

[tls.stores]

[tls.stores.default]

[tls.stores.default.defaultCertificate]
certFile = "/root/.config/ssl/cert.pem"
keyFile = "/root/.config/ssl/key.pem"

[[tls.certificates]]
certFile = "/root/.config/ssl/cert.pem"
keyFile = "/root/.config/ssl/key.pem"
stores = ["default"]
```

docker-compose.yml

```yaml
version: "3.7"
services:
    traefik:
        container_name: traefik
        image: traefik:v2.2
        ports:
            - 80:80
            - 443:443
            - 8080:8080
        volumes:
            - ./config:/root/.config
            - /var/run/docker.sock:/var/run/docker.sock:ro
        networks:
            - web
```

Build the certificates:

```sh
mkcert -install
mkcert -key-file ./config/ssl/key.pem -cert-file ./config/ssl/cert.pem \
		*.example.com localhost
```

<img src="/assets/images/traefik/example.png" />

## References

-   <a href="https://docs.traefik.io/" target="_blank">https://docs.traefik.io/</a>
-   <a href="https://mkcert.dev/" target="_blank">https://mkcert.dev/</a>
