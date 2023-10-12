FROM eclipse-mosquitto:latest

# Konfigurációs fájl másolása
COPY mosquitto.conf /mosquitto/config/mosquitto.conf

# Portok kinyitása
EXPOSE 1883 8883
