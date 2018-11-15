FROM node

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

ENV KRSV2_DBURL '< Your db url here >'

COPY . .

EXPOSE 6833

CMD [ "npm", "start" ]
