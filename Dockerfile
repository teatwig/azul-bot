FROM node:12

WORKDIR /usr/src/app

COPY . .

RUN npm install

ENV DOWNLOAD_DIR /var/app

CMD [ "npm", "start" ]
