FROM eclipse-mosquitto:latest

# Konfigurációs fájl másolása
COPY mosquitto.conf /mosquitto/config/mosquitto.conf
COPY ./passwordfile.txt /mosquitto/config/passwordfile.txt


# Portok kinyitása
EXPOSE 1883 8883
