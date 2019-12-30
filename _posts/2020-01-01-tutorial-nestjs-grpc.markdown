---
title: "NestJS + gRPC: a multi microservices example"
layout: post
date: 2020-01-01 20:00
image: /assets/images/redis/redis-spring-boot.png
headerImage: false
comments: true
lang: en
tag:
- microservices
- docker
- docker-compose
- grpc
- nestjs
- node
category: blog
author: mabuonomo
description: "NestJS + gRPC: a multi microservices example"
---

<img src="/assets/images/grpc/node_grpc.png" />

---

#### Summary
- [Overview](#overview)
- [What is..](#what-is)
  - [NestJS](#nestjs)
  - [Microservices](#microservices)
  - [Remote Procedure Call (RPC)](#remote-procedure-call-rpc)
  - [gRPC](#grpc)
  - [Protocol Buffer](#protocol-buffer)
- [Well, and now?](#well-and-now)
- [References](#references)

---

## Overview
For a long period of time, REST API has dominated the web programming world until gRPC came and disrupt the industry. There are numerous posts online discussing the advantages of gRPC and comparing it with REST, so I am not going to make redundant comments on this point. My understanding is that gRPC inherits the functionality of REST and extended it with faster, lighter and more flexible service. In this post, let’s take a glance of gRPC and implement a simple service using NestJS.

Comparing to traditional REST API, the client communicates with the server by specify a bunch of constraints, like sending to a specific url and specify what kind of operations like PUT, POST, GET. I think gRPC in a way abstracts the idea and defines the communication by simply calling functions in which messages are defined in protobuf format.

With gRPC, client can directly call a function in the server, as you will see later, they actually share the same protobuf file. And huge advantages from the image above is that server and client written in different languages can communicate with each other easily all based on that they share one protobuf file.
If you are a bit confused so far about gRPC and protobuf, let’s continue and implement a service and see how protobuf plays the role in the communication. In this post, we are going to implement two services, that is sending a request and receiving a response, of an object.

The full source code for this project is available on <a href="https://github.com/mabuonomo/example-nestjs-microservices-grpc" target="_blank">GitHub</a>.

## What is..
### NestJS
Nest (NestJS) is a framework for building efficient, scalable Node.js server-side applications. It uses progressive JavaScript, is built with and fully supports TypeScript (yet still enables developers to code in pure JavaScript) and combines elements of OOP (Object Oriented Programming), FP (Functional Programming), and FRP (Functional Reactive Programming).

### Microservices
The central idea behind microservices is that some types of applications become easier to build and maintain when they are broken down into smaller, composable pieces which work together. Each component is continuously developed and separately maintained, and the application is then simply the sum of its constituent components. This is in contrast to a traditional, "monolithic" application which is all developed all in one piece.

Applications built as a set of modular components are easier to understand, easier to test, and most importantly easier to maintain over the life of the application. It enables organizations to achieve much higher agility and be able to vastly improve the time it takes to get working improvements to production. This approach has proven to be superior, especially for large enterprise applications which are developed by teams of geographically and culturally diverse developers.

There are other benefits:

* **Developer independence**
  Small teams work in parallel and can iterate faster than large teams.
* **Isolation and resilience** 
  If a component dies, you spin up another while and the rest of the application continues to function.
* **Scalability**
  Smaller components take up fewer resources and can be scaled to meet increasing demand of that component only.
* **Lifecycle automation**
  Individual components are easier to fit into continuous delivery pipelines and complex deployment scenarios not possible with monoliths.
* **Relationship to the business**
  Microservice architectures are split along business domain boundaries, increasing independence and understanding across the organization.

The common definition of microservices generally relies upon each microservice providing an API endpoint, often but not always a stateless REST API which can be accessed over HTTP(S) just like a standard web page. This method for accessing microservices make them easy for developers to consume as they only require tools and methods many developers are already familiar with.

In this article we'll use gRPC indeed REST technology.

### Remote Procedure Call (RPC)
Firstly, Remote Procedure Call is a protocol where one program can use to request a service which is located in another program on different network without having to understand the network details.

It differs from normal procedure call. It makes use of kernel to make a request call to another service in the different network.

### gRPC
gRPC (gRPC Remote Procedure Calls) is an open source remote procedure call (RPC) system initially developed at Google. It uses HTTP/2 for transport, Protocol Buffers as the interface description language, and provides features such as authentication, bidirectional streaming and flow control, blocking or nonblocking bindings, and cancellation and timeouts. 

* **Procedure call makes it simple**
Because it’s RPC, the programming model is procedure calls: the networking aspect of the technology is abstracted away from application code, making it look almost as if it was a normal in-process function call. Your client-server interaction will not be constrained by the semantics of HTTP resource methods (such as GET, PUT, POST, and DELETE). Compared to REST APIs, your implementation looks more natural, without the need for handling HTTP protocol metadata.

* **Efficient network transmission with HTTP/2**
Transmitting data from mobile devices to a backend server can be a very resource-intensive process. Using the standard HTTP/1.1 protocol, frequent connections from a mobile device to a cloud service can drain the battery, increase latency, and block other apps from connecting. By default, gRPC runs on top of HTTP/2, which introduces bi-directional streaming, flow control, header compression, and the ability to multiplex requests over a single TCP/IP connection. The result is that gRPC can reduce resource usage, resulting in lower response times between your app and services running in the cloud, reduced network usage, and longer battery life for client running on mobile devices.

* **Built-in streaming data exchange support**
gRPC was designed with HTTP/2’s support for full-duplex bidirectional streaming in mind from the outset. Streaming allows a request and response to have an arbitrarily large size, such as operations that require uploading or downloading a large amount of information. With streaming, client and server can read and write messages simultaneously and subscribe to each other without tracking resource IDs. This makes your app implementation more flexible.

* **Seamless integration with Protocol Buffer**
gRPC uses Protocol Buffers (Protobuf) as its serialization/deserialization method with optimized-for-Android codegen plugin (Protobuf Java Lite). Compared to text-based format (such as JSON), Protobuf offers more efficient data exchanging in terms of marshaling speed and code size, which makes it more suitable to be used in mobile environments. Also Protobuf’s concise message/service definition syntax makes it much easier to define data model and application protocols for your app.

### Protocol Buffer
Protocol buffers are language neutral way of serializing structure data. In simple terms, it converts the data into binary formats and transfer the data over the network. It is lightweight when compare to XML,JSON

Below an .proto file example:
```proto
syntax = "proto3";

package micr1;

service Micr1Service {
  rpc FindOne (Micr1ById) returns (Micr1) {}
}

message Micr1ById {
  int32 id = 1;
}

message Micr1 {
  int32 id = 1;
  string name = 2;
}
```

As you can see, each field in the message definition has a unique number. These field numbers are used to identify your fields in the message binary format, and should not be changed once your message type is in use. Note that field numbers in the range 1 through 15 take one byte to encode, including the field number and the field's type (you can find out more about this in Protocol Buffer Encoding). Field numbers in the range 16 through 2047 take two bytes. So you should reserve the numbers 1 through 15 for very frequently occurring message elements. Remember to leave some room for frequently occurring elements that might be added in the future.

## Well, and now?


## References
* https://developer.android.com/guide/topics/connectivity/grpc
* https://cloudnweb.dev/2019/05/what-is-grpc-how-to-implement-grpc-in-node-js
* https://grpc.io
* https://docs.nestjs.zcom/microservices/grpc
* https://developers.google.com/protocol-buffers/docs/proto
* https://github.com/mabuonomo/example-nestjs-microservices-grpc
* https://docs.nestjs.com/