const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const influxdb_url = 'https://eu-central-1-1.aws.cloud2.influxdata.com';
const token = '7VfH77yCJenqjk-zOT24Bz-nMFrePCAT6Lez8NNUIhO7DB0HOzsWxgXnvgmELe-4s02NANjprUMqSC_kX0bORA==';
const org = 'b08ba55f6db726a3';
const bucket = 'efelho';

const client = new InfluxDB({ url: influxdb_url, token: token });
const writeApi = client.getWriteApi(org, bucket);

const mqttClient = mqtt.connect('mqtt://722577b8ac4a4176ac5460ef90db0940.s2.eu.hivemq.cloud', {
  clientId: "MKR1010Client-" + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase(),
  username: "szekelyg",
  password: "Sevenof9",
  connectTimeout: 5000
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
