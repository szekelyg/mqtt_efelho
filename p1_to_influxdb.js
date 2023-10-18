const express = require('express');
const fs = require('fs');
const mqtt = require('mqtt');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const influxdb_url = 'https://eu-central-1-1.aws.cloud2.influxdata.com';
const token = '7VfH77yCJenqjk-zOT24Bz-nMFrePCAT6Lez8NNUIhO7DB0HOzsWxgXnvgmELe-4s02NANjprUMqSC_kX0bORA==';
const org = 'b08ba55f6db726a3';
const bucket = 'p1_data';

const client = new InfluxDB({ url: influxdb_url, token: token });
const writeApi = client.getWriteApi(org, bucket);


const hivemqCert = fs.readFileSync('./hivemq.crt'); 

const mqttClient = mqtt.connect('mqtts://722577b8ac4a4176ac5460ef90db0940.s2.eu.hivemq.cloud', {
  clientId: "MKR1010Client-" + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase(),
  username: "szekelyg",
  password: "Sevenof9",
  connectTimeout: 5000,
  ca: hivemqCert,
  rejectUnauthorized: false
});


mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('SmartMeter/P1', (err) => {
    if (!err) {
      console.log("Subscribed to SmartMeter/P1 topic");
    } else {
      console.error("Failed to subscribe:", err);
    }
  });
});

mqttClient.on('error', (err) => {
  console.error("MQTT Error:", err);
});

mqttClient.on('offline', () => {
  console.warn("MQTT client is offline");
});

mqttClient.on('reconnect', () => {
  console.warn("Reconnecting to MQTT broker...");
});

mqttClient.on('message', (topic, message) => {
  console.log(`Received message from topic ${topic}: ${message.toString()}`);

  const mqttData = message.toString();
  const dataPairs = mqttData.split(',');

  // Az első elem (pl. "clientID=MKR1010Client-XYZ") a kliens ID lesz
  const clientIDPair = dataPairs.shift();
  const [clientIDKey, clientIDValue] = clientIDPair.split('=');

  // A második elem (pl. "electricity") a mérési pont neve lesz
  const measurementName = dataPairs.shift();

  const point = new Point(measurementName).tag('topic', topic).tag(clientIDKey, clientIDValue);

  dataPairs.forEach(pair => {
    const [key, value] = pair.split('=');
    if (value.endsWith('i')) {
        point.intField(key, parseInt(value.slice(0, -1)));
    } else if (value.includes('.')) {
        point.floatField(key, parseFloat(value));
    } else if (value.endsWith('u')) {
        point.uintField(key, value.slice(0, -1));
    } else {
        point.stringField(key, value);
    }
  });




  writeApi.writePoint(point);

  writeApi.flush().then(() => {
    console.log(`Successfully written to InfluxDB: ${message.toString()}`);
  }).catch(err => {
    console.error(`Error writing to InfluxDB: ${err}`);
  });
});





setTimeout(() => {
  if (!mqttClient.connected) {
    console.error("Failed to connect to MQTT broker after 5 seconds");
    process.exit(1);
  }
}, 5000);

app.get('/', (req, res) => {
  res.send('MQTT-InfluxDB bridge is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
