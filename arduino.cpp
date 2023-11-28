#include <WiFiNINA.h>
#include <ArduinoBearSSL.h>
#include <ArduinoECCX08.h>
#include <PubSubClient.h>
#include "hivemq.h"
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

// Konstansok és Beállítások
//const char* ssid = "LANSolo";
//const char* password = "Sevenof";

// alakulóban van a kód eléggé

const char* mqtt_server = "722577b8ac4a4176ac5460ef90db0940.s2.eu.hivemq.cloud";
const char* clientId = "MKR1010Client2-xxxx2"; 
const long interval = 30000; // interval at which to send data (30 seconds)
const char* AP_SSID = "MyArduinoAP";
const char* AP_PASSWORD = "password";
String knownSSID = "LANSolo"; 
String knownPASSWORD = "Sevenof9"; 

WiFiSSLClient wifiClient;
PubSubClient client(wifiClient);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "europe.pool.ntp.org", 3600, 60000);
unsigned long previousMillis = 0;
unsigned long epochTime;
WiFiServer server(80);

void setup() {
  Serial.begin(9600);

  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("WiFi modul hiba");
    while (true);
  }

  WiFi.beginAP(AP_SSID, AP_PASSWORD);
  server.begin();
  Serial.println("AP módban indítva");

  if (knownSSID != "") {
    WiFi.begin(knownSSID.c_str(), knownPASSWORD.c_str());
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Csatlakozva az ismert hálózathoz");
    }
  }

  //setup_wifi();
  client.setServer(mqtt_server, 8883);
  client.setCallback(callback);
  timeClient.begin();
}

void loop() {
  handleWiFiClient();
  handleCaptivePortal();

  timeClient.update();
  epochTime = timeClient.getEpochTime();
  if (!client.connected()) {
    sendOfflineMessage();
    reconnect();
  }
  client.loop();
  sendToInfluxDB();
}

void setup_wifi() {
  Serial.print("Connecting to ");
  Serial.println(knownSSID);
  WiFi.begin(knownSSID.c_str(), knownPASSWORD.c_str());
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  // ... (A callback függvény tartalma változatlan)
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");

  Serial.println("Topic " + String(topic));

  if (String(topic) == "InverterCommand") {
    String receivedMessage = "";
    for (int i = 0; i < length; i++) {
      receivedMessage += (char)payload[i];
    }
    
    
    /*DynamicJsonDocument doc(256);
    deserializeJson(doc, receivedMessage);
    const char* receivedClientId = doc["clientId"];
    const char* command = doc["command"];
    DeserializationError error = deserializeJson(doc, receivedMessage);
    if (error) {
      Serial.print("deserializeJson() failed: ");
      Serial.println(error.c_str());
    }*/
      
    int clientIdStart = receivedMessage.indexOf("clientID\":\"") + 11; // A "clientID\":\" után kezdődik a clientID
    int clientIdEnd = receivedMessage.indexOf("\",", clientIdStart);
    String receivedClientId = receivedMessage.substring(clientIdStart, clientIdEnd);

    int commandStart = receivedMessage.indexOf("command\":\"") + 10; // A "command\":\" után kezdődik a command
    int commandEnd = receivedMessage.lastIndexOf("\"");
    String receivedCommand = receivedMessage.substring(commandStart, commandEnd);

    Serial.println("Received clientID: " + receivedClientId);
    Serial.println("Received command: " + receivedCommand);

    if (String(receivedClientId) == clientId) {
      Serial.println("Received command for this device: " + String(receivedCommand));
    } else {
      Serial.println("Command not for this device. Ignored.");
    }
  }
}

void reconnect() {
  if (WiFi.status() == WL_CONNECTED) { // Ellenőrizzük, hogy van-e internetkapcsolat
    while (!client.connected()) {
      Serial.print("Attempting MQTT connection...");
      String topicID = "InverterCommand/" + String(clientId);
      if (client.connect(String(clientId).c_str(), "szekelyg", "Sevenof9")) {
        Serial.println("connected");
        client.subscribe("InverterCommand");
        client.subscribe(topicID.c_str());
        client.subscribe("SmartMeter/P1");
        String onlinePayload = "{ \"clientId\": \"" + String(clientId) + "\", \"status\": \"online\" }";
        client.publish("devices/status", onlinePayload.c_str());
      } else {
        Serial.print("failed, rc=");
        Serial.print(client.state());
        Serial.println(" try again in 5 seconds");
        delay(5000);
      }
    }
  } else {
    Serial.println("No internet connection. Skipping MQTT connection attempt.");
  }
}

