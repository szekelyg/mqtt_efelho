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

const mqttOptions = {
  clientId: "MKR1010Client-" + String(random(0xffff), HEX),
  clean: true,
  connectTimeout: 4000,
  username: "szekelyg",
  password: "Sevenof9",
  reconnectPeriod: 1000
};

const mqttClient = mqtt.connect('mqtt://722577b8ac4a4176ac5460ef90db0940.s2.eu.hivemq.cloud', mqttOptions);

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('SmartMeter/P1', (err) => {
    if (!err) {
      console.log("Subscribed to SmartMeter/P1 topic");
    } else {
      console.error("Failed to subscribe to SmartMeter/P1 topic:", err);
    }
  });
});


mqttClient.on('error', (err) => {
  console.error("MQTT Error:", err);
});

mqttClient.on('message', (topic, message) => {
  console.log(`Received message: ${message.toString()} from topic: ${topic}`);

  const point = new Point('mqtt_data')
    .tag('topic', topic)
    .stringField('payload', message.toString());

  writeApi.writePoint(point).catch(err => {
    console.error("Error writing to InfluxDB:", err);
  });

  writeApi.flush().catch(err => {
    console.error("Error flushing data to InfluxDB:", err);
  });
});

app.get('/', (req, res) => {
  res.send('MQTT-InfluxDB bridge is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
