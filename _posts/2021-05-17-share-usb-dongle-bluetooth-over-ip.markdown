---
title: "Share a usb dongle bluetooth over IP using usb2ip"
layout: post
date: 2021-05-17 20:00
image: /assets/images/docker/raspi.png
headerImage: false
comments: true
lang: en
tag:
    - raspberry
    - tutorial
    - install
    - iot
    - usb2ip
    - ubuntu
    - bluetooth
category: blog
author: mabuonomo
description: "Share a usb dongle bluetooth over IP using usb2ip"
---

<img src="/assets/images/docker/raspi.png" />

---

## Overview

Today I have got a crazy idea. For a iot project I need to control a remote usb dongle bluetooth (ble) from a raspberry pi 4+. Why? I want to run a single program from a server that drives many devices remotely. It's possible?

Yes with linux you can!

The solution is called <a href="http://usbip.sourceforge.net/" target="_blank">usb2ip</a>

> The USB/IP Project aims to develop a general USB device sharing system over IP network. To share USB devices between computers with their full functionality, USB/IP encapsulates "USB I/O messages" into TCP/IP payloads and transmits them between computers. Original USB device drivers and applications can be also used for remote USB devices without any modification of them.

What do you need?

-   Raspberry 3+ (Raspian is used in this tutorial), for us it's the server
-   USB Dongle BLE
-   PC Linux (ubuntu 21.04 is used in this tutorial), for us it's the client

## Server

SSH to raspbian and execute the following commands:

```sh
sudo su
lsusb
```

```sh
apt-get install usbip
modprobe usbip_host
echo 'usbip_host' >> /etc/modules
nano /lib/systemd/system/usbipd.service
```

```txt
[Unit]
Description=usbip host daemon
After=network.target

[Service]
Type=forking
ExecStart=/usr/sbin/usbipd -D
ExecStartPost=/bin/sh -c "/usr/sbin/usbip bind --$(/usr/sbin/usbip list -p -l | grep '#usbid=10c4:8a2a#' | cut '-d#' -f1)"
ExecStop=/bin/sh -c "/usr/sbin/usbip unbind --$(/usr/sbin/usbip list -p -l | grep '#usbid=10c4:8a2a#' | cut '-d#' -f1); killall usbipd"

[Install]
WantedBy=multi-user.target
```

```sh
exit
sudo systemctl --system daemon-reload
sudo systemctl enable usbipd.service
sudo systemctl start usbipd.service
```

## Client

<img src="/assets/images/usb2ip/client_hciconfig.png" />

```sh
sudo su
apt-get install linux-tools-generic -y
modprobe vhci-hcd
echo 'vhci-hcd' >> /etc/modules
nano /lib/systemd/system/usbip.service
```

<img src="/assets/images/usb2ip/client_ls.png" />

```txt
[Unit]
Description=usbip client
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c "/usr/lib/linux-tools/$(uname -r)/usbip attach -r 192.168.0.10 -b $(/usr/lib/linux-tools/$(uname -r)/usbip list -r 192.168.0.10 | grep '10c4:8a2a' | cut -d: -f1)"
ExecStop=/bin/sh -c "/usr/lib/linux-tools/$(uname -r)/usbip detach --port=$(/usr/lib/linux-tools/$(uname -r)/usbip port | grep '<Port in Use>' | sed -E 's/^Port ([0-9][0-9]).*/\1/')"

[Install]
WantedBy=multi-user.target
```

```sh
exit
sudo systemctl --system daemon-reload
sudo systemctl enable usbip.service
sudo systemctl start usbip.service
```
