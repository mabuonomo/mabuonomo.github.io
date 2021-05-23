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

<img src="/assets/images/usb2ip/header.jpg" />

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

First of all we have to check the initial state of the devices that are installated on the our raspberry pi.

Then connect via SSH to raspbian and run the following commands:

```sh
lsusb && hciconfig
```

<img src="/assets/images/usb2ip/lsusb.server.png" />

As you can see _lsusb_ show a BLE tongle identified by _0a12:0001_ (this value is very important, it called _usbid_, save it!)

```
Bus 001 Device 003: ID 0a12:0001 Cambridge Silicon Radio, Ltd Bluetooth Dongle (HCI mode)
```

_hciconfig_ instead shows the bluetooth device address of our BLE device, it is active and running.

### Configure the usb2ip server

The following steps will configure the _usb2ip_ server.

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

NB. You need to replace _usbid_ 0a12:0001 with the your usbid ble device.

```sh
sudo systemctl --system daemon-reload
sudo systemctl enable usbipd.service
sudo systemctl start usbipd.service
```

## Client (Ubuntu 20.04+)

Before start check how many bluetooth devices are active on the client. It is possibile running _hciconfig_

<img src="/assets/images/usb2ip/client_hciconfig.png" />

As you can see at this moment we have only a device, called _hci0_, this is the built-in bluetooth.

Check now our usb devices (by running _lsub_):

<img src="/assets/images/usb2ip/client_ls.png" />

## Configure the client

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

NB. You have to replace 192.168.1.148 and 0a12:0001 with the values of the raspberry'ip and subid of the usb ble tongle.

```sh
sudo systemctl --system daemon-reload
sudo systemctl enable usbip.service
sudo systemctl start usbip.service
```

Thats' all!

To verify that the installation is correct you can run _hciconfig_ on your client. You should see a new device with the bluetooth address of the ble dongle installed on the raspberry pi.

<img src="/assets/images/usb2ip/usb2ip.client.hci.png" />

## FAQ

### usbip: error: open vhci_driver

If usbip service fails to start on the client:

```sh
sudo systemctl start usbip.service
sudo systemctl status usbip.service

-> libusbip: error: udev_device_new_from_subsystem_sysname failed
-> usbip: error: open vhci_driver
```

Rerun modprobe command

```sh
sudo su
modprobe vhci-hcd
sudo systemctl start usbip.service
```

## What's next?

What if I want to share the main bluetooth device (/dev/serial1 -> /dev/ttyAMA0) and not an external dongle? We can try with net2ser, but this needs a new article!

Stay tuned!
