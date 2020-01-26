FROM node:latest
EXPOSE 3000 27017
RUN mkdir -p /home/app

WORKDIR /home/app
COPY . /home/app

RUN npm install
RUN npm install -g typescript
RUN npm install -g ts-node
RUN npm install -g ts-node-dev
RUN npm install -g angular-cli-ghpages