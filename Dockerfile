FROM node

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

ENV KRSV2_DBURL 'mongodb://testuser:testpassword@testdb-mongodb-replicaset:27017/main'

COPY . .

EXPOSE 6833

CMD [ "npm", "start" ]