const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const influxdb_url = 'https://eu-central-1-1.aws.cloud2.influxdata.com';
const token = 'lhfnQvKJn7ZO9P_GEnyCy-sXMfy3y7eYxwuC3aj0jDQeOUtMwvc-7vYfQNsc69NH4wDtoCosrpv-R8ndHQezjA==';
const org = 'Energiafelho';
const bucket = 'efelho';

const client = new InfluxDB({ url: influxdb_url, token: token });
const writeApi = client.getWriteApi(org, bucket);

const mqttClient = mqtt.connect('mqtt://722577b8ac4a4176ac5460ef90db0940.s2.eu.hivemq.cloud');

mqttClient.on('connect', () => {
  mqttClient.subscribe('SmartMeter/P1', (err) => {
    if (!err) {
      console.log("Subscribed to SmartMeter/P1 topic");
    }
  });
});

mqttClient.on('message', (topic, message) => {
  console.log(`Received message: ${message.toString()} from topic: ${topic}`);

  const point = new Point('mqtt_data')
    .tag('topic', topic)
    .stringField('payload', message.toString());

  writeApi.writePoint(point);
  writeApi.flush();
});