void onDisconnect() {
  String offlinePayload = "{ \"clientId\": \"" + String(clientId) + "\", \"status\": \"offline\" }";
  client.publish("devices/status", offlinePayload.c_str());
  client.disconnect();
}

void sendOfflineMessage() {
  String offlinePayload = "{ \"clientId\": \"" + String(clientId) + "\", \"status\": \"offline\" }";
  client.publish("devices/status", offlinePayload.c_str());
  client.disconnect();
}

void sendToInfluxDB() {
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    float total_import = random(0, 10000000) / 1000.0;
    float current_import = random(0, 10000) / 1000.0;
    float voltage = random(210, 240);
    float current = random(0, 1000) / 100.0;

    Serial.println("EPOHTIME: " + String(epochTime));

    if (!isnan(epochTime) && epochTime > 0) {
      String influxData = String("clientID=") + clientId + ",electricity,epochTime=" + String(epochTime) + // <-- Itt adtam hozzá a vesszőt
                  ",phase=L1" +
                  ",total_import=" + String(total_import) + "i" +
                  ",current_import=" + String(current_import) + "i" +
                  ",voltage=" + String(voltage) +
                  ",current=" + String(current);

      // Send the data to the MQTT channel
      client.publish("SmartMeter/P1", influxData.c_str());
      Serial.println("ALL: " + influxData);

    } else {
        Serial.println("Invalid epochTime value!");
    }
  }
}

void handleWiFiClient() {
  WiFiClient client = server.available();

  if (client) {
    String request = client.readStringUntil('\r');
    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: text/html");
    client.println();

    client.println("<html><body>");
    client.println("<h1>Elérhető WiFi hálózatok:</h1>");
    client.println("<form method='post'>");
    client.println("<select name='ssid'>");

    int numNetworks = WiFi.scanNetworks();
    for (int i = 0; i < numNetworks; i++) {
      client.println("<option value='" + String(WiFi.SSID(i)) + "'>" + String(WiFi.SSID(i)) + "</option>");
    }

    client.println("</select>");
    client.println("<br><label for='password'>Jelszó:</label>");
    client.println("<input type='password' name='password'>");
    client.println("<br><input type='submit' value='Csatlakozás'>");
    client.println("</form>");
    client.println("</body></html>");

    if (request.indexOf("POST") != -1) {
      int ssidStart = request.indexOf("ssid=") + 5;
      int ssidEnd = request.indexOf("&", ssidStart);
      String ssid = request.substring(ssidStart, ssidEnd);

      int passStart = request.indexOf("password=") + 9;
      int passEnd = request.indexOf(" ", passStart);
      String password = request.substring(passStart, passEnd);

      WiFi.begin(ssid.c_str(), password.c_str());
      if (WiFi.status() == WL_CONNECTED) {
        client.println("<p>Sikeres csatlakozás!</p>");
        knownSSID = ssid.c_str();
        knownPASSWORD = password.c_str();
      } else {
        client.println("<p>Csatlakozás sikertelen!</p>");
      }
    }

    client.stop();
  }
}

void handleCaptivePortal() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFiClient client = server.available();
    if (client) {
      String request = client.readStringUntil('\r');
      if (request.indexOf("/generate_204") != -1) {  // Android captive portal check.
        client.println("HTTP/1.1 204 No Content");
        client.println("Connection: close");
        client.println();
      } else if (request.indexOf("/hotspot-detect.html") != -1) {  // Apple captive portal check.
        client.println("HTTP/1.1 302 Found");
        client.println("Location: http://captive.apple.com/hotspot-detect.html");
        client.println("Connection: close");
        client.println();
      } else {
        client.println("HTTP/1.1 302 Found");
        client.println("Location: http://192.168.4.1");
        client.println("Connection: close");
        client.println();
      }
      client.stop();
    }
  }
}

