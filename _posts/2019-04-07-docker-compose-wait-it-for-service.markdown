---
title: "Docker-compose: wait for container X before starting Y"
layout: post
date: 2019-04-07 20:00
image: /assets/images/docker/docker_compose.png
headerImage: false
comments: true
lang: en
tag:
- docker-compose
- script
- mysql
- docker
- tutorial
category: blog
author: mabuonomo
description: "Docker-compose: wait for container X before starting Y"
---

<img src="/assets/images/docker/docker_compose.png" />

---

#### Summary
- [Overview](#overview)
- [Problem](#problem)
- [Solution](#solution)

---

## Overview

If you have ever used Docker Compose to run multi-container applications, there is a good chance that you have run into the following situation. Service A depends on service B, but service B takes a a while to start up and be ready. Because of this, you must add some extra "wait for service B" logic into service A's startup procedure.

For example consider this docker-compose file:

{% highlight yaml %}
version: '3.3'
services:
  spring-boot:
    build:
      context: ./
      dockerfile: Dockerfile
    volumes:
      - ./:/app
    working_dir: /app
    depends_on:
      - docker-mysql
    links:
      - docker-mysql
    ports:
      - 8080:8080
  docker-mysql:
    image: mysql:5.7
    ports:
      - 3306:3306
    expose:
      - 3306
{% endhighlight %}

What Docker Compose guarantees is that dependency services are started in the same sense that your desktop computer is started when you press the power button–it still takes a while for the computer to get through its startup screens before you actually get a login screen and the computer is "ready for use."

In our case here, Docker Compose only guarantees that the web service had its "power button pressed," but not that the web server is actually ready to start accepting connections; it still has to go through its regular startup procedure and do a few things before it's actually "ready for use."

## Problem

Because both services start at the same time, it is possible that the spring-boot attempt to initiate a connection to the web service before the docker-mysql service is ready to accept connections.

## Solution

Create a file called "wait-for-it.sh", the original script is here 
<a href="https://github.com/vishnubob/wait-for-it/blob/master/wait-for-it.sh" target="_blank">vishnubob's page</a>:

{% highlight bash %}
cmdname=$(basename $0)

echoerr() { if [[ $QUIET -ne 1 ]]; then echo "$@" 1>&2; fi }

usage()
{
    cat << USAGE >&2
Usage:
    $cmdname host:port [-s] [-t timeout] [-- command args]
    -h HOST | --host=HOST       Host or IP under test
    -p PORT | --port=PORT       TCP port under test
                                Alternatively, you specify the host and port as host:port
    -s | --strict               Only execute subcommand if the test succeeds
    -q | --quiet                Don't output any status messages
    -t TIMEOUT | --timeout=TIMEOUT
                                Timeout in seconds, zero for no timeout
    -- COMMAND ARGS             Execute command with args after the test finishes
USAGE
    exit 1
}

wait_for()
{
    if [[ $TIMEOUT -gt 0 ]]; then
        echoerr "$cmdname: waiting $TIMEOUT seconds for $HOST:$PORT"
    else
        echoerr "$cmdname: waiting for $HOST:$PORT without a timeout"
    fi
    start_ts=$(date +%s)
    while :
    do
        (echo > /dev/tcp/$HOST/$PORT) >/dev/null 2>&1
        result=$?
        if [[ $result -eq 0 ]]; then
            end_ts=$(date +%s)
            echoerr "$cmdname: $HOST:$PORT is available after $((end_ts - start_ts)) seconds"
            break
        fi
        sleep 1
    done
    return $result
}

wait_for_wrapper()
{
    # In order to support SIGINT during timeout: http://unix.stackexchange.com/a/57692
    if [[ $QUIET -eq 1 ]]; then
        timeout $TIMEOUT $0 --quiet --child --host=$HOST --port=$PORT --timeout=$TIMEOUT &
    else
        timeout $TIMEOUT $0 --child --host=$HOST --port=$PORT --timeout=$TIMEOUT &
    fi
    PID=$!
    trap "kill -INT -$PID" INT
    wait $PID
    RESULT=$?
    if [[ $RESULT -ne 0 ]]; then
        echoerr "$cmdname: timeout occurred after waiting $TIMEOUT seconds for $HOST:$PORT"
    fi
    return $RESULT
}

while [[ $# -gt 0 ]]
do
    case "$1" in
        *:* )
        hostport=(${1//:/ })
        HOST=${hostport[0]}
        PORT=${hostport[1]}
        shift 1
        ;;
        --child)
        CHILD=1
        shift 1
        ;;
        -q | --quiet)
        QUIET=1
        shift 1
        ;;
        -s | --strict)
        STRICT=1
        shift 1
        ;;
        -h)
        HOST="$2"
        if [[ $HOST == "" ]]; then break; fi
        shift 2
        ;;
        --host=*)
        HOST="${1#*=}"
        shift 1
        ;;
        -p)
        PORT="$2"
        if [[ $PORT == "" ]]; then break; fi
        shift 2
        ;;
        --port=*)
        PORT="${1#*=}"
        shift 1
        ;;
        -t)
        TIMEOUT="$2"
        if [[ $TIMEOUT == "" ]]; then break; fi
        shift 2
        ;;
        --timeout=*)
        TIMEOUT="${1#*=}"
        shift 1
        ;;
        --)
        shift
        CLI="$@"
        break
        ;;
        --help)
        usage
        ;;
        *)
        echoerr "Unknown argument: $1"
        usage
        ;;
    esac
done

if [[ "$HOST" == "" || "$PORT" == "" ]]; then
    echoerr "Error: you need to provide a host and port to test."
    usage
fi

TIMEOUT=${TIMEOUT:-15}
STRICT=${STRICT:-0}
CHILD=${CHILD:-0}
QUIET=${QUIET:-0}

if [[ $CHILD -gt 0 ]]; then
    wait_for
    RESULT=$?
    exit $RESULT
else
    if [[ $TIMEOUT -gt 0 ]]; then
        wait_for_wrapper
        RESULT=$?
    else
        wait_for
        RESULT=$?
    fi
fi

if [[ $CLI != "" ]]; then
    if [[ $RESULT -ne 0 && $STRICT -eq 1 ]]; then
        echoerr "$cmdname: strict mode, refusing to execute subprocess"
        exit $RESULT
    fi
    exec $CLI
else
    exit $RESULT
fi
{% endhighlight %}

Now we can edit the original docker-compose.yml file, in this way:

{% highlight yaml %}
version: '3.3'
services:
  spring-boot:
    build:
      context: ./
      dockerfile: Dockerfile
    command: ["./wait-for-it.sh", "docker-mysql:3306", "--", "sh", "run.sh"] # <-- look here!
    volumes:
      - ./:/app
    working_dir: /app
    depends_on:
      - docker-mysql
    links:
      - docker-mysql
    ports:
      - 8080:8080
  docker-mysql:
    image: mysql:5.7
    ports:
      - 3306:3306
    expose:
      - 3306
{% endhighlight %}