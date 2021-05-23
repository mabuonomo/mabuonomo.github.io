---
title: "Share a USB dongle bluetooth (BLE) over IP using usb2ip"
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
    - ble
category: blog
author: mabuonomo
description: "Share a usb dongle bluetooth (ble) over IP using usb2ip"
---

<img src="/assets/images/docker/raspi.png" />

---

## Overview

Today I have got a _crazy_ idea. 

For a IoT project I need to control a remote usb dongle bluetooth (BLE) from a raspberry pi 4+. Why? I want to run a single program from a server that drives many devices remotely. It's possible? Yes with linux you can!

The solution is called <a href="http://usbip.sourceforge.net/" target="_blank">usb2ip</a>

> The USB/IP Project aims to develop a general USB device sharing system over IP network. To share USB devices between computers with their full functionality, USB/IP encapsulates "USB I/O messages" into TCP/IP payloads and transmits them between computers. Original USB device drivers and applications can be also used for remote USB devices without any modification of them.

What do you need?

-   Raspberry PI 3+
-   USB Dongle BLE
-   PC Linux

<img src="/assets/images/usb2ip/raspberry_ble.jpg" />

## Server (Raspberry PI 3+)

SSH to raspbian and execute the following commands:

```sh
lsusb && hciconfig
```

<img src="/assets/images/usb2ip/lsusb.server.png" />

```sh
sudo su
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
ExecStartPost=/bin/sh -c "/usr/sbin/usbip bind --$(/usr/sbin/usbip list -p -l | grep '#usbid=0a12:0001 #' | cut '-d#' -f1)"
ExecStop=/bin/sh -c "/usr/sbin/usbip unbind --$(/usr/sbin/usbip list -p -l | grep '#usbid=0a12:0001 #' | cut '-d#' -f1); killall usbipd"

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl --system daemon-reload
sudo systemctl enable usbipd.service
sudo systemctl start usbipd.service
```

## Client (Ubuntu 20.04+)

Before start check how many bluetooth devices are active on the client. It is possibile executing _hciconfig_

<img src="/assets/images/usb2ip/client_hciconfig.png" />

How you can see at this moment we have only a device, called _hci0_, this is the integrate bluetooth.

Check now our usb devices (executing _lsub_):

<img src="/assets/images/usb2ip/client_ls.png" />

```sh
sudo su
apt-get install linux-tools-generic -y
modprobe vhci-hcd
echo 'vhci-hcd' >> /etc/modules
nano /lib/systemd/system/usbip.service
```

```txt
[Unit]
Description=usbip client
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c "/usr/lib/linux-tools/$(uname -r)/usbip attach -r 192.168.1.148 -b $(/usr/lib/linux-tools/$(uname -r)/usbip list -r 192.168.1.148 | grep '0a12:0001 ' | cut -d: -f1)"
ExecStop=/bin/sh -c "/usr/lib/linux-tools/$(uname -r)/usbip detach --port=$(/usr/lib/linux-tools/$(uname -r)/usbip port | grep '<Port in Use>' | sed -E 's/^Port ([0-9][0-9]).*/\1/')"

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl --system daemon-reload
sudo systemctl enable usbip.service
sudo systemctl start usbip.service
```

<img src="/assets/images/usb2ip/usb2ip.client.hci.png" />

## FAQ

```sh
sudo systemctl start usbip.service
sudo systemctl status usbip.service

-> libusbip: error: udev_device_new_from_subsystem_sysname failed
-> usbip: error: open vhci_driver
```

```sh
sudo su
modprobe vhci-hcd
sudo systemctl start usbip.service
```

## What's next?
ser2net