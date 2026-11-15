---
title: "Install Docker on the Raspberry Pi"
layout: post
date: 2021-03-14 20:00
image: /assets/images/docker/raspi.png
headerImage: false
comments: true
lang: en
tag:
    - raspberry
    - docker
    - docker-compose
    - tutorial
    - install
    - iot
category: blog
author: mabuonomo
description: "Install docker and docker-compose on the Raspberry Pi"
---

<img src="/assets/images/docker/raspi.png" />

---

#### Summary

-   [Overview](#overview)
-   [What are the difficulties in connecting the Raspberry Pi with Docker?](#what-are-the-difficulties-in-connecting-the-raspberry-pi-with-docker)
-   [Advantages of Docker on the Raspberry Pi](#advantages-of-docker-on-the-raspberry-pi)
-   [Install docker and docker-compose](#install-docker-and-docker-compose)
    -   [1. Installing using curl](#1-installing-using-curl)
    -   [2. Add permission to Pi User to run Docker Commands](#2-add-permission-to-pi-user-to-run-docker-commands)
    -   [3. Test](#3-test)
    -   [4. Install docker-compose](#4-install-docker-compose)
    -   [5. Verify the installations](#5-verify-the-installations)

---

## Overview

Docker on the Raspberry Pi: how does it work?
The Raspberry Pi mini computer is not only suitable for playing games or for introducing children to the world of hardware and programming.

Developers also discovered the single-board computer. However, web and software developers have used the mini computer for a long time, for example to work with the Internet of Things (IoT). So why not use the Docker benefits on the Raspberry Pi as well?

## What are the difficulties in connecting the Raspberry Pi with Docker?

Most Raspberry Pi's run on the official Raspberry Pi OS (ex Raspbian OS) <a href="https://www.raspberrypi.org/software/operating-systems/">https://www.raspberrypi.org/software/operating-systems/</a>. This is a modification of the Debian Linux distribution. Since Docker is very often used on Linux machines with which you already have good experience, no complications should therefore arise. However, the difference in hardware can cause problems, because the Pi is not just a smaller version of a PC, it also uses a different processor architecture, called ARM <a href="https://www.arm.com/">https://www.arm.com/</a>.

Docker actually comes from an x64 system as most modern computers know it. However, the Raspberry Pi uses ARM technology. This means that normal Docker images are not compatible with the instance on the Pi. Meanwhile, more and more containers can be found ready for the Raspberry Pi. It is important that you download ready-made containers only from reliable sources, because otherwise you run great security risks. While the choice is limited (and will likely remain so compared to Docker on other systems), you can still take full advantage of the container system by developing your own containers.

For example consider the node's docker image:

-   x64 architecture: docker pull node
-   arm architecture: docker pull arm32v7/node

## Advantages of Docker on the Raspberry Pi

If you are familiar with computer hardware and Linux, you won't find the Raspberry Pi too complicated to use. Therefore these small PCs are also used for experiments. Docker has the same goal: containers are self-contained and closed and therefore cannot cause significant damage to the system.

Since Raspberry Pi's are relatively inexpensive to buy and use, they're also suitable for building a Docker swarm. Instead of building a server structure, just buy Raspberry Pi's and connect them all together. Each device runs its own container. With Swarm and Compose you can then orchestrate the containers.

Small single-board computers, such as the Raspberry Pi, are increasingly used in the Internet of Things thanks to their small size and minimal cost. By combining Docker and Raspberry Pi, it's even possible to make container technology work on a device that wouldn't normally refer to itself as a computer.

## Install docker and docker-compose

At best, Docker can be easily installed with the Raspberry Pi's operating system. The Docker team has provided a separate installation script for this purpose. The first step is to download and run the script, which works via the cURL command.

### 1. Installing using curl

```sh
curl -fsSL https://get.docker.com | sh
```

### 2. Add permission to Pi User to run Docker Commands

```sh
sudo usermod -aG docker pi
```

### 3. Test

```sh
docker run armhf/hello-world
```

### 4. Install docker-compose

```sh
sudo apt-get install -y libffi-dev libssl-dev
sudo apt-get install -y python3 python3-pip
sudo apt-get remove python-configparser

sudo pip3 -v install docker-compose
```

### 5. Verify the installations

```sh
docker -v
docker-compose -v
```
