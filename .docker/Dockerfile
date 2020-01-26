FROM node:latest
EXPOSE 4200
RUN mkdir -p /home/app

WORKDIR /home/app
COPY . /home/app

RUN npm install
RUN npm install -g typescript
RUN npm install -g ts-node
RUN npm install -g ts-node-dev
RUN npm install -g @angular/cli
RUN npm install -g angular-cli-ghpages