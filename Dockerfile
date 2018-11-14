FROM node

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

ENV KRSV2_DBURL 'mongodb://testuser:testpassword@testdb-mongodb-replicaset-0.testdb-mongodb-replicaset.default.svc.cluster.local,testdb-mongodb-replicaset-1.testdb-mongodb-replicaset.default.svc.cluster.local,testdb-mongodb-replicaset-2.testdb-mongodb-replicaset.default.svc.cluster.local/main?replicaSet=rs0'

COPY . .

EXPOSE 6833

CMD [ "npm", "start" ]
