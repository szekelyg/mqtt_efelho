const express = require('express');
const fs = require('fs');
const mqtt = require('mqtt');
const path = require('path');
const config = require('./config.json');  // Hozzáadva
const DBClient =  require('pg').Client;

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const OFFLINE_TIMEOUT = 300000; // 5 perc
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const influxdb_url = config.influxdb.url;
const token = config.influxdb.token;
const org = config.influxdb.org;  //
const bucket = config.influxdb.bucket;  //
const client = new InfluxDB({ url: influxdb_url, token: token });

const writeApi = client.getWriteApi(org, bucket);
const hivemqCert = fs.readFileSync('./hivemq.crt');

let devices = {};
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!DATABASE_URL) throw new Error("Please supply the DATABASE_URL env var!")
const databaseClient = new DBClient({
  connectionString: DATABASE_URL
});

const mqttClient = mqtt.connect(config.mqtt.server, {  //
  clientId: "MKR1010Client-" + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase(),
  username: config.mqtt.username,  //
  password: config.mqtt.password,  //
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
  mqttClient.subscribe('devices/status', (err) => {
    if (!err) {
      console.log("Subscribed to devices/status topic");
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

databaseClient.connect()
  .then(() => {

    mqttClient.on('message', (topic, message) => {
      console.log(`Received message from topic ${topic}: ${message.toString()}`);

      if (topic === "SmartMeter/P1") {
        // Feldolgozás, ha a témája SmartMeter/P1
        const mqttData = message.toString();
        const dataPairs = mqttData.split(',');

        const clientIDPair = dataPairs.shift();
        const [clientIDKey, clientIDValue] = clientIDPair.split('=');

        const measurementName = dataPairs.shift();

        const epochPair = dataPairs.shift();
        const [epochKey, epochValue] = epochPair.split('=');

        if (devices[clientIDValue]) {
          devices[clientIDValue].lastSeen = Date.now();
        }

        const point = new Point(measurementName).tag('topic', topic).tag(clientIDKey, clientIDValue);
        point.intField(epochKey, parseInt(epochValue));

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

        const currentImport = parseFloat(message.toString().match(/current_import=(.*)i,/)[1]) * 100;
        const currentDate = (new Date()).toISOString().split("T").join(" ").split("Z")[0];
        const currentSeconds = Math.trunc(Date.now()/1000);
        databaseClient.query('INSERT INTO devices (serial_number, status, inserted_at, updated_at) VALUES($1, $2, $3, $3) ON CONFLICT (serial_number) DO UPDATE SET status = $2, updated_at = $3 RETURNING id;', [clientIDValue, "online", currentDate])
          .then((result) => {
            const deviceId = result.rows[0].id;
            databaseClient.query('INSERT INTO raw_data_buckets (timestamp, data_point, device_id, inserted_at, updated_at) VALUES($1, $2, $3, $4, $4)', [currentSeconds, currentImport, deviceId, currentDate]).catch(console.error);
          })
          .catch(console.error);
        console.log(`Device ${clientIDValue} saved into the database successfully`);

        /* ez írja be influxba
        writeApi.writePoint(point);

        writeApi.flush().then(() => {
            console.log(`Successfully written to InfluxDB: ${message.toString()}`);
        }).catch(err => {
            console.error(`Error writing to InfluxDB: ${err}`);
        });
        */

      } else if (topic === "devices/status") {
        // Feldolgozás, ha a témája devices/status
        let payload = JSON.parse(message.toString());
        console.log("Status változás: " + payload.status);
        if (payload.status === "online" || payload.status === "offline") {
          devices[payload.clientId] = {
            status: payload.status,
            lastSeen: Date.now()
          };
          const currentDate = (new Date()).toISOString().split("T").join(" ").split("Z")[0];
          databaseClient.query('INSERT INTO devices (serial_number, status, inserted_at, updated_at) VALUES($1, $2, $3, $3) ON CONFLICT (serial_number) DO UPDATE SET status = $2, updated_at = $3;', [payload.clientId, payload.status, currentDate]).catch(console.error);
          console.log(`Device ${payload.clientId} saved into the database successfully`);
          console.log(`Device ${payload.clientId} is now ${payload.status}.`);
        }
      }
    });

  })
  .catch(console.error);
setTimeout(() => {
  if (!mqttClient.connected) {
    console.error("Failed to connect to MQTT broker after 5 seconds");
    process.exit(1);
  }
}, 5000);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Send a command to a specific device
app.post('/api/send-command', (req, res) => {
  const { device, command } = req.body;

  // Az üzenet formátuma: { "clientID": "MKR1010Client-xxx1", "command": "TURN_ON" }
  const messagePayload = JSON.stringify({ clientID: device, command: command });

  // Check if the device is online
  if (devices[device] && devices[device].status === "online") {
    // Küldje el az üzenetet az INVERTERCOMMAND csatornára
    mqttClient.publish(`InverterCommand`, messagePayload);
    console.log("Send command on channel: InverterCommand, COMMAND: " + messagePayload);

    res.json({ success: true, message: 'Command sent successfully!' });
  } else {
    res.status(404).json({ success: false, message: 'Device not found or offline.' });
  }
});

// Get the status of all devices
app.get('/devices/status', (req, res) => {
  res.json(devices);
});

app.post('/api/select-device', (req, res) => {
  const { device } = req.body;
  console.log(`Device selected: ${device}`);
  res.json({ success: true, message: 'Device selected successfully!' });
});

// Check if devices are still online
setInterval(() => {
  const now = Date.now();
  for (const deviceID in devices) {
    if (devices[deviceID].status === "online" && now - devices[deviceID].lastSeen > OFFLINE_TIMEOUT) {
      devices[deviceID].status = 'offline';
      console.log(`Device ${deviceID} is now offline due to inactivity.`);
    }
  }
}, OFFLINE_TIMEOUT);

